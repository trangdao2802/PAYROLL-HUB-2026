import assert from "node:assert/strict";
import test from "node:test";
import { trialBalanceRowLabel, trialBalanceRowOrder } from "../src/app/lib/utils/trial-balance-presentation";

test("labels describe the approved movement after opening HOLD is merged", () => {
  assert.equal(trialBalanceRowLabel({month: "Tháng 2/2026"}), "Tháng 02.2026");
  assert.equal(trialBalanceRowLabel({month: "01.2026", customMonthDisplay: "Hold lương tháng 01.2026", rawAdd: 3_575_833, add: 0}), "+ Add lương tháng 01.2026");
  assert.equal(trialBalanceRowLabel({month: "12.2025", customMonthDisplay: "Cancel lương tháng 12.2025", rawCancel: -542_500}), "+ Cancel lương tháng 12.2025");
});

test("main row precedes Add and Cancel; a combined movement keeps both names", () => {
  const main = {month: "02.2026"};
  const add = {...main, customMonthDisplay: "Hold lương tháng 01.2026", rawAdd: 100};
  const cancel = {...main, customMonthDisplay: "Cancel lương tháng 12.2025", rawCancel: 200};
  assert.deepEqual([cancel, add, main].sort((a,b) => trialBalanceRowOrder(a)-trialBalanceRowOrder(b)), [main, add, cancel]);
  assert.equal(trialBalanceRowLabel({...add, rawCancel: 50}), "+ Add / Cancel lương tháng 01.2026");
});
