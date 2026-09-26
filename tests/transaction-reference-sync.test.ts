import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyBulkReconciliationReferenceSync,
  applyTransactionReferenceSync,
  hasPendingReconciliationReferenceSync,
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

test("Transaction sync copies ID, name, and bank account to both target tables", () => {
  const grossRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "OLD-ID-A",
      "Full name": "NGUYEN VAN A",
      "Bank Account Number": "ACC-A",
      "TOTAL PAYMENT": 100_000,
    },
  ];
  const deductionRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "ID-B",
      "Full name": "OLD NAME B",
      "Bank Account Number": "",
      "TOTAL PAYMENT": -50_000,
      "Nghiệp vụ": "HOLD",
    },
  ];
  const transactionRows = [
    {
      id: "tx-a",
      "Tháng báo cáo": month,
      "Payment Serial Number": 1,
      "Document ID": "ID-A",
      "Beneficiary Name": "NGUYEN VAN A",
      "Beneficiary Account No.": "ACC-A",
      "Payment Amount": 100_000,
    },
    {
      id: "tx-b",
      "Tháng báo cáo": month,
      "Payment Serial Number": 2,
      "Document ID": "ID-B",
      "Beneficiary Name": "TRAN THI B",
      "Beneficiary Account No.": "ACC-B",
      "Payment Amount": 50_000,
    },
  ];

  const result = applyTransactionReferenceSync({
    grossRows,
    deductionRows,
    transactionRows,
    // The Transaction table is authoritative for this direction of sync.
    rawTimesheetRows: [],
    reportMonth: month,
  });

  assert.equal(result.grossRows[0]["ID Number"], "ID-A");
  assert.equal(result.deductionRows[0]["Full name"], "TRAN THI B");
  assert.equal(
    result.deductionRows[0]["Bank Account Number"],
    "ACC-B",
  );
  assert.equal(result.correctedCells, 3);
  assert.equal(result.transactionCorrectedCells, 0);
  assert.deepEqual(result.transactionRows, transactionRows);
});

test("Deductions target-only sync never mutates Batch Payment or Gross Pay", () => {
  const grossRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "ID-A",
      "Full name": "WRONG GROSS NAME",
      "Bank Account Number": "WRONG-GROSS-ACC",
      "TOTAL PAYMENT": 100_000,
    },
  ];
  const deductionRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "ID-A",
      "Full name": "WRONG DEDUCTION NAME",
      "Bank Account Number": "WRONG-DEDUCTION-ACC",
      "TOTAL PAYMENT": -10_000,
      "Nghiệp vụ": "Hold",
    },
  ];
  const transactionRows = [
    {
      id: "tx-confirmed",
      "Tháng báo cáo": month,
      "Document ID": "ID-A",
      "Beneficiary Name": "CONFIRMED NAME",
      "Beneficiary Account No.": "CONFIRMED-ACC",
      "Payment Amount": 90_000,
      "Payment details": "CONFIRMED PAYMENT DATA",
      _paymentAudit: { source: "batch-payment" },
    },
  ];
  const rawTimesheetRows = [
    {
      "ID NUMBER": "RAW-ID",
      "FULL NAME": "RAW NAME",
      "BANK ACCOUNT NUMBER": "RAW-ACC",
    },
  ];

  const result = applyTransactionReferenceSync({
    targetTable: "Hold_AE",
    grossRows,
    deductionRows,
    transactionRows,
    rawTimesheetRows,
    reportMonth: month,
  });

  assert.deepEqual(result.transactionRows, transactionRows);
  assert.deepEqual(result.grossRows, grossRows);
  assert.equal(result.transactionCorrectedCells, 0);
  assert.equal(result.deductionRows[0]["ID Number"], "ID-A");
  assert.equal(result.deductionRows[0]["Full name"], "CONFIRMED NAME");
  assert.equal(
    result.deductionRows[0]["Bank Account Number"],
    "CONFIRMED-ACC",
  );
  assert.equal(result.transactionRows[0]["Payment Amount"], 90_000);
  assert.equal(
    result.transactionRows[0]["Payment details"],
    "CONFIRMED PAYMENT DATA",
  );
});

test("one click resolves duplicate Transaction identity from RAWDATA_TIMESHEET", () => {
  const transactionRows = [
    {
      id: "tx-alpha",
      "Tháng báo cáo": month,
      "Document ID": "DUPLICATE-ID",
      "Beneficiary Name": "NGUYEN VAN ALPHA",
      "Beneficiary Account No.": "DUPLICATE-ACCOUNT",
      "Payment Amount": 100_000,
    },
    {
      id: "tx-beta",
      "Tháng báo cáo": month,
      "Document ID": "DUPLICATE-ID",
      "Beneficiary Name": "TRAN THI BETA",
      "Beneficiary Account No.": "DUPLICATE-ACCOUNT",
      "Payment Amount": 200_000,
    },
  ];
  const deductionRows = [
    {
      "Tháng báo cáo": month,
      "ID Number": "DUPLICATE-ID",
      "Full name": "NGUYEN VAN ALPHA",
      "Bank Account Number": "DUPLICATE-ACCOUNT",
      "TOTAL PAYMENT": -10_000,
      "Nghiệp vụ": "Hold",
    },
  ];
  const rawTimesheetRows = [
    {
      "ID NUMBER": "ID-ALPHA",
      "FULL NAME": "NGUYEN VAN ALPHA",
      "BANK ACCOUNT NUMBER": "ACC-ALPHA",
    },
    {
      employeeId: "ID-BETA",
      fullName: "TRAN THI BETA",
      bankAccountNumber: "ACC-BETA",
    },
  ];

  const result = applyTransactionReferenceSync({
    grossRows: [],
    deductionRows,
    transactionRows,
    rawTimesheetRows,
    reportMonth: month,
  });

  assert.equal(result.transactionRows[0]["Document ID"], "ID-ALPHA");
  assert.equal(
    result.transactionRows[0]["Beneficiary Account No."],
    "ACC-ALPHA",
  );
  assert.equal(result.transactionRows[1]["Document ID"], "ID-BETA");
  assert.equal(
    result.transactionRows[1]["Beneficiary Account No."],
    "ACC-BETA",
  );
  assert.equal(result.deductionRows[0]["ID Number"], "ID-ALPHA");
  assert.equal(
    result.deductionRows[0]["Bank Account Number"],
    "ACC-ALPHA",
  );
  assert.equal(result.transactionCorrectedCells, 4);
  assert.equal(result.correctedCells, 6);

  const secondPass = applyTransactionReferenceSync({
    grossRows: result.grossRows,
    deductionRows: result.deductionRows,
    transactionRows: result.transactionRows,
    rawTimesheetRows,
    reportMonth: month,
  });
  assert.equal(secondPass.correctedCells, 0);
});

test("missing Transaction fields are written to its existing bank columns", () => {
  const result = applyTransactionReferenceSync({
    grossRows: [],
    deductionRows: [],
    transactionRows: [
      {
        "Tháng báo cáo": month,
        "Document ID": "ID-01",
        "Beneficiary Name": "LE THI GAMMA",
        "Beneficiary Account No.": "",
      },
    ],
    rawTimesheetRows: [
      {
        "ID NUMBER": "ID-01",
        "FULL NAME": "LE THI GAMMA",
        "BANK ACCOUNT NUMBER": "ACC-01",
      },
    ],
    reportMonth: month,
  });

  assert.equal(
    result.transactionRows[0]["Beneficiary Account No."],
    "ACC-01",
  );
  assert.equal("Bank Account Number" in result.transactionRows[0], false);
});

test("shared Reconciliation sync updates Gross Pay and Deductions and clears pending state", () => {
  const grossRows = [{
    "Tháng báo cáo": "03.2026",
    "ID Number": "ID-001",
    "Full name": "WRONG GROSS",
    "Bank Account Number": "ACC-001",
  }];
  const deductionRows = [{
    "Tháng báo cáo": "03.2026",
    "ID Number": "ID-001",
    "Full name": "WRONG DEDUCTION",
    "Bank Account Number": "ACC-001",
  }];
  const transactionRows = [{
    "Tháng báo cáo": "03.2026",
    "Document ID": "ID-001",
    "Beneficiary Name": "RIGHT NAME",
    "Beneficiary Account No.": "ACC-001",
  }];

  assert.equal(hasPendingReconciliationReferenceSync({
    grossRows, deductionRows, transactionRows, reportMonth: "03.2026",
  }), true);

  const result = applyBulkReconciliationReferenceSync({
    grossRows, deductionRows, transactionRows, reportMonth: "03.2026",
  });
  assert.equal(result.grossRows[0]["Full name"], "RIGHT NAME");
  assert.equal(result.deductionRows[0]["Full name"], "RIGHT NAME");
  assert.ok(result.correctedCells >= 2);
  assert.equal(hasPendingReconciliationReferenceSync({
    grossRows: result.grossRows,
    deductionRows: result.deductionRows,
    transactionRows,
    reportMonth: "03.2026",
  }), false);
});

test("bulk sync is available in Deductions and persists immediately", () => {
  const deductions = readFileSync(
    new URL(
      "../src/app/pages/03-master/components/HoldAETable.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const reconcile = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );
  const context = readFileSync(
    new URL("../src/app/lib/contexts/AppDataContext.tsx", import.meta.url),
    "utf8",
  );

  assert.match(deductions, /Đồng bộ từ Reconcile/);
  assert.match(deductions, /handleBulkSyncFromReconcile/);
  assert.match(deductions, /applyBulkReconciliationReferenceSync/);
  assert.match(reconcile, /applyBulkReconciliationReferenceSync/);
  assert.match(reconcile, /hasPendingReconciliationReferenceSync/);
  assert.match(context, /persistImmediately \? 0 : 3000/);
});

test("Reconciliation row sync and bulk lightning sync share the same authoritative Batch Payment direction", () => {
  const bulkPayment = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );
  const deductions = readFileSync(
    new URL("../src/app/pages/03-master/components/HoldAETable.tsx", import.meta.url),
    "utf8",
  );

  const rowStart = bulkPayment.indexOf("const handleAutoFillMissingAccount");
  const rowEnd = bulkPayment.indexOf("const handleApplyTransactionHistoryVersions", rowStart);
  const rowHandler = bulkPayment.slice(rowStart, rowEnd);

  const bulkStart = bulkPayment.indexOf("const handleSyncTransactionFieldsToTables");
  const bulkEnd = bulkPayment.indexOf("const reconcileTotals", bulkStart);
  const bulkHandler = bulkPayment.slice(bulkStart, bulkEnd);

  assert.ok(rowStart >= 0 && rowEnd > rowStart);
  assert.ok(bulkStart >= 0 && bulkEnd > bulkStart);

  assert.match(rowHandler, /rawTimesheetRows:\s*\[\]/);
  assert.doesNotMatch(rowHandler, /Timesheet_Roster|Q_Staff/);
  assert.doesNotMatch(rowHandler, /BankExport:\s*\{/);
  assert.doesNotMatch(rowHandler, /Bank_North_AE:\s*\{/);
  assert.doesNotMatch(rowHandler, /markTransactionSaved/);

  assert.match(bulkHandler, /applyBulkReconciliationReferenceSync/);
  assert.doesNotMatch(bulkHandler, /BankExport:\s*\{/);
  assert.doesNotMatch(bulkHandler, /Bank_North_AE:\s*\{/);
  assert.doesNotMatch(bulkHandler, /markTransactionSaved/);

  assert.equal(
    (bulkPayment.match(/onClick=\{handleSyncTransactionFieldsToTables\}/g) || []).length,
    2,
    "settings menu and glowing lightning icon must call the same bulk handler",
  );
  assert.match(bulkPayment, /handleAutoFillMissingAccount\(item\)/);

  assert.match(deductions, /applyBulkReconciliationReferenceSync/);
  assert.match(deductions, /Sheet1_AE:\s*\{ \.\.\.prev\.Sheet1_AE, data: result\.grossRows \}/);
  assert.match(deductions, /Hold_AE:\s*\{ \.\.\.prev\.Hold_AE, data: result\.deductionRows \}/);
  assert.doesNotMatch(deductions, /targetTable:\s*"Hold_AE"/);
});

test("shared bulk Reconciliation sync repeats Process Sync sequentially and clears both UI pending states", () => {
  const source = readFileSync(
    new URL("../src/app/lib/utils/transaction-reference-sync.ts", import.meta.url),
    "utf8",
  );
  const bulkPayment = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );
  const deductions = readFileSync(
    new URL("../src/app/pages/03-master/components/HoldAETable.tsx", import.meta.url),
    "utf8",
  );

  const start = source.indexOf("export function applyBulkReconciliationReferenceSync");
  const end = source.indexOf("export function getTransactionReferenceAudit", start);
  const handler = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(handler, /for \(const transactionKey of pendingTransactionKeys\)/);
  assert.match(handler, /transactionKeys:\s*\[transactionKey\]/);
  assert.match(handler, /nextGrossRows = result\.grossRows/);
  assert.match(handler, /nextDeductionRows = result\.deductionRows/);
  assert.match(bulkPayment, /hasPendingReconciliationReferenceSync/);
  assert.match(deductions, /hasPendingReconciliationReferenceSync/);
  assert.match(deductions, /disabled=\{!pendingSync\}/);
  assert.match(bulkPayment, /Các dòng đã khớp sẽ tự biến mất khỏi danh sách cần xử lý/);
});

test("both Reconciliation sync entry points apply the same Gross Pay and Deductions state write", () => {
  const bulkPayment = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );
  const deductions = readFileSync(
    new URL("../src/app/pages/03-master/components/HoldAETable.tsx", import.meta.url),
    "utf8",
  );

  const bulkStart = bulkPayment.indexOf("const handleSyncTransactionFieldsToTables");
  const bulkEnd = bulkPayment.indexOf("const reconcileTotals", bulkStart);
  const bulkHandler = bulkPayment.slice(bulkStart, bulkEnd);
  const deductionStart = deductions.indexOf("const handleBulkSyncFromReconcile");
  const deductionEnd = deductions.indexOf("const handleExportExcel", deductionStart);
  const deductionHandler = deductions.slice(deductionStart, deductionEnd);

  assert.ok(bulkStart >= 0 && bulkEnd > bulkStart);
  assert.ok(deductionStart >= 0 && deductionEnd > deductionStart);
  assert.match(bulkHandler, /applyBulkReconciliationReferenceSync/);
  assert.match(deductionHandler, /applyBulkReconciliationReferenceSync/);
  assert.match(bulkHandler, /Sheet1_AE:\s*\{ \.\.\.prev\.Sheet1_AE, data: result\.grossRows \}/);
  assert.match(bulkHandler, /Hold_AE:\s*\{ \.\.\.prev\.Hold_AE, data: result\.deductionRows \}/);
  assert.match(deductionHandler, /Sheet1_AE:\s*\{ \.\.\.prev\.Sheet1_AE, data: result\.grossRows \}/);
  assert.match(deductionHandler, /Hold_AE:\s*\{ \.\.\.prev\.Hold_AE, data: result\.deductionRows \}/);
  assert.doesNotMatch(bulkHandler, /setSyncSaveRequest/);
});

test("Transaction table exposes authoritative identity sync action", () => {
  const bulkPayment = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );

  assert.match(bulkPayment, /handleSyncTransactionFieldsToTables/);
  assert.match(bulkPayment, /Đồng bộ Tên · STK · ID/);
  assert.match(bulkPayment, /rawTimesheetRows: \[\]/);
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
