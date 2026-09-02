export type DeductionsRow = Record<string, unknown>;

export type IndexedDeductionsRow = DeductionsRow & {
  _originalIndex: number;
};

const ID_KEYS = ["ID Number", "ID NUMBER", "id_number"];
const NAME_KEYS = ["Full name", "Full Name", "FULL NAME"];
const BUSINESS_KEYS = ["BU", "Business", "business"];
const L07_KEYS = ["L07", "l07"];

function firstNonEmpty(row: DeductionsRow, keys: string[]): string {
  for (const key of keys) {
    const value = String(row?.[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * Deductions rows must identify one employee and one allocation completely.
 * Workbook subtotal rows carry an amount but leave these dimensions blank, so
 * they must never enter the Deductions table or its downstream balances.
 */
export function hasRequiredDeductionsFields(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;

  const record = row as DeductionsRow;
  return Boolean(
    firstNonEmpty(record, ID_KEYS) &&
      firstNonEmpty(record, NAME_KEYS) &&
      firstNonEmpty(record, BUSINESS_KEYS) &&
      firstNonEmpty(record, L07_KEYS),
  );
}

/**
 * Removes non-transaction rows while retaining the index of every accepted
 * row in the unfiltered storage collection. Deductions edit/delete actions
 * use this index to update the canonical row, so it must not be recalculated
 * after subtotal rows have been filtered out.
 */
export function selectValidDeductionsRowsWithSourceIndexes(
  rows: unknown[],
): IndexedDeductionsRow[] {
  const selected: IndexedDeductionsRow[] = [];

  rows.forEach((row, sourceIndex) => {
    if (!hasRequiredDeductionsFields(row)) return;
    selected.push({
      ...(row as DeductionsRow),
      _originalIndex: sourceIndex,
    });
  });

  return selected;
}
