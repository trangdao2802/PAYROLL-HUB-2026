import { parseMoneyToNumber } from "./data-utils";

export interface TrialBalanceHeaderTotals {
  payrollCost: number;
  hold: number;
  add: number;
  cancel: number;
}

/**
 * Calculate the four figures shown in the Trial Balance header from the
 * rendered business columns. A Trial Balance row can contain more than one
 * adjustment, so classifying rows by their id/label drops values from merged
 * HOLD/ADD/CANCEL rows.
 */
export function calculateTrialBalanceHeaderTotals(
  rows: Array<{
    thu?: unknown;
    hold?: unknown;
    add?: unknown;
    cancel?: unknown;
    _excludeFromTotals?: boolean;
  }>,
): TrialBalanceHeaderTotals {
  return rows.reduce<TrialBalanceHeaderTotals>(
    (totals, row) => {
      if (!row || row._excludeFromTotals) return totals;

      totals.payrollCost += parseMoneyToNumber(row.thu ?? 0);
      totals.hold += Math.abs(parseMoneyToNumber(row.hold ?? 0));
      totals.add += Math.abs(parseMoneyToNumber(row.add ?? 0));
      totals.cancel += Math.abs(parseMoneyToNumber(row.cancel ?? 0));
      return totals;
    },
    { payrollCost: 0, hold: 0, add: 0, cancel: 0 },
  );
}
