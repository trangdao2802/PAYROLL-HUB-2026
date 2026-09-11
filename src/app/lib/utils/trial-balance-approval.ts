import { trialBalancePeriod } from "./trial-balance-presentation";

type ApprovalRow = {
  id: string;
  month: string;
  reportMonth?: string;
  displayMonth?: string;
  rawAdd?: number;
  rawHold?: number;
  rawCancel?: number;
  rawBonus?: number;
  add?: number;
  hold?: number;
  cancel?: number;
  bonus?: number;
  _excludeFromTotals?: boolean;
};

/** Apply the same approval to live rows and restored monthly snapshots. */
export function autoApproveTrialBalanceRow<T extends ApprovalRow>(source: T) {
  const row = { ...source, lenh: "OK", confirmed: true };
  const isBonus = /_bonus/.test(row.id);
  const isAdjustment = /_adjustment_|_add|_cancel|_hold/.test(row.id)
    || !!(row.rawAdd || row.rawHold || row.rawCancel || row.add || row.cancel);
  if (!isBonus && !isAdjustment) return row;

  const origin = trialBalancePeriod(row.displayMonth || row.month);
  const report = trialBalancePeriod(row.reportMonth || row.month);
  const bonusAmount = row.rawBonus ?? row.bonus ?? 0;
  const isHold = (row.rawHold || row.hold) && !row.rawAdd && !row.add && !row.rawCancel && !row.cancel;
  const isCurrentHold = !isBonus && isHold && origin === report;
  return {
    ...row,
    thu: Math.abs(isBonus ? (Number.isFinite(bonusAmount) ? bonusAmount : 0) : row.rawAdd ?? row.add ?? 0),
    chi: isBonus ? 0 : Math.abs(isCurrentHold ? (row.rawHold ?? row.hold ?? 0) : (row.rawCancel ?? row.cancel ?? 0)),
    add: 0,
    hold: 0,
    cancel: 0,
    bonus: 0,
    _isPastHoldApprove: origin > 0 && origin < report,
    ...(origin === report ? { openHold: 0, rawOpenHold: 0 } : {}),
    // The old bonus command '-' excluded pending bonuses from totals.
    ...(isBonus ? { _excludeFromTotals: false } : {}),
  };
}
