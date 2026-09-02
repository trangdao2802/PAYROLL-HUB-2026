import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyTransactionReferenceSync,
  buildTransactionReferenceSyncPlan,
  getTransactionReferenceMatchAmounts,
} from "../src/app/lib/utils/transaction-reference-sync";

const month = "04.2026";

test("name plus account assigns same-person Gross rows before conflicting ID", () => {
  const grossRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "001306032451",
      "Full name": "VU QUANG HUY",
      "Bank Account Number": "1028693992",
      "TOTAL PAYMENT": 140_000,
    },
    {
      "Tháng báo cáo": month,
      "ID Number": "001203002118",
      "Full name": "VU QUANG HUY",
      "Bank Account Number": "1028693992",
      "TOTAL PAYMENT": 275_000,
    },
    {
      "Tháng báo cáo": month,
      "ID Number": "001306032451",
      "Full name": "NGUYEN PHUONG LINH",
      "Bank Account Number": "1941310156",
      "TOTAL PAYMENT": 2_115_000,
    },
  ];
  const transactionRows = [
    {
      id: "tx-huy",
      "Tháng báo cáo": month,
      "Document ID": "001203002118",
      "Beneficiary Name": "VU QUANG HUY",
      "Beneficiary Account No.": "1028693992",
      "Payment Amount": 415_000,
    },
    {
      id: "tx-linh",
      "Tháng báo cáo": month,
      "Document ID": "001306032451",
      "Beneficiary Name": "NGUYEN PHUONG LINH",
      "Beneficiary Account No.": "1941310156",
      "Payment Amount": 2_115_000,
    },
  ];

  const plan = buildTransactionReferenceSyncPlan({
    grossRows,
    deductionRows: [],
    transactionRows,
    reportMonth: month,
  });
  const huy = plan.byTransactionIndex.get(0)!;
  const linh = plan.byTransactionIndex.get(1)!;

  assert.deepEqual(huy.grossRowIndexes, [0, 1]);
  assert.deepEqual(linh.grossRowIndexes, [2]);
  assert.equal(huy.reason, "name-account");
  assert.deepEqual(getTransactionReferenceMatchAmounts(huy, grossRows, []), {
    grossAmount: 415_000,
    deductionAmount: 0,
    expectedAmount: 415_000,
  });
  assert.deepEqual(
    huy.corrections.map(({ rowIndex, field, newValue }) => ({
      rowIndex,
      field,
      newValue,
    })),
    [{ rowIndex: 0, field: "idNumber", newValue: "001203002118" }],
  );
});

test("sync copies authoritative Transaction fields and records cell history", () => {
  const correctedAt = "2026-09-02T14:30:00.000Z";
  const grossRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "WRONG-ID",
      "Full name": "VU QUANG HUY",
      "Bank Account Number": "1028693992",
      "TOTAL PAYMENT": 140_000,
    },
  ];
  const transactionRows = [
    {
      id: "tx-1",
      "Payment Serial Number": 8,
      "Tháng báo cáo": month,
      "Document ID": "001203002118",
      "Beneficiary Name": "VU QUANG HUY",
      "Beneficiary Account No.": "1028693992",
      "Payment Amount": 140_000,
    },
  ];
  const plan = buildTransactionReferenceSyncPlan({
    grossRows,
    deductionRows: [],
    transactionRows,
    reportMonth: month,
  });
  const result = applyTransactionReferenceSync({
    grossRows,
    deductionRows: [],
    transactionRows,
    reportMonth: month,
    transactionKeys: [plan.matches[0].transactionKey],
    correctedAt,
  });

  assert.equal(result.grossRows[0]["ID Number"], "001203002118");
  assert.equal(result.correctedRows, 1);
  assert.equal(result.correctedCells, 1);
  assert.deepEqual(result.grossRows[0]._transactionReferenceAudit.idNumber, {
    field: "idNumber",
    fieldLabel: "ID NUMBER",
    oldValue: "WRONG-ID",
    newValue: "001203002118",
    correctedAt,
    targetTable: "Sheet1_AE",
    transactionKey: plan.matches[0].transactionKey,
    transactionIndex: 0,
    transactionRowId: "tx-1",
    transactionSerial: "8",
    transactionId: "001203002118",
    transactionName: "VU QUANG HUY",
    transactionAccount: "1028693992",
  });
});

test("unique ID repairs wrong common fields in Deductions", () => {
  const deductionRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "001203002118",
      "Full name": "WRONG NAME",
      "Bank Account Number": "",
      "TOTAL PAYMENT": -50_000,
      "Nghiệp vụ": "Hold",
    },
  ];
  const transactionRows = [
    {
      "Tháng báo cáo": month,
      "Document ID": "001203002118",
      "Beneficiary Name": "VU QUANG HUY",
      "Beneficiary Account No.": "1028693992",
      "Payment Amount": 365_000,
    },
  ];

  const result = applyTransactionReferenceSync({
    grossRows: [],
    deductionRows,
    transactionRows,
    reportMonth: month,
  });

  assert.equal(result.deductionRows[0]["Full name"], "VU QUANG HUY");
  assert.equal(
    result.deductionRows[0]["Bank Account Number"],
    "1028693992",
  );
  assert.equal(result.correctedCells, 2);
});

test("corrected cells expose audit marker and two-way Transaction navigation", () => {
  const marker = readFileSync(
    new URL("../src/app/components/TransactionReferenceCell.tsx", import.meta.url),
    "utf8",
  );
  const master = readFileSync(
    new URL("../src/app/pages/03-master/MasterAE.tsx", import.meta.url),
    "utf8",
  );
  const transaction = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );

  assert.match(marker, />\s*!\s*</);
  assert.match(marker, /Giá trị cũ/);
  assert.match(marker, /formatCorrectionTime\(audit\.correctedAt\)/);
  assert.match(marker, /Mở ô tham chiếu tại Transaction/);
  assert.match(master, /transaction_reference_return/);
  assert.match(master, /TransactionReferenceCell/);
  assert.match(transaction, /Về \{transactionReferenceReturn\.targetLabel\}/);
  assert.match(transaction, /from: "TransactionReference"/);
});
