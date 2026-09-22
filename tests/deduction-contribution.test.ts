import assert from "node:assert/strict";
import test from "node:test";
import { calculateReconciliationTotals, getDeductionReportEntry } from "../src/app/lib/utils/reconciliation-sync";
import { processBulkPaymentTotals } from "../src/app/lib/utils/payment-processor";
import { parseMonthPeriod } from "../src/app/lib/utils/bulk-payment-analytics";
import { removeVietnameseTones } from "../src/app/lib/utils/data-utils";

const row = (values: Record<string, unknown>) => ({
  "Tháng báo cáo": "09.2026", "Tháng phát sinh": "09.2026", BU: "AHN", ...values,
});
const deductions = [
  row({ "Nghiệp vụ": "HOLD", "TOTAL PAYMENT": 100 }),
  row({ "Nghiệp vụ": "ADD", "Sheet Source": "HOLD", "TOTAL PAYMENT": -20 }),
  row({ "Nghiệp vụ": "A", "Sheet Source": "CANCEL", "Tháng phát sinh": "08.2026", "TOTAL PAYMENT": -40 }),
  row({ "Nghiệp vụ": "CANCEL", "TOTAL PAYMENT": -500 }),
  row({ "Nghiệp vụ": "C", "Sheet Source": "ADD", "Tháng phát sinh": "08.2026", "TOTAL PAYMENT": 900 }),
];

test("CANCEL amounts remain visible for current and previous occurrence months but contribute zero", () => {
  for (const item of deductions.slice(3)) {
    const entry = getDeductionReportEntry(item, "09.2026");
    assert.equal(entry?.type, "CANCEL");
    assert.ok(entry && entry.amount < 0);
    assert.equal(entry?.contribution, 0);
  }
});

test("report period, disabled rows and bonus remain excluded from payroll contributions", () => {
  for (const fields of [{ "Tháng báo cáo": "08.2026" }, { "Lệnh": "-" }, { _dimmed: true }, { "Nghiệp vụ": "BONUS" }]) {
    assert.equal(getDeductionReportEntry(row({ "Nghiệp vụ": "ADD", "TOTAL PAYMENT": 10, ...fields }), "09.2026"), null);
  }
  assert.equal(getDeductionReportEntry(row({ "NGHIỆP VỤ": "ADD", "Sheet Source": "HOLD", "TOTAL PAYMENT": -10 }), "09.2026")?.contribution, 10);
});

test("reconciliation and bank totals agree on Nghiệp vụ ADD and display-only CANCEL", () => {
  const sheet1Rows = [row({ "ID Number": "EMP1", "Business": "AHN", "TOTAL PAYMENT": 1000 })];
  const data = {
    Sheet1_AE: { headers: [], data: sheet1Rows }, Hold_AE: { headers: [], data: deductions },
    Bank_North_AE: { headers: [], data: [row({ "TOTAL PAYMENT": 960 })] },
  };
  const totals = calculateReconciliationTotals(data, "09.2026");
  assert.equal(totals.deductionsTotal, -40);
  assert.equal(totals.expected, 960);
  assert.equal(totals.variance, 0);
  const bank = processBulkPaymentTotals({
    bankType: "BANK_NORTH", sheet1Rows, holdRows: deductions, globalMonth: "09.2026",
    currentMonthNum: 9, currentYearNum: 2026, targetMonthLabelComp: "09.2026",
    monMatchComp: value => parseMonthPeriod(value)?.month === 9 ? "09.2026" : "08.2026",
    isMonthInStrComp: () => true, isSameMonthForSumIf: () => true, isPastMonthHold: () => false,
    removeVietnameseTones,
  });
  assert.equal(bank.holdTotal, -40);
  assert.equal(bank.grandTotal, totals.expected);
  assert.equal(bank.buBreakdown.AHN.total, totals.expected);
});
