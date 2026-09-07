import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAccounts, previousPeriod, selectPeriodRows } from '../src/app/lib/utils/transaction-history';

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
