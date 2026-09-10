import test from 'node:test';
import assert from 'node:assert/strict';
import { hideInactivePastHold, nextTrialBalanceCarry } from '../src/app/lib/utils/trial-balance-carry';
const hold = { id: 'ATH_hold', month: '06/2026', reportMonth: '06/2026', displayMonth: '04/2026', customMonthDisplay: 'Hold lương tháng 04.2026', thu: 0, chi: 0, rawHold: 438000 };
test('hide inactive old HOLD but preserve current activity and Cancel', () => {
  assert.equal(hideInactivePastHold(hold, '06/2026'), true);
  assert.equal(hideInactivePastHold({...hold, chi: 438000}, '06/2026'), false);
  assert.equal(hideInactivePastHold({...hold, rawCancel: 438000}, '06/2026'), false);
  assert.equal(hideInactivePastHold({...hold, displayMonth:'06/2026'}, '06/2026'), false);
});
test('old HOLD does not add its opening a second time; Cancel releases the matching origin', () => {
  const opening = {'Tháng 04/2026':438000, '05/2026':100000};
  assert.deepEqual(nextTrialBalanceCarry(opening, [hold], '06/2026'), opening);
  const cancel = {...hold, id:'ATH_adjustment_cancel', rawHold:0, rawCancel:-438000};
  assert.deepEqual(nextTrialBalanceCarry(opening, [hold,cancel], '06/2026'), {'05/2026':100000});
  assert.deepEqual(opening, {'Tháng 04/2026':438000, '05/2026':100000});
});
test('current HOLD and partial release are order independent, including year rollover', () => {
  const current = {...hold, displayMonth:'12/2026', reportMonth:'12/2026', rawHold:438000};
  const cancel = {...current, rawHold:0, rawCancel:100000};
  assert.deepEqual(nextTrialBalanceCarry({}, [cancel,current], '12/2026'), {'12/2026':338000});
  assert.equal(hideInactivePastHold({...current, displayMonth:'12/2026'}, '01/2027'), true);
});
test('completed cancellation stays empty in following months', () => {
  const canceled = nextTrialBalanceCarry({'04/2026':438000}, [{...hold,rawHold:0,rawCancel:438000}], '06/2026');
  assert.deepEqual(nextTrialBalanceCarry(canceled, [{...hold,reportMonth:'07/2026'}], '07/2026'), {});
});
test('merged payroll HOLD carries; Cancel expense is never mistaken for new HOLD', () => {
  const payroll={...hold,id:'ATH',customMonthDisplay:'',displayMonth:'06/2026',rawHold:0,chi:438000};
  const cancel={...hold,id:'ATH_cancel',customMonthDisplay:'Cancel',displayMonth:'06/2026',rawHold:0,chi:438000,rawCancel:438000};
  assert.deepEqual(nextTrialBalanceCarry({},[payroll], '06/2026'), {'06/2026':438000});
  assert.deepEqual(nextTrialBalanceCarry({},[payroll,cancel], '06/2026'), {});
});
