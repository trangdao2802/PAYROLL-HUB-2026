import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_APP_DATA } from '../src/app/constants/initial-data';
import type { TransactionVersion } from '../src/app/lib/transaction-history-store';
import { applyLocalTransactionVersions, conflictingLocalTransactionPeriods } from '../src/app/lib/utils/transaction-local-history';
import { compareAccountsAcrossHistory } from '../src/app/lib/utils/transaction-history';
import { syncReportingMonthReconciliation } from '../src/app/lib/utils/reconciliation-sync';

const version = (period: string, documentId = '027000000123'): TransactionVersion => ({
  id: period === '2026-04' ? '145' : '146',
  period: `${period}-01`, created_at: '2026-09-25T02:00:00Z',
  rows: [{
    id: `payment-${period}`, 'Payment Serial Number': 3, 'Tháng báo cáo': period,
    'Document ID': documentId, 'Beneficiary Account No.': '0012345678',
    'Beneficiary Name': 'NGUYEN VAN AN', 'Payment Amount': 990_000,
  }],
});
const savedActivity = {lastAction: 'saved' as const, editCount: 4, saveVersion: 4};
const cached = (source: TransactionVersion) => ({
  table: {headers: Object.keys(source.rows[0]), data: source.rows}, activity: savedActivity,
});

test('August check identifies a saved April/cloud mismatch even when August matches', () => {
  const april = version('2026-04');
  const currentVersion = version('2026-08');
  const source = {currentVersion, versions: [version('2026-04', '001000000456')]};
  const months = {'2026-04': cached(april)};
  const original = structuredClone({source, months});

  assert.deepEqual(conflictingLocalTransactionPeriods(source, currentVersion.rows, '08.2026', months), ['2026-04']);
  assert.deepEqual({source, months}, original, 'checking must not modify local or cloud payroll');
  assert.match(compareAccountsAcrossHistory(currentVersion.rows, source.versions, 'VCB')[0].issues.join(';'), /Document ID khác/);

  const saved = {...source, versions: [april]};
  assert.deepEqual(conflictingLocalTransactionPeriods(saved, currentVersion.rows, '08.2026', months), []);
  assert.deepEqual(compareAccountsAcrossHistory(currentVersion.rows, saved.versions, 'VCB')[0].issues, []);
});

test('saved historical months missing in cloud are reported; generated and future months are excluded', () => {
  const currentVersion = version('2026-08');
  const months = {
    '2026-03': {...cached(version('2026-03')), activity: {...savedActivity, lastAction: 'generated' as const}},
    '2026-04': cached(version('2026-04')),
    '2026-08': cached(version('2026-08', 'STALE-CACHE')),
    '2026-09': cached(version('2026-09')),
  };
  assert.deepEqual(conflictingLocalTransactionPeriods({currentVersion, versions: []}, currentVersion.rows, '08.2026', months), ['2026-04']);
  assert.deepEqual(conflictingLocalTransactionPeriods({currentVersion, versions: []}, version('2026-08', 'NEW-ID').rows, '08.2026'), ['2026-08']);
});

test('historical identity resolution updates April cache and survives month navigation without changing August or deductions', () => {
  const app = structuredClone(INITIAL_APP_DATA);
  app.globalMonth = '08.2026';
  app.BankExport = cached(version('2026-08')).table;
  app.TransactionActivity = savedActivity;
  app.TransactionMonthCache = {activePeriod: '2026-08', months: {
    '2026-04': cached(version('2026-04', 'OLD-ID')),
    '2026-05': cached(version('2026-05')),
  }};
  const original = structuredClone(app);
  const april = version('2026-04');
  const next = applyLocalTransactionVersions(app, [april]);

  assert.deepEqual(app, original);
  assert.equal(next.BankExport, app.BankExport);
  assert.equal(next.TransactionActivity, app.TransactionActivity);
  assert.equal(next.Sheet1_AE, app.Sheet1_AE);
  assert.equal(next.Hold_AE, app.Hold_AE);
  assert.equal(next.Bank_North_AE, app.Bank_North_AE);
  assert.equal(next.TransactionMonthCache!.months['2026-05'], app.TransactionMonthCache.months['2026-05']);
  const reopened = syncReportingMonthReconciliation(next, '04.2026');
  assert.deepEqual(reopened.BankExport.data, april.rows);
  assert.equal(reopened.TransactionActivity?.lastAction, 'saved');
  assert.deepEqual(syncReportingMonthReconciliation(reopened, '08.2026').BankExport.data, app.BankExport.data);
});

test('a multi-month save applies every verified version and keeps the active month selected', () => {
  const app = structuredClone(INITIAL_APP_DATA);
  app.globalMonth = '08.2026';
  app.BankExport = cached(version('2026-08', 'OLD-ID')).table;
  const april = version('2026-04');
  const august = version('2026-08');
  const next = applyLocalTransactionVersions(app, [april, august]);
  assert.equal(next.globalMonth, '08.2026');
  assert.deepEqual(next.BankExport.data, august.rows);
  assert.deepEqual(next.TransactionMonthCache!.months['2026-04'].table.data, april.rows);
  assert.deepEqual(next.TransactionMonthCache!.months['2026-08'].table.data, august.rows);
  assert.deepEqual(conflictingLocalTransactionPeriods({currentVersion: august, versions: [april]}, next.BankExport.data, '08.2026', next.TransactionMonthCache!.months), []);
});

test('invalid replacement months fail before modifying any local snapshot', () => {
  const app = {...structuredClone(INITIAL_APP_DATA), globalMonth: '08.2026'};
  const original = structuredClone(app);
  const invalid = {...version('2026-04'), rows: [...version('2026-04').rows, ...version('2026-05').rows]};
  assert.throws(() => applyLocalTransactionVersions(app, [version('2026-08'), invalid]), /đúng tháng/);
  assert.deepEqual(app, original);
});
