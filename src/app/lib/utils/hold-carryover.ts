export type HoldCarryRow = Record<string, unknown>;

export interface PayrollMonth {
  month: number;
  year: number;
  index: number;
  dot: string;
  label: string;
}

export interface HoldCarryoverResult {
  rows: HoldCarryRow[];
  carriedCount: number;
}

const cleanText = (value: unknown) => String(value ?? "").trim();

export function parsePayrollMonth(value: unknown): PayrollMonth | null {
  const raw = cleanText(value);
  if (!raw) return null;

  const monthFirst = raw.match(
    /(?:TH[AÁ]NG|THANG|THG|T)?\s*(0?[1-9]|1[0-2])\s*[./-]\s*((?:19|20)\d{2})/i,
  );
  const yearFirst = raw.match(
    /((?:19|20)\d{2})\s*[./-]\s*(0?[1-9]|1[0-2])/i,
  );

  const month = monthFirst
    ? Number(monthFirst[1])
    : yearFirst
      ? Number(yearFirst[2])
      : 0;
  const year = monthFirst
    ? Number(monthFirst[2])
    : yearFirst
      ? Number(yearFirst[1])
      : 0;

  if (month < 1 || month > 12 || year < 1900) return null;

  return {
    month,
    year,
    index: year * 12 + month,
    dot: `${String(month).padStart(2, "0")}.${year}`,
    label: `Tháng ${month}/${year}`,
  };
}

export function getNextPayrollMonth(value: unknown): PayrollMonth | null {
  const parsed = parsePayrollMonth(value);
  if (!parsed) return null;

  const month = parsed.month === 12 ? 1 : parsed.month + 1;
  const year = parsed.month === 12 ? parsed.year + 1 : parsed.year;

  return {
    month,
    year,
    index: year * 12 + month,
    dot: `${String(month).padStart(2, "0")}.${year}`,
    label: `Tháng ${month}/${year}`,
  };
}

function getReportMonth(row: HoldCarryRow): PayrollMonth | null {
  return parsePayrollMonth(
    row["Tháng báo cáo"] || row._fileMonth || row["Tháng"],
  );
}

function getArisingMonth(row: HoldCarryRow): PayrollMonth | null {
  return parsePayrollMonth(
    row["Tháng phát sinh"] || row["Trạng thái"] || row["Sheet Source"],
  );
}

function isHoldRow(row: HoldCarryRow): boolean {
  const operation = cleanText(row["Nghiệp vụ"]).toUpperCase();
  if (operation === "H" || operation.includes("HOLD")) return true;

  // Legacy imported rows may not have Nghiệp vụ yet. Do not let ADD/CANCEL
  // rows pass merely because another free-text column mentions HOLD.
  if (operation) return false;
  const legacyType = `${cleanText(row["Trạng thái"])} ${cleanText(
    row["Sheet Source"],
  )}`.toUpperCase();
  return (
    legacyType.includes("HOLD") &&
    !legacyType.includes("ADD") &&
    !legacyType.includes("CANCEL")
  );
}

function normalizedPart(value: unknown): string {
  return cleanText(value).replace(/\s+/g, " ").toUpperCase();
}

function sourceIdentity(row: HoldCarryRow, arisingMonth: PayrollMonth): string {
  const persistedIdentity = cleanText(
    row._holdCarryOriginId || row._recordId || row.id,
  );
  if (persistedIdentity) return persistedIdentity;

  return [
    row["ID Number"],
    row["Full name"],
    row["Bank Account Number"],
    row.L07,
    row.BU || row.Business,
    row["TOTAL PAYMENT"],
    arisingMonth.dot,
    row.Note,
    row["Sheet Source"],
  ]
    .map(normalizedPart)
    .join("|");
}

function semanticKey(
  row: HoldCarryRow,
  reportMonth: PayrollMonth,
  arisingMonth: PayrollMonth,
): string {
  return [
    reportMonth.dot,
    arisingMonth.dot,
    row["ID Number"],
    row["Full name"],
    row["Bank Account Number"],
    row.L07,
    row.BU || row.Business,
    row["TOTAL PAYMENT"],
    row.Note,
    row["Sheet Source"],
    "HOLD",
  ]
    .map(normalizedPart)
    .join("|");
}

export function removeHoldCarryoverFromReport(
  rows: HoldCarryRow[],
  reportMonth: unknown,
): HoldCarryRow[] {
  const current = parsePayrollMonth(reportMonth);
  if (!current) return rows;

  return rows.filter((row) => {
    const carriedFrom = parsePayrollMonth(row?._holdCarryFromReportMonth);
    return carriedFrom?.index !== current.index;
  });
}

/**
 * Copies eligible HOLD entries into the next reporting month for Deductions.
 * The original arising month is retained and repeated saves are idempotent.
 */
export function carryEligibleHoldsToNextMonth({
  sourceRows,
  existingRows,
  reportMonth,
  createdAt = new Date().toISOString(),
}: {
  sourceRows: HoldCarryRow[];
  existingRows: HoldCarryRow[];
  reportMonth: unknown;
  createdAt?: string;
}): HoldCarryoverResult {
  const current = parsePayrollMonth(reportMonth);
  const next = getNextPayrollMonth(reportMonth);
  if (!current || !next) {
    return { rows: existingRows, carriedCount: 0 };
  }

  // Re-saving a period refreshes only the rows previously generated from that
  // period. Imported and manually-entered rows in the next month stay intact.
  const retainedRows = removeHoldCarryoverFromReport(existingRows, current.dot);

  const existingCarryKeys = new Set(
    retainedRows.map((row) => cleanText(row?._holdCarryKey)).filter(Boolean),
  );
  const existingSemanticKeys = new Set<string>();

  retainedRows.forEach((row) => {
    if (!row || !isHoldRow(row)) return;
    const rowReportMonth = getReportMonth(row);
    const arisingMonth = getArisingMonth(row);
    if (
      rowReportMonth?.index === next.index &&
      arisingMonth &&
      arisingMonth.index <= current.index
    ) {
      existingSemanticKeys.add(semanticKey(row, next, arisingMonth));
    }
  });

  const carriedRows: HoldCarryRow[] = [];

  sourceRows.forEach((row) => {
    if (!row || !isHoldRow(row)) return;

    const rowReportMonth = getReportMonth(row);
    const arisingMonth = getArisingMonth(row);
    if (
      rowReportMonth?.index !== current.index ||
      !arisingMonth ||
      arisingMonth.index > current.index
    ) {
      return;
    }

    const originId = sourceIdentity(row, arisingMonth);
    const carryKey = `${originId}::HOLD-CARRY::${next.dot}`;
    const rowSemanticKey = semanticKey(row, next, arisingMonth);
    if (
      existingCarryKeys.has(carryKey) ||
      existingSemanticKeys.has(rowSemanticKey)
    ) {
      return;
    }

    const source = { ...row };
    delete source._originalIndex;
    delete source._dimmed;
    delete source._isPastMonthHoldOrCancel;
    delete source._originalTinhTrangThanhToan;

    carriedRows.push({
      ...source,
      id: carryKey,
      _recordId: carryKey,
      _holdCarryKey: carryKey,
      _holdCarryOriginId: originId,
      _holdCarryFromReportMonth: current.dot,
      _holdCarryCreatedAt: createdAt,
      "Tháng": next.dot,
      _fileMonth: next.dot,
      "Tháng báo cáo": next.dot,
      "Tháng phát sinh": arisingMonth.dot,
      "Trạng thái": arisingMonth.dot,
      "Nghiệp vụ": "Hold",
      "Tình trạng thanh toán": `Pending từ tháng ${arisingMonth.dot}`,
      "No.": retainedRows.length + carriedRows.length + 1,
      No: retainedRows.length + carriedRows.length + 1,
    });
    existingCarryKeys.add(carryKey);
    existingSemanticKeys.add(rowSemanticKey);
  });

  return {
    rows:
      carriedRows.length > 0
        ? [...retainedRows, ...carriedRows]
        : retainedRows,
    carriedCount: carriedRows.length,
  };
}
