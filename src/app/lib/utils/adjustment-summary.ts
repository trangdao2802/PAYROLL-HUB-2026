export type AdjustmentType = "HOLD" | "ADD" | "CANCEL" | "BONUS";

interface AdjustmentAmount {
  biz: string;
  type: AdjustmentType;
  amount: number;
}

type BusinessAdjustmentTotals = Record<AdjustmentType, number> & {
  totalCount: number;
};

/** Sidebar totals show the magnitude of each adjustment separately by business. */
export function aggregateAdjustmentTotals(
  items: readonly AdjustmentAmount[],
): Record<string, BusinessAdjustmentTotals> {
  const totals: Record<string, BusinessAdjustmentTotals> = {};
  for (const item of items) {
    const business = item.biz || "Other";
    if (!Object.hasOwn(totals, business)) {
      totals[business] = { HOLD: 0, ADD: 0, CANCEL: 0, BONUS: 0, totalCount: 0 };
    }
    totals[business][item.type] += Math.abs(item.amount);
    totals[business].totalCount += 1;
  }
  return totals;
}
