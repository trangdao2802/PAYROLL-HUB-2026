import assert from "node:assert/strict";
import test from "node:test";
import type { AppData } from "../src/app/types";
import {
  applyTransactionDraftCellEdit,
  saveTransactionDraft,
} from "../src/app/lib/utils/transaction-draft";
import { applyTransactionReferenceSync } from "../src/app/lib/utils/transaction-reference-sync";

const savedRows = [
  {
    id: "tx-1",
    "Payment Serial Number": 1,
    "Document ID": "001",
    "Beneficiary Account No.": "OLD-ACCOUNT",
  },
];

const appData = {
  BankExport: { headers: [], data: savedRows },
  TransactionActivity: {
    generatedAt: "2026-09-08T08:00:00.000Z",
    lastSavedAt: "2026-09-08T09:00:00.000Z",
    editCount: 2,
    saveVersion: 4,
    lastAction: "saved",
  },
} as AppData;

test("Transaction edits stay in a draft until Save is pressed", () => {
  const draft = applyTransactionDraftCellEdit(
    savedRows,
    null,
    { ...savedRows[0] },
    "Beneficiary Account No.",
    "NEW-ACCOUNT",
  );

  assert.equal(draft?.rows[0]["Beneficiary Account No."], "NEW-ACCOUNT");
  assert.equal(draft?.editCount, 1);
  assert.equal(
    appData.BankExport.data[0]["Beneficiary Account No."],
    "OLD-ACCOUNT",
    "Reconcile and Sync must still see the last saved Transaction rows",
  );

  const saved = saveTransactionDraft(
    appData,
    draft!,
    "2026-09-08T10:00:00.000Z",
  );

  assert.equal(
    saved?.BankExport.data[0]["Beneficiary Account No."],
    "NEW-ACCOUNT",
  );
  assert.equal(saved?.TransactionActivity?.editCount, 3);
  assert.equal(saved?.TransactionActivity?.saveVersion, 5);
  assert.equal(saved?.TransactionActivity?.lastAction, "saved");
});

test("subsequent cell edits build on the active Transaction draft", () => {
  const first = applyTransactionDraftCellEdit(
    savedRows,
    null,
    savedRows[0],
    "Document ID",
    "002",
  );
  const second = applyTransactionDraftCellEdit(
    savedRows,
    first,
    first!.rows[0],
    "Beneficiary Account No.",
    "NEW-ACCOUNT",
  );

  assert.equal(second?.rows[0]["Document ID"], "002");
  assert.equal(second?.rows[0]["Beneficiary Account No."], "NEW-ACCOUNT");
  assert.equal(second?.editCount, 2);
});

test("a stale Transaction draft cannot overwrite a newer saved source", () => {
  const draft = applyTransactionDraftCellEdit(
    savedRows,
    null,
    savedRows[0],
    "Document ID",
    "002",
  );
  const newerAppData = {
    ...appData,
    BankExport: {
      ...appData.BankExport,
      data: [{ ...savedRows[0], "Document ID": "SERVER-NEW" }],
    },
  };

  assert.equal(saveTransactionDraft(newerAppData, draft!), null);
});

test("Reconcile sync uses the edited Transaction values only after Save", () => {
  const grossRows = [
    {
      "Tháng báo cáo": "09.2026",
      "ID Number": "WRONG-ID",
      "Full name": "NGUYEN VAN A",
      "Bank Account Number": "OLD-ACCOUNT",
      "TOTAL PAYMENT": 100_000,
    },
  ];
  const transactionRows = [
    {
      id: "tx-sync",
      "Payment Serial Number": 1,
      "Tháng báo cáo": "09.2026",
      "Document ID": "SAVED-ID",
      "Beneficiary Name": "NGUYEN VAN A",
      "Beneficiary Account No.": "OLD-ACCOUNT",
      "Payment Amount": 100_000,
    },
  ];
  const sourceAppData = {
    ...appData,
    BankExport: { ...appData.BankExport, data: transactionRows },
  };
  const draft = applyTransactionDraftCellEdit(
    transactionRows,
    null,
    transactionRows[0],
    "Document ID",
    "EDITED-ID",
  )!;

  const beforeSave = applyTransactionReferenceSync({
    grossRows,
    deductionRows: [],
    transactionRows: sourceAppData.BankExport.data,
    reportMonth: "09.2026",
  });
  assert.equal(beforeSave.grossRows[0]["ID Number"], "SAVED-ID");

  const saved = saveTransactionDraft(sourceAppData, draft)!;
  const afterSave = applyTransactionReferenceSync({
    grossRows,
    deductionRows: [],
    transactionRows: saved.BankExport.data,
    reportMonth: "09.2026",
  });
  assert.equal(afterSave.grossRows[0]["ID Number"], "EDITED-ID");
});

test('saved account edits remain authoritative when duplicate IDs trigger Raw Timesheet repair', () => {
  const rows = [
    {id: 'a', 'Document ID': 'DUPLICATE', 'ID Number': 'DUPLICATE', 'Beneficiary Name': 'NGUYEN VAN AN', 'Beneficiary Account No.': '001234'},
    {id: 'b', 'Document ID': 'DUPLICATE', 'Beneficiary Name': 'TRAN VAN BINH', 'Beneficiary Account No.': '005678'},
  ];
  const draft = applyTransactionDraftCellEdit(rows, null, rows[0], 'Beneficiary Account No.', '009999')!;
  const saved = saveTransactionDraft({...appData, BankExport: {headers: [], data: rows}}, draft)!;
  const result = applyTransactionReferenceSync({
    transactionRows: saved.BankExport.data,
    grossRows: [{'ID Number': 'DUPLICATE', 'Full name': 'NGUYEN VAN AN', 'Bank Account Number': '001234'}],
    deductionRows: [],
    rawTimesheetRows: [{'ID Number': 'RAW-ID', 'Full name': 'NGUYEN VAN AN', 'Bank Account Number': '001234'}],
  });
  assert.equal(result.transactionRows[0]['Beneficiary Account No.'], '009999');
  assert.equal(result.grossRows[0]['Bank Account Number'], '009999');
});

test('editing Document ID updates legacy aliases before the saved values are used by sync', () => {
  const rows = [{...savedRows[0], 'ID Number': 'OLD-ID'}];
  const draft = applyTransactionDraftCellEdit(rows, null, rows[0], 'Document ID', 'NEW-ID')!;
  const saved = saveTransactionDraft({...appData, BankExport: {headers: [], data: rows}}, draft)!;
  assert.equal(saved.BankExport.data[0]['ID Number'], 'NEW-ID');
});
