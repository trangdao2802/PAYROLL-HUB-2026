import { parseMoneyToNumber } from "./data-utils";

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
  const legacyType = `${cleanText(row["Trạng thái trước lưu"])} ${cleanText(
    row._holdStatusBeforeSave,
  )} ${cleanText(row["Trạng thái"])} ${cleanText(row["Sheet Source"])}`.toUpperCase();
  return (
    legacyType.includes("HOLD") &&
    !legacyType.includes("ADD") &&
    !legacyType.includes("CANCEL")
  );
}

function normalizedPart(value: unknown): string {
  return cleanText(value).replace(/\s+/g, " ").toUpperCase();
}

function firstPresent(row: HoldCarryRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && cleanText(value) !== "") {
      return value;
    }
  }
  return "";
}

export function getMergedHoldOriginalIndexes(
  row: HoldCarryRow,
): number[] {
  const indexes = Array.isArray(row?._holdMergedOriginalIndexes)
    ? row._holdMergedOriginalIndexes
    : [];
  const originalIndex = Number(row?._originalIndex);

  return Array.from(
    new Set([
      ...indexes
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0),
      ...(Number.isInteger(originalIndex) && originalIndex >= 0
        ? [originalIndex]
        : []),
    ]),
  );
}

/**
 * Replaces every source row represented by a merged HOLD with one canonical
 * row. This makes later operation changes persistent instead of revealing the
 * hidden HOLD copy that previously remained in storage.
 */
export function collapseMergedHoldSourceRows({
  rows,
  mergedRow,
  canonicalIndex,
  updatedRow,
}: {
  rows: HoldCarryRow[];
  mergedRow: HoldCarryRow;
  canonicalIndex: number;
  updatedRow: HoldCarryRow;
}): HoldCarryRow[] {
  const mergedIndexes = getMergedHoldOriginalIndexes(mergedRow).filter(
    (index) => index < rows.length,
  );
  if (mergedIndexes.length <= 1) {
    const nextRows = [...rows];
    nextRows[canonicalIndex] = updatedRow;
    return nextRows;
  }

  const indexesToRemove = new Set(
    mergedIndexes.filter((index) => index !== canonicalIndex),
  );

  return rows
    .map((row, index) => (index === canonicalIndex ? updatedRow : row))
    .filter((_row, index) => !indexesToRemove.has(index));
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

/**
 * Business identity of a HOLD. Reporting month is deliberately excluded:
 * a saved carry and the same row imported in the following month's workbook
 * represent one transaction.
 */
export function getHoldSemanticIdentity(row: HoldCarryRow): string {
  const arisingMonth = getArisingMonth(row);
  if (!arisingMonth) return "";

  return [
    arisingMonth.dot,
    firstPresent(row, ["ID Number", "ID NUMBER", "ID", "Mã AE"]),
    firstPresent(row, ["Full name", "FULL NAME", "Full Name", "Beneficiary Name"]),
    firstPresent(row, ["L07", "Mã ae", "Mã AE"]),
    firstPresent(row, ["BU", "Business"]),
    firstPresent(row, ["Bank Account Number", "BANK ACCOUNT NUMBER", "STK AE"]),
    Math.abs(
      parseMoneyToNumber(
        firstPresent(row, ["TOTAL PAYMENT", "Total Payment", "Payment Amount"]),
      ),
    ),
    firstPresent(row, ["Sheet Source", "SHEET SOURCE"]),
    "HOLD",
  ]
    .map(normalizedPart)
    .join("|");
}

/**
 * Storage identity keeps monthly snapshots separate while reusing the exact
 * report-independent HOLD identity above.
 */
export function getHoldScopedIdentity(
  row: HoldCarryRow,
  fallbackReportMonth?: unknown,
): string {
  const reportMonth = getReportMonth(row) || parsePayrollMonth(fallbackReportMonth);
  const semanticIdentity = getHoldSemanticIdentity(row);
  if (!reportMonth || !semanticIdentity) return "";
  return `${reportMonth.dot}|${semanticIdentity}`;
}

/**
 * Merge a carried HOLD with the same HOLD imported from the report month's
 * source sheet. A duplicate requires an exact semantic match on arising month,
 * employee identity, L07, BU, bank account, sheet source and absolute TOTAL
 * PAYMENT. Reporting month is not part of the business identity. The optional
 * scope is used only when processing the all-month storage collection.
 */
export function mergeDuplicateHoldRows(
  rows: HoldCarryRow[],
  options: { scopeByReportMonth?: boolean } = {},
): HoldCarryRow[] {
  const result: HoldCarryRow[] = [];
  const holdIndexes = new Map<string, number>();

  rows.forEach((row) => {
    if (!row || !isHoldRow(row)) {
      result.push(row);
      return;
    }

    const semanticIdentity = getHoldSemanticIdentity(row);
    if (!semanticIdentity) {
      result.push(row);
      return;
    }

    const reportMonth = options.scopeByReportMonth ? getReportMonth(row) : null;
    const key = options.scopeByReportMonth
      ? `${reportMonth?.dot || "UNKNOWN"}|${semanticIdentity}`
      : semanticIdentity;
    const existingIndex = holdIndexes.get(key);
    if (existingIndex === undefined) {
      holdIndexes.set(key, result.length);
      result.push(row);
      return;
    }

    const existing = result[existingIndex];
    const existingIsCarry = Boolean(existing?._holdCarryKey);
    const incomingIsCarry = Boolean(row?._holdCarryKey);
    const preferred = existingIsCarry && !incomingIsCarry ? row : existing;
    const duplicateCount =
      Number(existing?._holdMergedDuplicateCount || 1) +
      Number(row?._holdMergedDuplicateCount || 1);
    const mergedOriginalIndexes = Array.from(
      new Set([
        ...getMergedHoldOriginalIndexes(existing),
        ...getMergedHoldOriginalIndexes(row),
      ]),
    );

    result[existingIndex] = {
      ...preferred,
      "TOTAL PAYMENT": -Math.abs(
        parseMoneyToNumber(preferred["TOTAL PAYMENT"]),
      ),
      _holdMergedDuplicateCount: duplicateCount,
      ...(mergedOriginalIndexes.length > 1
        ? { _holdMergedOriginalIndexes: mergedOriginalIndexes }
        : {}),
      _holdStatusBeforeSave: "Hold",
    };
  });

  return result;
}

/**
 * Deletes the exact raw source rows represented by displayed rows. A merged
 * HOLD can represent two or more raw rows, so all of its original indexes are
 * removed together. The semantic fallback is report-scoped to avoid deleting
 * the same employee/amount from another month.
 */
export function removeSelectedHoldSourceRows(
  sourceRows: HoldCarryRow[],
  displayedRows: HoldCarryRow[],
): { rows: HoldCarryRow[]; removedCount: number } {
  const indexesToDelete = new Set<number>();
  const idsToDelete = new Set<string>();
  const fallbackKeys = new Set<string>();

  displayedRows.filter(Boolean).forEach((row) => {
    const indexes = getMergedHoldOriginalIndexes(row).filter(
      (index) => index < sourceRows.length,
    );
    indexes.forEach((index) => indexesToDelete.add(index));

    const rowIds = [row._recordId, row.id, row._holdCarryKey]
      .map(cleanText)
      .filter(Boolean);
    rowIds.forEach((id) => idsToDelete.add(id));

    if (indexes.length === 0 && rowIds.length === 0) {
      const scopedIdentity = getHoldScopedIdentity(row);
      if (scopedIdentity) fallbackKeys.add(scopedIdentity);
    }
  });

  const rows = sourceRows.filter((row, index) => {
    if (indexesToDelete.has(index)) return false;
    const rowIds = [row?._recordId, row?.id, row?._holdCarryKey]
      .map(cleanText)
      .filter(Boolean);
    if (rowIds.some((id) => idsToDelete.has(id))) return false;
    const scopedIdentity = getHoldScopedIdentity(row);
    return !scopedIdentity || !fallbackKeys.has(scopedIdentity);
  });

  return { rows, removedCount: sourceRows.length - rows.length };
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

export function getEligibleHoldRowsForReport(
  rows: HoldCarryRow[],
  reportMonth: unknown,
): HoldCarryRow[] {
  const current = parsePayrollMonth(reportMonth);
  if (!current) return [];

  const uniqueRows = new Map<string, HoldCarryRow>();

  rows.forEach((row) => {
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

    const mergeKey = getHoldSemanticIdentity(row);
    if (!uniqueRows.has(mergeKey)) {
      uniqueRows.set(mergeKey, row);
    }
  });

  return Array.from(uniqueRows.values());
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
      existingSemanticKeys.add(getHoldSemanticIdentity(row));
    }
  });

  const carriedRows: HoldCarryRow[] = [];

  getEligibleHoldRowsForReport(sourceRows, current.dot).forEach((row) => {
    const arisingMonth = getArisingMonth(row);
    if (!arisingMonth) return;

    const originId = sourceIdentity(row, arisingMonth);
    const carryKey = `${originId}::HOLD-CARRY::${next.dot}`;
    const rowSemanticKey = getHoldSemanticIdentity(row);
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
      _holdCarrySaved: true,
      _holdStatusBeforeSave: "Hold",
      "Tháng": next.dot,
      _fileMonth: next.dot,
      "Tháng báo cáo": next.dot,
      "Tháng phát sinh": arisingMonth.dot,
      "Trạng thái": arisingMonth.dot,
      "Nghiệp vụ": "Hold",
      "TOTAL PAYMENT": -Math.abs(parseMoneyToNumber(source["TOTAL PAYMENT"])),
      "Tình trạng thanh toán": `Pending từ tháng ${arisingMonth.dot}`,
      "No.": retainedRows.length + carriedRows.length + 1,
      No: retainedRows.length + carriedRows.length + 1,
    });
    existingCarryKeys.add(carryKey);
    existingSemanticKeys.add(rowSemanticKey);
  });

  return {
    rows: mergeDuplicateHoldRows(
      carriedRows.length > 0
        ? [...retainedRows, ...carriedRows]
        : retainedRows,
      { scopeByReportMonth: true },
    ),
    carriedCount: carriedRows.length,
  };
}
