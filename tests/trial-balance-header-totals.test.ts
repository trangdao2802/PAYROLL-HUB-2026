import assert from "node:assert/strict";
import test from "node:test";

import { calculateTrialBalanceHeaderTotals } from "../src/app/lib/utils/trial-balance-header-totals";

test("Trial Balance header totals use business columns, not row labels", () => {
  const totals = calculateTrialBalanceHeaderTotals([
    {
      id: "02.2026_AHN_adjustment_01.2026",
      customMonthDisplay: "Hold lương tháng 01.2026",
      thu: 0,
      hold: 400_000,
      add: 125_000,
      cancel: 75_000,
    },
    {
      id: "02.2026_AHN",
      thu: "839.461.357",
      hold: 0,
      add: 0,
      cancel: 0,
    },
  ]);

  assert.deepEqual(totals, {
    payrollCost: 839_461_357,
    hold: 400_000,
    add: 125_000,
    cancel: 75_000,
  });
});

test("Trial Balance header totals ignore rows excluded from totals", () => {
  const totals = calculateTrialBalanceHeaderTotals([
    { thu: 10, hold: 20, add: 30, cancel: 40 },
    {
      thu: 1_000,
      hold: 2_000,
      add: 3_000,
      cancel: 4_000,
      _excludeFromTotals: true,
    },
  ]);

  assert.deepEqual(totals, {
    payrollCost: 10,
    hold: 20,
    add: 30,
    cancel: 40,
  });
});
