import { trialBalancePeriod } from "./trial-balance-presentation";
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
    month?: string;
    reportMonth?: string;
    displayMonth?: string;
    chi?: unknown;
    rawHold?: unknown;
    rawAdd?: unknown;
    rawCancel?: unknown;
    customMonthDisplay?: string;
    thu?: unknown;
    hold?: unknown;
    add?: unknown;
    cancel?: unknown;
    _excludeFromTotals?: boolean;
  }>,
  reportMonth?: string,
): TrialBalanceHeaderTotals {
  return rows.reduce<TrialBalanceHeaderTotals>(
    (totals, row) => {
      if (!row || row._excludeFromTotals) return totals;

      totals.payrollCost += parseMoneyToNumber(row.thu ?? 0);
      const report = trialBalancePeriod(reportMonth || row.reportMonth || row.month || "");
      const origin = trialBalancePeriod(row.displayMonth || row.month || "");
      if (!reportMonth) {
        totals.hold += Math.abs(parseMoneyToNumber(row.hold ?? 0));
        totals.add += Math.abs(parseMoneyToNumber(row.add ?? 0));
        totals.cancel += Math.abs(parseMoneyToNumber(row.cancel ?? 0));
      } else if (!row.reportMonth || trialBalancePeriod(row.reportMonth) === report) {
        if (origin === report) {
          totals.hold += Math.abs(parseMoneyToNumber(row.rawHold || (!row.customMonthDisplay ? row.chi : row.hold) || 0));
          totals.cancel += Math.abs(parseMoneyToNumber(row.rawCancel || row.cancel || 0));
        }
        if (origin > 0 && origin < report) totals.add += Math.abs(parseMoneyToNumber(row.rawAdd || row.add || 0));
      }
      return totals;
    },
    { payrollCost: 0, hold: 0, add: 0, cancel: 0 },
  );
}
