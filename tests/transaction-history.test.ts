import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalTransactionHeaders, compareAccounts, formatHistoryDate, previousPeriod, selectPeriodRows, visibleHistoricalComparisons } from '../src/app/lib/utils/transaction-history';

const row = (id = '001', account = '001234', name = 'Employee One', month = '01.2026') => ({
  'Document ID': id, 'Beneficiary Account No.': account, 'Beneficiary Name': name, 'Tháng báo cáo': month,
});
test('previous month crosses year boundary and rejects invalid periods', () => {
  assert.equal(previousPeriod('01.2026'), '2025-12');
  assert.equal(previousPeriod('12/2026'), '2026-11');
  assert.throws(() => previousPeriod('13.2026'));
});
test('snapshots select the full month, omit totals and reject missing/invalid periods', () => {
  assert.equal(selectPeriodRows([row(), row('002', '02', 'Two', '12.2025'), {_isTotalRow: true}], '01.2026').length, 1);
  assert.throws(() => selectPeriodRows([row('1', '2', 'Name', '')], '01.2026'));
  assert.throws(() => selectPeriodRows([row('1', '2', 'Name', '13.2026')], '01.2026'));
  assert.throws(() => selectPeriodRows([], '01.2026'));
});
test('snapshots canonicalize legacy ID Number as Transaction Document ID', () => {
  const legacy = {
    ...row(),
    'Document ID': '',
    'ID Number': ' LEGACY-001 ',
  };
  const [selected] = selectPeriodRows([legacy], '01.2026');
  assert.equal(selected['Document ID'], 'LEGACY-001');
  assert.deepEqual(
    canonicalTransactionHeaders(['Payment Serial Number', 'ID Number', 'Document ID']),
    ['Payment Serial Number', 'Document ID'],
  );
});
test('ID-only matching preserves leading zeros and reports account and name changes separately', () => {
  const results = compareAccounts([row('001', '1234', 'New Name')], [row()]);
  assert.deepEqual(results[0].issues, ['STK khác', 'Tên khác']);
  assert.equal(results[0].previousAccount, '001234');
  assert.deepEqual(compareAccounts([row('NEW')], [row()])[0].issues, ['Không có ID ở tháng trước']);
});
test('normalizes names and IDs but never guesses conflicting duplicate identities', () => {
  assert.deepEqual(compareAccounts([row(' ab ', '001234', ' employee   ONE ')], [row('AB')])[0].issues, []);
  assert.deepEqual(compareAccounts([row(), row()], [row(), row()]).map(r => r.issues), [[], []]);
  assert.deepEqual(compareAccounts([row()], [row(), row('001', '001234', ' employee   ONE ')])[0].issues, []);
  assert.ok(compareAccounts([row()], [row(), row('001', '999')])[0].issues.includes('ID mâu thuẫn tháng trước'));
  assert.ok(compareAccounts([row(), row('001', '999')], [row()])[0].issues.includes('ID mâu thuẫn tháng này'));
});
test('missing fields and absent month history are not marked matched', () => {
  assert.ok(compareAccounts([row('', '')], null)[0].issues.includes('Thiếu Document ID'));
  assert.ok(compareAccounts([row()], null)[0].issues.includes('Chưa có dữ liệu tháng trước'));
  assert.ok(compareAccounts([row()], [row('001', '')])[0].issues.includes('Thiếu STK tháng trước'));
});

import { compareAccountsAcrossHistory } from '../src/app/lib/utils/transaction-history';
const snapshot = (period: string, rows: ReturnType<typeof row>[], id = period) => ({ id, period: `${period}-01`, rows, created_at: '2026-09-07T00:00:00Z' });

test('all-month check finds an ID in January even when absent in July', () => {
  const unrelated = row('OTHER', '007777', 'Other Employee');
  const result = compareAccountsAcrossHistory([row()], [snapshot('2026-01', [row()]), snapshot('2026-07', [unrelated])]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].issues, []);
  assert.equal(result[0].sources[0].period, '2026-01');
});
test('all-month check treats saved ID Number and current Document ID as the same field', () => {
  const legacyHistoryRow = {
    ...row(),
    'Document ID': '',
    'ID Number': '001',
  };
  const result = compareAccountsAcrossHistory(
    [row()],
    [snapshot('2026-01', [legacyHistoryRow] as ReturnType<typeof row>[])],
  );
  assert.deepEqual(result[0].issues, []);
  assert.equal(result[0].previousDocumentId, '001');
  assert.equal(result[0].sources[0].documentId, '001');
});
test('all-month check reports a changed Document ID for the same name and bank account', () => {
  const result = compareAccountsAcrossHistory(
    [row('NEW-001')],
    [snapshot('2026-01', [row('OLD-001')], '1')],
  );
  assert.equal(result[0].previousDocumentId, 'OLD-001');
  assert.equal(result[0].documentId, 'NEW-001');
  assert.deepEqual(result[0].issues, [
    '2026-01 (#1): Document ID khác (OLD-001 → NEW-001)',
  ]);
});
test('matching latest month cannot hide an account difference in an older month', () => {
  const result = compareAccountsAcrossHistory([row()], [snapshot('2026-01', [row('001', '999')], '1'), snapshot('2026-07', [row()], '8')]);
  assert.deepEqual(result[0].issues, ['2026-01 (#1): STK khác']);
  assert.equal(result[0].sources.length, 2);
  assert.equal(result[0].sources[1].versionId, '8');
});
test('historical changes across months are differences, conflicting duplicates within a month remain ambiguous', () => {
  const result = compareAccountsAcrossHistory([row()], [snapshot('2026-01', [row(), row('001', '999')], '2')]);
  assert.deepEqual(result[0].issues, ['2026-01 (#2): ID mâu thuẫn tháng nguồn']);
});
test('absent history and identity never count as matched', () => {
  assert.deepEqual(compareAccountsAcrossHistory([row()], [])[0].issues, ['Chưa có lịch sử trước tháng đang chọn']);
  assert.deepEqual(compareAccountsAcrossHistory([row()], [snapshot('2026-01', [row('OTHER', '007777', 'Other Employee')])])[0].issues, ['Không có ID trong các tháng đã lưu']);
  assert.ok(compareAccountsAcrossHistory([row('', '')], [snapshot('2026-01', [row()])])[0].issues.includes('Thiếu Document ID'));
});
test('reconcile display hides IDs absent from every saved month', () => {
  const comparisons = compareAccountsAcrossHistory(
    [row(), row('NEW', '008888', 'New Employee')],
    [snapshot('2026-01', [row()])],
  );

  assert.deepEqual(
    visibleHistoricalComparisons(comparisons).map(result => result.documentId),
    ['001'],
  );
});
test('saved-source dates use the compact DD/MM/YY format', () => {
  assert.equal(formatHistoryDate('2026-09-07T06:59:37.849758+00:00'), '07/09/26');
  assert.equal(formatHistoryDate('not-a-date'), 'not-a-date');
  assert.equal(formatHistoryDate(''), '');
});
