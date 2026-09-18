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
import { trialBalanceRowLabel } from '../src/app/lib/utils/trial-balance-presentation';

test('header scopes HOLD, ADD and CANCEL to their requested occurrence periods', () => {
  const rows = [
    {month:'Tháng 2/2026',reportMonth:'02.2026',thu:10000,chi:500,rawHold:0},
    {month:'01.2026',displayMonth:'01.2026',reportMonth:'02.2026',customMonthDisplay:'Hold',rawAdd:300,rawCancel:200,rawHold:999},
    {month:'02.2026',reportMonth:'02.2026',customMonthDisplay:'Cancel',rawCancel:100,chi:100},
    {month:'02.2026',reportMonth:'02.2026',customMonthDisplay:'Add',rawAdd:700},
  ];
  assert.deepEqual(calculateTrialBalanceHeaderTotals(rows,'02.2026'),{payrollCost:10000,hold:500,add:300,cancel:100});
});
test('approved ADD keeps its true label and child prefix after opening allocation', () => {
  assert.equal(trialBalanceRowLabel({month:'02.2026',customMonthDisplay:'Hold lương tháng 01.2026',rawAdd:3575833,add:0}),'+ Add lương tháng 01.2026');
  assert.equal(trialBalanceRowLabel({month:'02.2026',customMonthDisplay:'Cancel lương tháng 12.2025',rawCancel:542500}),'+ Cancel lương tháng 12.2025');
  assert.equal(trialBalanceRowLabel({month:'02.2026'}),'02.2026');
});
