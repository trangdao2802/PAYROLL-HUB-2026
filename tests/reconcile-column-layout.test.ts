import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAccountsAcrossHistory, type TransactionRow } from '../src/app/lib/utils/transaction-history';
import { financialColumnLayout, financialSharedValues, historyColumnLayout, historyFieldValues } from '../src/app/lib/utils/reconcile-column-layout';

const row = (overrides: TransactionRow = {}): TransactionRow => ({
  'Document ID': '000123', 'Beneficiary Account No.': '0012345678', 'Beneficiary Name': 'NGUYEN VAN AN', ...overrides,
});
const compare = (current: TransactionRow[], historical: TransactionRow[][]) => compareAccountsAcrossHistory(current,
  historical.map((rows, index) => ({id: String(index + 1), period: `2026-0${index + 1}`, created_at: '2026-09-08', rows})), 'VCB');

test('name-only differences need one ID, one account and two name columns', () => {
  const comparisons = compare([row()], [[row({'Beneficiary Name': 'NGUYEN VAN BINH'})]]);
  assert.deepEqual(historyColumnLayout(comparisons).map(column => [column.key, column.split]), [
    ['documentId', false], ['account', false], ['name', true],
  ]);
  assert.equal(historyColumnLayout(comparisons).reduce((count, column) => count + (column.split ? 2 : 1), 2), 6);
});

test('shared history values are grouped once while retaining every source', () => {
  const comparison = compare([row()], [[row({'Beneficiary Name': 'NGUYEN VAN BINH'})], [row({'Beneficiary Name': 'Nguyễn Văn Bình'})]])[0];
  const field = historyFieldValues(comparison, 'name');
  assert.equal(field.history.length, 1);
  assert.deepEqual(field.history[0].sources.map(source => source.versionId), ['1', '2']);
  assert.equal(field.different, true);
});

test('account and ID comparisons preserve leading zero differences and conflicting source values', () => {
  const comparisons = compare([row()], [[row({'Beneficiary Account No.': '12345678'})]]);
  assert.equal(historyColumnLayout(comparisons)[1].split, true);
  const idComparison = compare([row()], [[row({'Document ID': '123'})]])[0];
  assert.equal(historyFieldValues(idComparison, 'documentId').different, true);
  const multiple = compare([row()], [[row(), row({'Beneficiary Account No.': '8888888888'})]])[0];
  assert.equal(historyFieldValues(multiple, 'account').different, true);
  assert.equal(historyFieldValues(multiple, 'account').history[0].value, '0012345678 | 8888888888');
});

test('missing values remain visible without treating an absent history as a match', () => {
  const missing = compare([row()], [[row({'Beneficiary Account No.': ''})]])[0];
  assert.equal(historyFieldValues(missing, 'account').different, true);
  assert.equal(historyFieldValues(missing, 'account').history[0].value, '');
  const noHistory = compare([row()], [])[0];
  assert.equal(historyFieldValues(noHistory, 'account').hasHistory, false);
  assert.equal(historyFieldValues(noHistory, 'account').current, '0012345678');
  assert.deepEqual(historyColumnLayout([noHistory]).map(column => column.split), [false, false, false]);
});

test('a discrepancy on a later page still determines the shared column layout', () => {
  const rows = Array.from({length: 26}, (_, index) => row({'Document ID': 'EMP-' + index, 'Beneficiary Account No.': '870000' + index}));
  const past = rows.map((value, index) => index === 25 ? {...value, 'Beneficiary Account No.': '9999999999'} : value);
  const comparisons = compare(rows, [past]);
  assert.equal(historyColumnLayout(comparisons)[1].split, true);
  assert.equal(historyFieldValues(comparisons[0], 'account').different, false);
});

const financial = {accountNo: '00123', benefitsAccountNo: '00123', actualAmount: 790000, sheet1Amount: 800000, holdAmount: -10000};
test('financial shared account and totals collapse; different values keep both sources', () => {
  assert.deepEqual(financialSharedValues(financial), {account: true, amount: true});
  assert.deepEqual(financialColumnLayout([financial]), {splitAccount: false, splitAmount: false, count: 8, varianceIndex: 5});
  assert.deepEqual(financialColumnLayout([financial, {...financial, benefitsAccountNo: '00124', actualAmount: 790001}]), {
    splitAccount: true, splitAmount: true, count: 10, varianceIndex: 7,
  });
});

test('financial missing source or lost leading zero is not shown as a shared account', () => {
  assert.equal(financialSharedValues({...financial, benefitsAccountNo: ''}).account, false);
  assert.equal(financialSharedValues({...financial, benefitsAccountNo: '123'}).account, false);
  assert.equal(financialSharedValues({...financial, actualAmount: 790000.5}).amount, false);
});
