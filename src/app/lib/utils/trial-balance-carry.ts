type CarryRow = {
  id: string; month: string; reportMonth?: string; displayMonth?: string;
  customMonthDisplay?: string; _isOpeningHold?: boolean; _excludeFromTotals?: boolean;
  thu?: number; chi?: number; hold?: number; add?: number; cancel?: number;
  rawHold?: number; rawAdd?: number; rawCancel?: number;
};

function period(value: string): number {
  const match = value.match(/(\d{1,2})[./-](\d{4})/);
  return match ? Number(match[2]) * 12 + Number(match[1]) : 0;
}

export function isHoldDetail(row: CarryRow): boolean {
  return !!row._isOpeningHold || /\bhold\b/i.test(row.customMonthDisplay || "") || /_hold/.test(row.id);
}

export function hideInactivePastHold(row: CarryRow, reportMonth: string): boolean {
  const origin = period(row.displayMonth || row.month);
  return isHoldDetail(row) && origin > 0 && origin < period(reportMonth)
    && !row.thu && !row.chi && !row.add && !row.cancel && !row.rawAdd && !row.rawCancel;
}

/** Carry is scoped to a BU by the caller, and releases only its matching origin month. */
export function nextTrialBalanceCarry(opening: Record<string, number>, rows: CarryRow[], reportMonth: string): Record<string, number> {
  const result = { ...opening };
  const movements = new Map<string, number>();
  for (const row of rows) {
    if (row._excludeFromTotals || (row.reportMonth && period(row.reportMonth) !== period(reportMonth))) continue;
    const origin = row.displayMonth || row.month;
    const key = [...Object.keys(result), ...movements.keys()].find(k => period(k) > 0 && period(k) === period(origin)) || origin;
    // Old HOLD is already in opening. Only a new HOLD adds to carry.
    const isBasePayroll = !row.customMonthDisplay && !/_(adjustment|cancel|add|hold)/.test(row.id);
    const held = period(origin) === period(reportMonth)
      ? Math.abs(row.rawHold || (isBasePayroll ? row.chi : row.hold) || 0) : 0;
    const released = Math.abs(row.rawAdd ?? row.add ?? 0) + Math.abs(row.rawCancel ?? row.cancel ?? 0);
    movements.set(key, (movements.get(key) || 0) + held - released);
  }
  for (const [key, delta] of movements) result[key] = Math.max(0, (result[key] || 0) + delta);
  return Object.fromEntries(Object.entries(result).filter(([, amount]) => amount > 0));
}
