import { parseMoneyToNumber, removeVietnameseTones } from "./data-utils";

type Row = Record<string, unknown>;

export function deductionsNote(row: Row): string {
  const note = String(row.Note ?? "").trim();
  const normalized = removeVietnameseTones(note).toUpperCase();
  return /^LUONG\s*(?:THANG|THG|T)\s*\d{1,2}\b/.test(normalized)
    ? String(row._adjacentNote ?? row["Diễn giải"] ?? "").trim()
    : note;
}

export function prioritizeMatchingDeductions<T extends Row>(rows: T[]) {
  const keyOf = (row: T) => {
    const name = removeVietnameseTones(String(row["Full name"] ?? row["Full Name"] ?? ""))
      .trim().replace(/\s+/g, " ").toUpperCase();
    const value = row["TOTAL PAYMENT"];
    return name && value !== "" && value != null
      ? `${name}|${Math.abs(parseMoneyToNumber(value))}` : "";
  };
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const key = keyOf(row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return rows.map(row => ({ ...row, _matchingDeduction: (counts.get(keyOf(row)) ?? 0) > 1 }))
    .sort((a, b) => Number(b._matchingDeduction) - Number(a._matchingDeduction));
}
