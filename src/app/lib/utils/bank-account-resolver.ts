/* eslint-disable @typescript-eslint/no-explicit-any */

export type BankAccountSource = "Gross Pay" | "Transaction" | "HOLD AE";

export interface BankAccountMatch {
  accountNumber: string;
  source: BankAccountSource;
  row: Record<string, any>;
  matchedMonth?: string;
  strategy?: "exact-origin-month" | "exact-report-month" | "gross-pay-memory";
}

const ID_KEYS = [
  "ID Number",
  "Document ID",
  "Document ID / CCCD",
  "CCCD",
  "Mã AE",
  "Mã ae",
] as const;

const ACCOUNT_KEYS = [
  "Bank Account Number",
  "Beneficiary Account No.",
  "Beneficiary Account No",
  "Số tài khoản",
  "STK",
] as const;

export function normalizePayrollId(value: unknown): string {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\.0+$/, "")
    .replace(/[^A-Z0-9]/g, "");

  return normalized === "0" ? "" : normalized;
}

export function getPayrollId(row: Record<string, any> | null | undefined): string {
  if (!row) return "";
  for (const key of ID_KEYS) {
    const id = normalizePayrollId(row[key]);
    if (id) return id;
  }
  return "";
}

export function normalizeBankAccount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date || (typeof value === "number" && !Number.isFinite(value))) {
    return "";
  }

  const account = String(value).trim().replace(/\.0+$/, "");
  if (!account || account === "-" || account === "0") return "";
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(account)) return "";
  return account;
}

export function getBankAccount(row: Record<string, any> | null | undefined): string {
  if (!row) return "";
  for (const key of ACCOUNT_KEYS) {
    const account = normalizeBankAccount(row[key]);
    if (account) return account;
  }
  return "";
}

export function buildBankAccountIndex(
  sources: Array<{
    source: BankAccountSource;
    rows: Array<Record<string, any>> | null | undefined;
  }>,
): Map<string, BankAccountMatch> {
  const index = new Map<string, BankAccountMatch>();

  sources.forEach(({ source, rows }) => {
    (rows || []).forEach((row) => {
      const id = getPayrollId(row);
      const accountNumber = getBankAccount(row);
      if (!id || !accountNumber || index.has(id)) return;
      index.set(id, { accountNumber, source, row });
    });
  });

  return index;
}

export function normalizeReportMonth(value: unknown): string {
  const text = String(value ?? "").trim();
  const match = text.match(/(?:THÁNG|THANG|T)?\s*(\d{1,2})[./\- ]\s*(\d{4})/i);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}.${match[2]}`;
}

function monthIndex(value: unknown): number {
  const normalized = normalizeReportMonth(value);
  if (!normalized) return 0;
  const [month, year] = normalized.split(".").map(Number);
  if (!month || !year) return 0;
  return year * 12 + month;
}

function normalizeMonthWithReference(value: unknown, referenceMonth: string): string {
  const normalized = normalizeReportMonth(value);
  if (normalized) return normalized;

  const reference = normalizeReportMonth(referenceMonth);
  const referenceMatch = reference.match(/^(\d{2})\.(\d{4})$/);
  const monthOnlyMatch = String(value ?? "")
    .trim()
    .match(/(?:THÁNG|THANG|T)\s*(\d{1,2})\b/i);
  if (!referenceMatch || !monthOnlyMatch) return "";

  const reportMonth = Number(referenceMatch[1]);
  let year = Number(referenceMatch[2]);
  const month = Number(monthOnlyMatch[1]);
  if (!month || month > 12) return "";
  if (month > reportMonth) year -= 1;
  return `${String(month).padStart(2, "0")}.${year}`;
}

function getRowMonth(row: Record<string, any>): string {
  return normalizeReportMonth(
    row["Tháng báo cáo"] ??
      row["_fileMonth"] ??
      row["Tháng"] ??
      row["Month"],
  );
}

function findAccountForMonth(
  rows: Array<Record<string, any>>,
  payrollId: string,
  targetMonth: string,
  allowMonthlessRows = false,
): BankAccountMatch | null {
  const exactMatches: BankAccountMatch[] = [];
  const monthlessMatches: BankAccountMatch[] = [];

  rows.forEach((row) => {
    if (getPayrollId(row) !== payrollId) return;
    const accountNumber = getBankAccount(row);
    if (!accountNumber) return;

    const matchedMonth = getRowMonth(row);
    const match: BankAccountMatch = {
      accountNumber,
      source: "Transaction",
      row,
      matchedMonth,
    };
    if (matchedMonth === targetMonth) exactMatches.push(match);
    else if (!matchedMonth && allowMonthlessRows) monthlessMatches.push(match);
  });

  return exactMatches.at(-1) || monthlessMatches.at(-1) || null;
}

function findLatestGrossPayAccount(
  rows: Array<Record<string, any>>,
  payrollId: string,
  notAfterMonth: string,
): BankAccountMatch | null {
  const upperBound = monthIndex(notAfterMonth);
  const candidates = rows
    .map((row, order) => ({
      row,
      order,
      id: getPayrollId(row),
      accountNumber: getBankAccount(row),
      matchedMonth: getRowMonth(row),
    }))
    .filter(
      (candidate) =>
        candidate.id === payrollId &&
        candidate.accountNumber &&
        (!upperBound || !candidate.matchedMonth || monthIndex(candidate.matchedMonth) <= upperBound),
    )
    .sort((a, b) => {
      const monthDiff = monthIndex(b.matchedMonth) - monthIndex(a.matchedMonth);
      return monthDiff || b.order - a.order;
    });

  const match = candidates[0];
  if (!match) return null;
  return {
    accountNumber: match.accountNumber,
    source: "Gross Pay",
    row: match.row,
    matchedMonth: match.matchedMonth,
    strategy: "gross-pay-memory",
  };
}

function getHoldOperation(row: Record<string, any>): string {
  const explicit = String(row["Nghiệp vụ"] ?? "").trim().toUpperCase();
  if (explicit) return explicit;

  const fallback = String(row["Trạng thái"] ?? row["Sheet Source"] ?? "")
    .trim()
    .toUpperCase();
  if (fallback.includes("HOLD")) return "HOLD";
  if (fallback.includes("ADD")) return "ADD";

  const amount = Number(row["TOTAL PAYMENT"]);
  return Number.isFinite(amount) && amount < 0 ? "HOLD" : "ADD";
}

export function resolveHoldBankAccount(options: {
  holdRow: Record<string, any>;
  grossPayRows: Array<Record<string, any>>;
  transactionRows: Array<Record<string, any>>;
  reportMonth?: string;
}): BankAccountMatch | null {
  const { holdRow, grossPayRows, transactionRows, reportMonth } = options;
  const existingAccount = getBankAccount(holdRow);
  if (existingAccount) {
    return { accountNumber: existingAccount, source: "HOLD AE", row: holdRow };
  }

  const payrollId = getPayrollId(holdRow);
  if (!payrollId) return null;

  const normalizedReportMonth =
    normalizeReportMonth(holdRow["Tháng báo cáo"]) || normalizeReportMonth(reportMonth);
  const rawOriginMonth = [
    holdRow["Tháng phát sinh"],
    holdRow["Trạng thái"],
    holdRow["Sheet Source"],
  ].find((value) => String(value ?? "").trim());
  const parsedOriginMonth =
    normalizeMonthWithReference(
      rawOriginMonth,
      normalizedReportMonth,
    ) ||
    normalizedReportMonth;
  const originMonth =
    normalizedReportMonth &&
    monthIndex(parsedOriginMonth) > monthIndex(normalizedReportMonth)
      ? normalizedReportMonth
      : parsedOriginMonth;
  const operation = getHoldOperation(holdRow);

  if (operation.includes("HOLD")) {
    const exactGrossPayMatch = findAccountForMonth(
      grossPayRows,
      payrollId,
      originMonth,
    );
    if (exactGrossPayMatch) {
      return {
        ...exactGrossPayMatch,
        source: "Gross Pay",
        strategy: "exact-origin-month",
      };
    }

    return findLatestGrossPayAccount(
      grossPayRows,
      payrollId,
      originMonth || normalizedReportMonth,
    );
  }

  if (operation.includes("ADD")) {
    const exactTransactionMatch = findAccountForMonth(
      transactionRows,
      payrollId,
      normalizedReportMonth,
      true,
    );
    if (exactTransactionMatch) {
      return {
        ...exactTransactionMatch,
        strategy: "exact-report-month",
      };
    }

    return findLatestGrossPayAccount(
      grossPayRows,
      payrollId,
      normalizedReportMonth,
    );
  }

  return findLatestGrossPayAccount(
    grossPayRows,
    payrollId,
    normalizedReportMonth || originMonth,
  );
}

export function fillMissingHoldBankAccounts(options: {
  holdRows: Array<Record<string, any>>;
  grossPayRows: Array<Record<string, any>>;
  transactionRows: Array<Record<string, any>>;
  reportMonth?: string;
}): { rows: Array<Record<string, any>>; updatedCount: number } {
  let updatedCount = 0;
  const rows = options.holdRows.map((row) => {
    if (!row || getBankAccount(row)) return row;

    const match = resolveHoldBankAccount({
      holdRow: row,
      grossPayRows: options.grossPayRows,
      transactionRows: options.transactionRows,
      reportMonth: options.reportMonth,
    });
    if (!match?.accountNumber) return row;

    updatedCount += 1;
    return {
      ...row,
      "Bank Account Number": match.accountNumber,
      _bankAccountSource: match.source,
      _bankAccountLookupMonth: match.matchedMonth || "",
      _bankAccountLookupStrategy: match.strategy || "",
    };
  });

  return { rows, updatedCount };
}

export function rowBelongsToReportMonth(
  row: Record<string, any>,
  reportMonth: string | undefined,
): boolean {
  const target = normalizeReportMonth(reportMonth);
  if (!target) return true;

  const rowMonth = normalizeReportMonth(
    row["Tháng báo cáo"] ?? row["_fileMonth"] ?? row["Tháng"] ?? row["Month"],
  );
  return !rowMonth || rowMonth === target;
}
