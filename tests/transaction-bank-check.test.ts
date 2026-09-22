import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewBankAccounts } from '../src/app/lib/utils/transaction-bank-check';
import { compareAccountsAcrossHistory, visibleHistoricalComparisons } from '../src/app/lib/utils/transaction-history';
import { bankAccountResolutionOptions, buildDocumentIdMajorityPlan } from '../src/app/lib/utils/transaction-history-resolution';

const row = (id = 'EMP-1', account = '0012345678', name = 'NGUYEN VAN AN', bank = 'VCB') => ({
  'Document ID': id, 'Beneficiary Account No.': account, 'Beneficiary Name': name, 'Beneficiary Bank': bank,
});
const snapshot = (rows: ReturnType<typeof row>[]) => ({id: '1', period: '2026-01', created_at: '2026-09-08T00:00:00Z', rows});

test('bank review preserves zeros, accepts multiple account lengths and internal document IDs', () => {
  const rows = [row(), row('EMP-1', '0012345678901')];
  assert.ok(reviewBankAccounts(rows, []).every(result => result.findings.length === 0));
  assert.equal(rows[0]['Beneficiary Account No.'], '0012345678');
});

test('repeated payroll lines for the same identity are not different account owners', () => {
  assert.ok(reviewBankAccounts([row(), row()], [snapshot([row()])]).every(result => !result.blocksSync));
  assert.equal(reviewBankAccounts([row()], [snapshot([row('OLD-ID')])])[0].findings.length, 0);
});

test('same bank and account under different names needs verification, including other historical IDs', () => {
  const result = reviewBankAccounts([row()], [snapshot([row('EMP-2', '0012345678', 'TRAN THI BINH')])])[0];
  assert.ok(result.findings.some(item => item.code === 'ACCOUNT_OWNER_CONFLICT'));
  assert.equal(result.blocksSync, true);
  assert.match(result.findings.find(item => item.code === 'ACCOUNT_OWNER_CONFLICT')!.message, /2026-01.*EMP-2/);
});

test('bank context scopes account matches and an explicit different bank is never overridden', () => {
  const result = reviewBankAccounts([row()], [snapshot([row('EMP-2', '0012345678', 'TRAN THI BINH', 'OTHER BANK')])], 'VCB')[0];
  assert.equal(result.findings.length, 0);
  assert.equal(reviewBankAccounts([row('EMP-1', '0012345678', 'NGUYEN VAN AN', '')], [], 'VCB')[0].bankAssumed, true);
});

test('Excel notation and embedded separators need correction; VCB nickname needs channel confirmation', () => {
  const results = reviewBankAccounts([
    row('A', '1.234E+12'), row('B', '0012 345678'), row('C', 'anpayroll'),
    row('D', '0000000000'), {...row('E'), 'Beneficiary Account No.': 1234567890},
  ], []);
  assert.deepEqual(results.map(item => item.findings[0].code), [
    'ACCOUNT_SCIENTIFIC', 'ACCOUNT_SPACING', 'ACCOUNT_ALIAS', 'ACCOUNT_PLACEHOLDER', 'ACCOUNT_NOT_TEXT',
  ]);
  assert.ok(results.every(item => item.blocksSync));
});

test('diacritics and repeated spaces do not create owner conflicts; possible lost zeros remain a warning', () => {
  const current = row('EMP-1', '12345678', 'Nguyễn  Văn An');
  const result = reviewBankAccounts([current], [snapshot([row()])])[0];
  assert.ok(result.findings.some(item => item.code === 'POSSIBLE_LOST_ZERO'));
  const comparison = compareAccountsAcrossHistory([row('EMP-1', '0012345678', 'Nguyễn  Văn An')], [snapshot([row()])]);
  assert.equal(comparison[0].issues.length, 0);
  assert.equal(current['Beneficiary Account No.'], '12345678');
});

test('new identities stay hidden for absence alone but material bank warnings stay visible', () => {
  const history = [snapshot([row()])];
  const results = compareAccountsAcrossHistory([
    row('NEW', '9988776655', 'LE THI HOA'), row('NEW-ERR', '1E+12', 'LE THI HOA'),
  ], history);
  assert.deepEqual(visibleHistoricalComparisons(results).map(item => item.documentId), ['NEW-ERR']);
});

test('unsafe owner matches cannot offer automatic ID or account synchronization', () => {
  const result = compareAccountsAcrossHistory([row('WRONG')], [
    snapshot([row()]), {...snapshot([row()]), id: '2', period: '2026-02'},
    {...snapshot([row('OTHER', '0012345678', 'TRAN THI BINH')]), id: '3', period: '2026-03'},
  ])[0];
  assert.equal(buildDocumentIdMajorityPlan(result, '09.2026'), null);
  assert.deepEqual(bankAccountResolutionOptions(result), []);
});

test('a historical donor account conflicting with another owner cannot be copied into the current month', () => {
  const donor = row('EMP-1', '0099887766');
  const otherOwner = row('EMP-2', '0099887766', 'TRAN THI BINH');
  for (const conflictLocation of ['current', 'donor-month', 'another-month']) {
    const current = conflictLocation === 'current' ? [row(), otherOwner] : [row()];
    const history = [snapshot(conflictLocation === 'donor-month' ? [donor, otherOwner] : [donor])];
    if (conflictLocation === 'another-month') history.push({...snapshot([otherOwner]), id: '2', period: '2026-02'});
    const comparison = compareAccountsAcrossHistory(current, history)[0];
    assert.equal(comparison.bankCheck?.blocksSync, false);
    const options = bankAccountResolutionOptions(comparison);
    assert.equal(options.length, 1, 'the corrected current account can still repair history');
    assert.equal(options[0].bankCheck?.blocksSync, true, conflictLocation);
  }
});
