export function trialBalancePeriod(value: string): number {
  const match = value.match(/(\d{1,2})[./-](\d{4})/);
  return match ? Number(match[2]) * 12 + Number(match[1]) : 0;
}

type PresentationRow = {
  month: string;
  customMonthDisplay?: string;
  rawAdd?: number;
  add?: number;
  rawCancel?: number;
  cancel?: number;
};

export function trialBalanceRowLabel(row: PresentationRow): string {
  if (!row.customMonthDisplay) {
    return row.month.replace(/(?:Th[aá]ng\s*)?(\d{1,2})[./-](\d{4})/i,
      (_, month, year) => `Tháng ${month.padStart(2, "0")}.${year}`);
  }
  const operations = [
    (row.rawAdd ?? row.add) ? "Add" : "",
    (row.rawCancel ?? row.cancel) ? "Cancel" : "",
  ].filter(Boolean).join(" / ");
  const label = row.customMonthDisplay.replace(/^\+\s*/, "");
  const resolved = operations
    ? label.replace(/^(?:Hold|Add(?:\s*\/\s*Cancel)?|Cancel)\b/i, operations)
    : label;
  return resolved;
}

export function trialBalanceRowOrder(row: PresentationRow): number {
  if (!row.customMonthDisplay) return 0;
  const label = trialBalanceRowLabel(row);
  if (/^\+?\s*Hold\b/i.test(label)) return 1;
  if (/^\+?\s*Add\b/i.test(label)) return 2;
  if (/^\+?\s*Cancel\b/i.test(label)) return 3;
  return 4;
}
