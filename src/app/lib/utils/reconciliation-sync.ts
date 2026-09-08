/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AppData } from "../../types";
import {
  generateUUID,
  parseMoneyToNumber,
  removeVietnameseTones,
} from "./data-utils";
import { parseMonthPeriod } from "./bulk-payment-analytics";
import { markTransactionGenerated } from "./transaction-activity";

export interface ReconciliationTotals {
  actual: number;
  expected: number;
  variance: number;
  grossPayTotal: number;
  deductionsTotal: number;
}

type ReconciliationSource = Pick<
  AppData,
  "Sheet1_AE" | "Hold_AE" | "Bank_North_AE"
> & { globalMonth?: string };

function readFirst(row: any, keys: string[]): unknown {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function matchesMonthValue(
  value: unknown,
  reportMonth: string,
  allowMissing: boolean,
): boolean {
  const target = parseMonthPeriod(reportMonth);
  if (!target) return false;
  const raw = String(value ?? "").trim();
  if (!raw) return allowMissing;
  return parseMonthPeriod(raw, target)?.key === target.key;
}

function holdRowMatchesReportMonth(row: any, reportMonth: string): boolean {
  return matchesMonthValue(
    readFirst(row, ["Tháng báo cáo", "_fileMonth", "Tháng", "Month"]),
    reportMonth,
    true,
  );
}

function bankRowMatchesReportMonth(row: any, reportMonth: string): boolean {
  const target = parseMonthPeriod(reportMonth);
  if (!target) return false;
  const fileMonth = String(row?._fileMonth ?? "").trim();
  if (fileMonth && parseMonthPeriod(fileMonth, target)?.key === target.key) {
    return true;
  }
  return matchesMonthValue(
    readFirst(row, ["Tháng báo cáo", "_fileMonth", "Tháng"]),
    reportMonth,
    true,
  );
}

function holdContribution(row: any, reportMonth: string): number {
  if (!holdRowMatchesReportMonth(row, reportMonth)) return 0;

  const command = String(row?.["Lệnh"] || "").trim().toUpperCase();
  if (command === "-" || row?._dimmed) return 0;

  const sheetSource = String(row?.["Sheet Source"] || "").toUpperCase();
  if (
    sheetSource.includes("SHEET 1") ||
    sheetSource.includes("INTERN") ||
    sheetSource.includes("REPORT")
  ) {
    return 0;
  }

  const operation = String(row?.["Nghiệp vụ"] || "").trim().toUpperCase();
  let amount = Math.abs(
    parseMoneyToNumber(
      row?.["TOTAL PAYMENT"] ??
        row?.["Payment Amount"] ??
        row?.["Grand Total"] ??
        row?.["GRAND TOTAL"] ??
        row?.["Total Payment"] ??
        0,
    ),
  );

  const target = parseMonthPeriod(reportMonth);
  if (!target) return 0;
  const occurrenceRaw = readFirst(row, ["Tháng phát sinh", "Trạng thái"]);
  const occurrence = String(occurrenceRaw ?? "").trim()
    ? parseMonthPeriod(occurrenceRaw, target)
    : null;
  const isDifferentMonth = Boolean(occurrence && occurrence.key !== target.key);
  const isPastMonth = Boolean(
    occurrence &&
      (occurrence.year < target.year ||
        (occurrence.year === target.year && occurrence.month < target.month)),
  );

  const operationText = String(row?.["Nghiệp vụ"] || "").toLowerCase();
  const occurrenceText = String(
    row?.["Tháng phát sinh"] || row?.["Trạng thái"] || "",
  ).toLowerCase();
  const paymentStatus = String(
    row?.["Tình trạng thanh toán"] || "",
  ).toLowerCase();
  const isBonus =
    operation === "B" ||
    operation === "BONUS" ||
    sheetSource.includes("BONUS") ||
    sheetSource.includes("SUMMER") ||
    sheetSource.includes("INSTRUCTORS") ||
    operationText.includes("bonus") ||
    operationText.includes("⏯") ||
    operationText.includes("⏩");
  if (isBonus) return 0;

  let isHold = operation === "H";
  let isAdd = operation === "A";
  let isCancel = operation === "C";

  if (!isHold && !isAdd && !isCancel) {
    isCancel =
      operationText.includes("cancel") ||
      occurrenceText.includes("cancel") ||
      sheetSource.toLowerCase().includes("cancel") ||
      paymentStatus.includes("cancel");
    if (!isCancel) {
      isAdd =
        sheetSource.includes("ADD") ||
        (!sheetSource.includes("HOLD") && amount > 0) ||
        operationText.includes("add") ||
        operationText.includes("release");
      isHold = !isAdd;
    }
  }

  if (isHold && isDifferentMonth) amount = 0;
  if (isAdd && !isPastMonth) amount = 0;
  if (isCancel && !isPastMonth) amount = 0;
  return isHold || isCancel ? -amount : amount;
}

export function calculateReconciliationTotals(
  appData: ReconciliationSource,
  reportMonth = appData.globalMonth || "03.2026",
): ReconciliationTotals {
  const grossPayTotal = (appData.Sheet1_AE?.data || []).reduce(
    (sum: number, row: any) => {
      const id = String(
        row?.["ID Number"] || row?.["Mã AE"] || row?.["Mã ae"] || "",
      ).trim();
      if (
        !id ||
        !matchesMonthValue(row?.["Tháng báo cáo"], reportMonth, false)
      ) {
        return sum;
      }
      return (
        sum +
        parseMoneyToNumber(
          row?.["TOTAL PAYMENT"] ??
            row?.["Payment Amount"] ??
            row?.["Grand Total"] ??
            row?.["GRAND TOTAL"] ??
            row?.["Total Payment"] ??
            0,
        )
      );
    },
    0,
  );

  const deductionsTotal = (appData.Hold_AE?.data || []).reduce(
    (sum: number, row: any) => sum + holdContribution(row, reportMonth),
    0,
  );

  const actual = (appData.Bank_North_AE?.data || []).reduce(
    (sum: number, row: any) =>
      bankRowMatchesReportMonth(row, reportMonth)
        ? sum + parseMoneyToNumber(row?.["TOTAL PAYMENT"] ?? 0)
        : sum,
    0,
  );
  const expected = grossPayTotal + deductionsTotal;

  return {
    actual,
    expected,
    variance: actual - expected,
    grossPayTotal,
    deductionsTotal,
  };
}

export function buildBankExportRowsForMonth(
  appData: AppData,
  reportMonth = appData.globalMonth || "03.2026",
): any[] {
  const sourceRows = (appData.Bank_North_AE?.data || []).filter((row: any) =>
    bankRowMatchesReportMonth(row, reportMonth),
  );
  const sheetRows = appData.Sheet1_AE?.data || [];
  const byId = new Map<string, any>();
  const byName = new Map<string, any>();

  sheetRows.forEach((row: any) => {
    const info = {
      bank: String(row?.["Bank Name"] || "").trim(),
      month: String(row?.["Tháng"] || "").trim(),
    };
    const id = String(row?.["ID Number"] || row?.["Mã AE"] || "").trim();
    const name = removeVietnameseTones(row?.["Full name"] || "")
      .trim()
      .toUpperCase();
    if (id) byId.set(id, info);
    if (name) byName.set(name, info);
  });

  return sourceRows.map((row: any, index: number) => {
    const id = String(row?.["ID Number"] || row?.["Mã AE"] || "").trim();
    const name = removeVietnameseTones(row?.["Full name"] || "")
      .trim()
      .toUpperCase();
    const sheetInfo = byId.get(id) || byName.get(name) || {};
    const monthValue = String(
      row?._fileMonth || row?.["Tháng"] || sheetInfo.month || "",
    ).trim();
    const bankValue = String(
      row?._fileBank || sheetInfo.bank || "",
    )
      .trim()
      .toUpperCase();

    return {
      id: generateUUID(),
      "Payment Serial Number": index + 1,
      "Tháng báo cáo": reportMonth,
      "Transaction Type Code": "BT",
      "Payment Type": "",
      "Customer Reference No": "",
      "Beneficiary Account No.": String(row?.["Bank Account Number"] || ""),
      "Beneficiary Name": removeVietnameseTones(row?.["Full name"] || ""),
      "Document ID": String(
        row?.["ID Number"] ||
          row?.["Mã AE"] ||
          row?.["Mã ae"] ||
          row?.["Document ID"] ||
          row?.CCCD ||
          row?.ID ||
          "",
      ),
      "Place of Issue": "",
      "ID Issuance Date": "",
      "Beneficiary Bank Swift Code / IFSC Code": "",
      "Transaction Currency": "VND",
      "Payment Amount": parseMoneyToNumber(row?.["TOTAL PAYMENT"] || 0),
      "Charge Type": "OUR",
      "Payment details": `Intern ${bankValue} salary ${monthValue}`
        .replace(/\s+/g, " ")
        .trim(),
      "Beneficiary - Nick Name": "",
      "Beneficiary Addr. Line 1": "",
      "Beneficiary Addr. Line 2": "",
    };
  });
}

export function syncReportingMonthReconciliation(
  appData: AppData,
  reportMonth: string,
): AppData {
  const normalizedMonth = parseMonthPeriod(reportMonth);
  if (!normalizedMonth) return appData;
  const month = `${String(normalizedMonth.month).padStart(2, "0")}.${normalizedMonth.year}`;
  const generatedAt = new Date().toISOString();
  const totals = calculateReconciliationTotals(appData, month);
  const period = normalizedMonth.key;
  const months = {...appData.TransactionMonthCache?.months};
  const currentTable = appData.BankExport || {headers: [], data: []};
  const groups = new Map<string, any[]>();
  for (const row of currentTable.data) {
    const rowPeriod = parseMonthPeriod(row['Tháng báo cáo'] || row._fileMonth)?.key;
    if (!rowPeriod) continue;
    const group = groups.get(rowPeriod) || [];
    group.push(row);
    groups.set(rowPeriod, group);
  }
  for (const [rowPeriod, rows] of groups) {
    months[rowPeriod] = {
      table: groups.size === 1 ? currentTable : {...currentTable, data: rows},
      activity: appData.TransactionActivity,
    };
  }
  // Keep an intentionally emptied month empty when navigating away and back.
  if (!currentTable.data.length && appData.TransactionMonthCache?.activePeriod) {
    months[appData.TransactionMonthCache.activePeriod] = {
      table: currentTable, activity: appData.TransactionActivity,
    };
  }
  const existing = months[period];
  // Only untouched generated data may be refreshed from Bank AE. Saved edits
  // and legacy snapshots without activity metadata remain authoritative.
  const keepExisting = existing && existing.activity?.lastAction !== 'generated';
  const table = keepExisting ? existing.table : {...currentTable, data: buildBankExportRowsForMonth(appData, month)};
  const activity = keepExisting ? existing.activity : markTransactionGenerated(appData, generatedAt);

  return {
    ...appData,
    globalMonth: month,
    BankExport: table,
    TransactionMonthCache: {
      activePeriod: period,
      months: {...months, [period]: {table, activity}},
    },
    ReconciliationByMonth: {
      ...(appData.ReconciliationByMonth || {}),
      [month]: { ...totals, generatedAt },
    },
    TransactionActivity: activity,
    updatedAt: generatedAt,
  };
}
