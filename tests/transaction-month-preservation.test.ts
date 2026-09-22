import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_APP_DATA } from '../src/app/constants/initial-data';
import { syncReportingMonthReconciliation } from '../src/app/lib/utils/reconciliation-sync';
import { applyTransactionDraftCellEdit, saveTransactionDraft } from '../src/app/lib/utils/transaction-draft';
import { clearMasterPageData, clearMasterTableData } from '../src/app/lib/utils/data-clear-scopes';

function editedMonth() {
  const app = structuredClone(INITIAL_APP_DATA);
  app.globalMonth = '08.2026';
  app.Bank_North_AE.data = ['08.2026', '09.2026'].map(month => ({
    'Tháng báo cáo': month, 'ID Number': 'OLD-ID', 'Full name': 'NGUYEN VAN AN',
    'Bank Account Number': '0012345678', 'TOTAL PAYMENT': 100_000,
  }));
  const generated = syncReportingMonthReconciliation(app, '08.2026');
  const rows = generated.BankExport.data;
  let draft = applyTransactionDraftCellEdit(rows, null, rows[0], 'Document ID', 'SAVED-ID')!;
  draft = applyTransactionDraftCellEdit(rows, draft, draft.rows[0], 'Beneficiary Account No.', '0099887766')!;
  draft = applyTransactionDraftCellEdit(rows, draft, draft.rows[0], 'Payment Amount', 120_000)!;
  return saveTransactionDraft(generated, draft)!;
}

test('automatic month reconciliation cannot replace a saved Transaction with the Bank AE source', () => {
  const saved = editedMonth();
  const reopened = syncReportingMonthReconciliation(structuredClone(saved), '08.2026');
  assert.deepEqual(reopened.BankExport.data, saved.BankExport.data);
  assert.deepEqual(reopened.TransactionActivity, saved.TransactionActivity);
});

test('changing month and returning restores the exact saved rows, identities, amounts and activity', () => {
  const saved = editedMonth();
  const september = syncReportingMonthReconciliation({...saved, globalMonth: '09.2026'}, '09.2026');
  assert.equal(september.BankExport.data[0]['Tháng báo cáo'], '09.2026');
  const returned = syncReportingMonthReconciliation({...september, globalMonth: '08.2026'}, '08.2026');
  assert.deepEqual(returned.BankExport.data, saved.BankExport.data);
  assert.deepEqual(returned.TransactionActivity, saved.TransactionActivity);
});

test('an intentionally emptied Transaction month does not restore deleted rows when revisited', () => {
  const saved = editedMonth();
  const emptied = {...saved, BankExport: {...saved.BankExport, data: []}};
  const september = syncReportingMonthReconciliation(emptied, '09.2026');
  const returned = syncReportingMonthReconciliation(september, '08.2026');
  assert.deepEqual(returned.BankExport.data, []);
});

test('a month without Bank AE source cannot display the previous month and preserves it on return', () => {
  const saved = editedMonth();
  const october = syncReportingMonthReconciliation(saved, '10.2026');
  assert.equal(october.globalMonth, '10.2026');
  assert.deepEqual(october.BankExport.data, []);
  assert.deepEqual(syncReportingMonthReconciliation(october, '08.2026').BankExport.data, saved.BankExport.data);
});

test('explicit Transaction and Master clears discard retained month snapshots', () => {
  const saved = syncReportingMonthReconciliation(editedMonth(), '09.2026');
  assert.equal(clearMasterTableData(saved, 'BankExport').TransactionMonthCache, undefined);
  assert.equal(clearMasterPageData(saved).TransactionMonthCache, undefined);
});

test('an untouched generated month can still refresh from updated Bank AE source', () => {
  const app = structuredClone(INITIAL_APP_DATA);
  app.Bank_North_AE.data = [{'Tháng báo cáo': '08.2026', 'Bank Account Number': '0012345678', 'TOTAL PAYMENT': 100_000}];
  const generated = syncReportingMonthReconciliation(app, '08.2026');
  generated.Bank_North_AE.data = [{'Tháng báo cáo': '08.2026', 'Bank Account Number': '0099887766', 'TOTAL PAYMENT': 120_000}];
  const refreshed = syncReportingMonthReconciliation(generated, '08.2026');
  assert.equal(refreshed.BankExport.data[0]['Beneficiary Account No.'], '0099887766');
  assert.equal(refreshed.BankExport.data[0]['Payment Amount'], 120_000);
});
