import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertTransactionCheckCurrent, loadTransactionCheckSource, saveVersion, type TransactionVersion } from '../src/app/lib/transaction-history-store';
import { replaceTransactionPeriod, sameTransactionSnapshot } from '../src/app/lib/utils/transaction-snapshot';
import { applyTransactionHistoryResolution } from '../src/app/lib/utils/transaction-history-resolution';
import { compareAccountsAcrossHistory } from '../src/app/lib/utils/transaction-history';

const rows = (month: string, account = '0012345678') => [{
  'Tháng báo cáo': month, 'Document ID': 'EMP-1', 'Beneficiary Account No.': account, 'Beneficiary Name': 'NGUYEN VAN AN',
}];
const version = (id: string, period: string, account?: string): TransactionVersion => ({
  id, period: `${period}-01`, created_at: '2026-09-08T10:00:00Z', rows: rows(period, account),
});

function fixture(initial: TransactionVersion[]) {
  let records = structuredClone(initial);
  let sequence = 100;
  let afterRead: (() => void) | undefined;
  let failReads = false;
  const client = {
    auth: {getUser: async () => ({data: {user: {id: 'member'}}, error: null})},
    from(table: string) {
      const filters: ((record: TransactionVersion) => boolean)[] = [];
      let limit = 200;
      const selected = () => records.filter(record => filters.every(filter => filter(record)))
        .sort((a, b) => Number(b.id) - Number(a.id)).slice(0, Math.min(limit, 2));
      const query = {
        select: () => query,
        eq: (key: 'id' | 'period', value: string) => {filters.push(record => record[key] === value); return query;},
        lt: (key: 'id' | 'period', value: string) => {
          filters.push(record => key === 'id' ? BigInt(record.id) < BigInt(value) : record.period < value);
          return query;
        },
        order: () => query,
        limit: (value: number) => {limit = value; return query;},
        maybeSingle: async () => ({data: table === 'transaction_history_members' ? {user_id: 'member'} : structuredClone(selected()[0] || null), error: null}),
        single: async () => {
          const result = {data: structuredClone(selected()[0] || null), error: failReads ? {message: 'read failed'} : null};
          const callback = afterRead; afterRead = undefined; callback?.();
          return result;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({data: structuredClone(selected()), error: null}).then(resolve, reject);
        },
      };
      return query;
    },
    rpc: async (_name: string, args: {p_period: string; p_rows: TransactionVersion['rows']}) => {
      const id = String(++sequence);
      records = records.filter(record => record.period !== args.p_period);
      records.push({id, period: args.p_period, rows: structuredClone(args.p_rows), created_at: '2026-09-08T11:00:00Z'});
      return {data: id, error: null};
    },
  } as unknown as SupabaseClient;
  return {client, change: (record: TransactionVersion) => {records.push(record);}, afterRead: (callback: () => void) => {afterRead = callback;}, fail: () => {failReads = true;}};
}

test('after Save month, Check reads the updated current and earlier months afresh', async () => {
  const store = fixture([version('1', '2026-01'), version('2', '2026-08'), version('3', '2026-09')]);
  const before = await loadTransactionCheckSource(store.client, '08.2026');
  assert.equal(before.currentVersion.id, '2');
  const currentRows = rows('2026-08', '0099999999');
  currentRows[0]['Document ID'] = 'UPDATED-ID';
  await saveVersion(store.client, '08.2026', currentRows, 'current-save');
  await saveVersion(store.client, '01.2026', rows('2026-01', '0088888888'), 'history-save');
  const latest = await loadTransactionCheckSource(store.client, '08.2026');
  assert.equal(latest.currentVersion.rows[0]['Document ID'], 'UPDATED-ID');
  assert.equal(latest.currentVersion.rows[0]['Beneficiary Account No.'], '0099999999');
  assert.deepEqual(latest.versions.map(item => item.period), ['2026-01-01']);
  assert.equal(latest.versions[0].rows[0]['Beneficiary Account No.'], '0088888888');
});

test('a missing current cloud month and read errors cannot silently use stale local rows', async () => {
  await assert.rejects(loadTransactionCheckSource(fixture([version('1', '2026-01')]).client, '08.2026'), /Lưu sửa.*Lưu tháng/);
  const store = fixture([version('1', '2026-08')]); store.fail();
  await assert.rejects(loadTransactionCheckSource(store.client, '08.2026'), /read failed/);
});

test('a snapshot changed while checking is rejected, and a fresh click retrieves the new version', async () => {
  const store = fixture([version('1', '2026-08')]);
  store.afterRead(() => store.change(version('2', '2026-08', '0099999999')));
  await assert.rejects(loadTransactionCheckSource(store.client, '08.2026'), /vừa được cập nhật/);
  assert.equal((await loadTransactionCheckSource(store.client, '08.2026')).currentVersion.id, '2');
});

test('sync rejects changed donors and newly saved historical months, even when the target did not change', async () => {
  const store = fixture([version('1', '2026-01'), version('2', '2026-08')]);
  const source = await loadTransactionCheckSource(store.client, '08.2026');
  await assertTransactionCheckCurrent(store.client, source);
  store.change(version('3', '2026-01', '0099999999'));
  await assert.rejects(assertTransactionCheckCurrent(store.client, source), /đã thay đổi/);
  const refreshed = await loadTransactionCheckSource(store.client, '08.2026');
  store.change(version('4', '2026-03'));
  await assert.rejects(assertTransactionCheckCurrent(store.client, refreshed), /đã thay đổi/);
});

test('December check includes December and earlier months, excluding next January', async () => {
  const source = await loadTransactionCheckSource(fixture([
    version('1', '2025-11'), version('2', '2025-12'), version('3', '2026-01'),
  ]).client, '12.2025');
  assert.equal(source.currentVersion.period, '2025-12-01');
  assert.deepEqual(source.versions.map(item => item.period), ['2025-11-01']);
});

test('snapshot comparison handles JSONB key order and detects unsaved cloud differences', () => {
  const local = rows('08.2026');
  const cloud = rows('2026-08').map(row => Object.fromEntries(Object.entries(row).reverse()));
  assert.equal(sameTransactionSnapshot(local, cloud, '08.2026'), true);
  assert.equal(sameTransactionSnapshot(local, rows('2026-08', '0099999999'), '08.2026'), false);
});

test('sync indexes the checked monthly snapshot and preserves other local months', () => {
  const january = rows('2026-01')[0];
  const august = rows('2026-08');
  const result = compareAccountsAcrossHistory(august, [version('1', '2026-01', '0099999999')])[0];
  const updated = applyTransactionHistoryResolution(august, {
    field: 'Beneficiary Account No.', value: '0099999999', rowIndexes: result.currentRowIndexes,
    basedOnPeriods: ['2026-01'], resolvedAt: '2026-09-08T00:00:00Z',
  });
  const merged = replaceTransactionPeriod([january, ...august], '08.2026', updated);
  assert.equal(merged[0], january);
  assert.equal(merged[1]['Beneficiary Account No.'], '0099999999');
});
