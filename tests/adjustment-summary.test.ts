import assert from "node:assert/strict";
import test from "node:test";
import { aggregateAdjustmentTotals } from "../src/app/lib/utils/adjustment-summary";

test("adjustment summary keeps BONUS finite and separate from HOLD, ADD and CANCEL", () => {
  const totals = aggregateAdjustmentTotals([
    { biz: "AHN", type: "HOLD", amount: -500000 },
    { biz: "AHN", type: "ADD", amount: 200000 },
    { biz: "AHN", type: "CANCEL", amount: -100000 },
    { biz: "AHN", type: "BONUS", amount: 30000 },
    { biz: "AHN", type: "BONUS", amount: 20000 },
    { biz: "ATH", type: "BONUS", amount: 40000 },
    { biz: "", type: "ADD", amount: 1000 },
  ]);
  assert.deepEqual(totals.AHN, { HOLD: 500000, ADD: 200000, CANCEL: 100000, BONUS: 50000, totalCount: 5 });
  assert.deepEqual(totals.ATH, { HOLD: 0, ADD: 0, CANCEL: 0, BONUS: 40000, totalCount: 1 });
  assert.deepEqual(totals.Other, { HOLD: 0, ADD: 1000, CANCEL: 0, BONUS: 0, totalCount: 1 });
});
