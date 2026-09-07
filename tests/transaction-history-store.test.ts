import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadLatestVersion, saveVersion } from '../src/app/lib/transaction-history-store';

function clientFixture({member = true, signedIn = true, historyError = false} = {}) {
  const calls: unknown[][] = [];
  const client = {
    auth: { getUser: async () => ({data: {user: signedIn ? {id: 'member-id'} : null}, error: null}) },
    from: (table: string) => {
      calls.push(['from', table]);
      const query = {
        select: (columns: string) => { calls.push(['select', columns]); return query; },
        eq: (column: string, value: string) => {calls.push(['eq', column, value]); return query;},
        order: (column: string, options: unknown) => {calls.push(['order', column, options]); return query;},
        limit: (count: number) => {calls.push(['limit', count]); return query;},
        maybeSingle: async () => ({data: table === 'transaction_history_members' && member ? {user_id: 'member-id'} : null,
          error: table !== 'transaction_history_members' && historyError ? {message: 'History network error'} : null}),
      };
      return query;
    },
    rpc: async (fn: string, args: unknown) => {calls.push(['rpc', fn, args]); return {data: 42, error: null};},
  } as unknown as SupabaseClient;
  return {client, calls};
}

test('history reads exactly the requested month and latest version, never an earlier month', async () => {
  const {client, calls} = clientFixture();
  assert.equal(await loadLatestVersion(client, '12.2025'), null);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['eq', 'period', '2025-12-01'])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['order', 'id', {ascending: false}])));
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['limit', 1])));
});

test('missing membership, login and transport failures cannot masquerade as missing history', async () => {
  await assert.rejects(loadLatestVersion(clientFixture({member: false}).client, '01.2026'), /chưa được cấp quyền/);
  await assert.rejects(loadLatestVersion(clientFixture({signedIn: false}).client, '01.2026'), /đăng nhập/);
  await assert.rejects(loadLatestVersion(clientFixture({historyError: true}).client, '01.2026'), /network/);
});

test('saving calls the atomic RPC with unchanged request id and whole snapshot', async () => {
  const {client, calls} = clientFixture();
  const rows = [{'Document ID': '001', 'Beneficiary Account No.': '00123'}];
  assert.equal(await saveVersion(client, '01.2026', rows, 'request-uuid'), '42');
  assert.deepEqual(calls.at(-1), ['rpc', 'append_transaction_version', {
    p_period: '2026-01-01', p_rows: rows, p_request_id: 'request-uuid',
  }]);
});
