import assert from "node:assert/strict";
import test from "node:test";
import { autoApproveTrialBalanceRow } from "../src/app/lib/utils/trial-balance-approval";
import { nextTrialBalanceCarry } from "../src/app/lib/utils/trial-balance-carry";

test("all commands approve ADD and CANCEL without changing their source rows", () => {
  for (const lenh of ["", "Duyệt", "-", "OK"]) {
    const source = {
      id: "AHN_adjustment_01.2026", month: "01.2026", reportMonth: "02.2026",
      displayMonth: "01.2026", lenh, confirmed: false,
      rawAdd: -3_575_833, rawHold: 0, rawCancel: -542_500,
      thu: 0, chi: 0, add: 3_575_833, hold: 0, cancel: 542_500,
    };
    const approved = autoApproveTrialBalanceRow(source);
    assert.equal(approved.lenh, "OK");
    assert.equal(approved.confirmed, true);
    assert.equal(approved.thu, 3_575_833);
    assert.equal(approved.chi, 542_500);
    assert.equal(approved.add + approved.hold + approved.cancel, 0);
    assert.equal(approved._isPastHoldApprove, true);
    assert.equal(source.thu, 0);
    assert.deepEqual(nextTrialBalanceCarry({"01.2026": 4_500_000}, [approved], "02.2026"), {"01.2026": 381_667});
  }
});

test("restored snapshots remain approved and preserve current payroll and HOLD", () => {
  const payroll = {id: "AHN", month: "02.2026", thu: 10_000_000, chi: -500_000, rawHold: 0};
  const approved = autoApproveTrialBalanceRow(payroll);
  assert.equal(approved.thu, 10_000_000);
  assert.equal(approved.chi, -500_000);
  assert.deepEqual(nextTrialBalanceCarry({}, [approved], "02.2026"), {"02.2026": 500_000});
  assert.deepEqual(autoApproveTrialBalanceRow(approved), approved);
});

test("auto approval includes a saved pending bonus", () => {
  const approved = autoApproveTrialBalanceRow({id: "AHN_bonus", month: "01.2026", reportMonth: "02.2026", rawBonus: 250_000, lenh: "-", _excludeFromTotals: true});
  assert.equal(approved.thu, 250_000);
  assert.equal(approved._excludeFromTotals, false);
  assert.equal(approved.bonus, 0);
});

test("a current-period CANCEL has no opening HOLD and reduces only current carry", () => {
  const canceled = autoApproveTrialBalanceRow({id: "AHN_adjustment_02.2026", month: "02.2026", rawCancel: -100_000, openHold: 100_000});
  const payroll = {id: "AHN", month: "02.2026", thu: 10_000_000, chi: -500_000};
  assert.equal(canceled.openHold, 0);
  assert.equal(canceled._isPastHoldApprove, false);
  assert.deepEqual(nextTrialBalanceCarry({}, [payroll, canceled], "02.2026"), {"02.2026": 400_000});
});
