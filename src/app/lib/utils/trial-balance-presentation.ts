export function trialBalancePeriod(value: string): number {
  const match = value.match(/(\d{1,2})[./-](\d{4})/);
  return match ? Number(match[2]) * 12 + Number(match[1]) : 0;
}

export function trialBalanceRowLabel(row: { month: string; displayMonth?: string; customMonthDisplay?: string; rawAdd?: number; add?: number; rawCancel?: number; cancel?: number }): string {
  if (!row.customMonthDisplay) return row.month;
  const operation = (row.rawCancel || row.cancel) ? 'Cancel' : (row.rawAdd || row.add) ? 'Add' : '';
  const label = operation ? row.customMonthDisplay.replace(/^(?:\+\s*)?(Hold|Add|Cancel)/i, operation) : row.customMonthDisplay;
  return /^(Add|Cancel)\b/i.test(label) ? `+ ${label}` : label;
}
export function trialBalanceRowOrder(row: Parameters<typeof trialBalanceRowLabel>[0]): number {
  if (!row.customMonthDisplay) return 0;
  const label = trialBalanceRowLabel(row);
  return /^\+ Add\b/.test(label) ? 1 : /^\+ Cancel\b/.test(label) ? 2 : 3;
}
