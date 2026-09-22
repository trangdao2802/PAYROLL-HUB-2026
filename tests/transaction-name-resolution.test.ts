import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNameResolutionGroup, nameResolutionTargets } from '../src/app/lib/utils/transaction-name-resolution';
import { applyTransactionHistoryResolution, TRANSACTION_HISTORY_RESOLUTIONS_KEY } from '../src/app/lib/utils/transaction-history-resolution';
import { compareAccountsAcrossHistory, type HistoricalSnapshot, type TransactionRow } from '../src/app/lib/utils/transaction-history';
import { summarizeHistoryWarnings } from '../src/app/lib/utils/transaction-history-summary';
import { isSavedTransactionField } from '../src/app/lib/utils/transaction-saved-fields';

const row = (name = 'VU TRINH NHU TRANG', overrides: TransactionRow = {}): TransactionRow => ({
  'Document ID': '001307054285', 'Beneficiary Account No.': '9387246907',
  'Beneficiary Name': name, 'Beneficiary Bank': 'VCB', 'Amount': 790000,
  ...overrides,
});
const version = (id: string, period: string, rows: TransactionRow[]): HistoricalSnapshot => ({id, period, created_at: '2026-09-08T00:00:00Z', rows});

test('manual name choices expose both months despite the existing name conflict warnings', () => {
  const current = version('8', '2026-08-01', [row()]);
  const previous = version('1', '2026-01-01', [row('VU THI NHU TRANG')]);
  assert.equal(compareAccountsAcrossHistory(current.rows, [previous], 'VCB')[0].bankCheck?.blocksSync, true);
  const group = buildNameResolutionGroup(current, [previous], 0, 'VCB')!;
  assert.deepEqual(group.options.map(option => [option.period, option.name]), [
    ['2026-08', 'VU TRINH NHU TRANG'], ['2026-01', 'VU THI NHU TRANG'],
  ]);
  assert.deepEqual(nameResolutionTargets(group, group.options[0].key), [{versionId: '1', period: '2026-01', rowIndexes: [0], names: ['VU THI NHU TRANG']}]);
  assert.deepEqual(nameResolutionTargets(group, group.options[1].key), [{versionId: '8', period: '2026-08', rowIndexes: [0], names: ['VU TRINH NHU TRANG']}]);
  assert.deepEqual(nameResolutionTargets(group, ''), [], 'No month is chosen automatically');
});

test('sync targets exact matching IDs, accounts and banks, including repeated payments', () => {
  const current = version('8', '2026-08', [row()]);
  const previous = version('1', '2026-01', [
    row('VU THI NHU TRANG'), row('VU THI NHU TRANG'),
    row('ANOTHER ID', {'Document ID': 'OTHER'}),
    row('ANOTHER ACCOUNT', {'Beneficiary Account No.': '09387246907'}),
    row('ANOTHER BANK', {'Beneficiary Bank': 'BIDV'}),
  ]);
  const group = buildNameResolutionGroup(current, [previous], 0, 'VCB')!;
  assert.deepEqual(nameResolutionTargets(group, group.options[0].key)[0].rowIndexes, [0, 1]);
  assert.equal(group.options.length, 2);
});

test('missing names can be corrected; invalid names, aliases and unknown banks cannot be donors', () => {
  const current = version('8', '2026-08', [row('')]);
  const prior = version('1', '2026-01', [row(), row('12345')]);
  const group = buildNameResolutionGroup(current, [prior], 0, 'VCB')!;
  assert.deepEqual(group.options.map(option => option.name), ['VU TRINH NHU TRANG']);
  assert.equal(buildNameResolutionGroup(version('8', '2026-08', [row('', {'Beneficiary Account No.': 'nick'})]), [prior], 0, 'VCB'), null);
  assert.equal(buildNameResolutionGroup(version('8', '2026-08', [row('', {'Beneficiary Bank': ''})]), [prior], 0), null);
});

test('case, Vietnamese accents, spacing and absent history do not create a name decision', () => {
  const current = version('8', '2026-08', [row('VŨ TRINH NHƯ TRANG')]);
  assert.equal(buildNameResolutionGroup(current, [version('1', '2026-01', [row('vu  trinh nhu trang')])], 0, 'VCB'), null);
  assert.equal(buildNameResolutionGroup(current, [], 0, 'VCB'), null);
});

test('a month with conflicting names offers explicit choices and only updates changed rows', () => {
  const current = version('8', '2026-08', [row()]);
  const previous = version('1', '2026-01', [row(), row('VU THI NHU TRANG')]);
  const group = buildNameResolutionGroup(current, [previous], 0, 'VCB')!;
  assert.equal(group.options.length, 3);
  assert.deepEqual(nameResolutionTargets(group, group.options[0].key)[0].rowIndexes, [1]);
});

test('name sync preserves amounts and IDs, updates aliases, and retains name audit through later ID sync', () => {
  const original = [row('OLD NAME', {'Full name': 'OLD NAME'}), row('UNRELATED')];
  const updated = applyTransactionHistoryResolution(original, {
    field: 'Beneficiary Name', value: 'NEW NAME', rowIndexes: [0], basedOnPeriods: ['2026-01'], resolvedAt: '2026-09-08T01:00:00Z',
  });
  assert.equal(original[0]['Beneficiary Name'], 'OLD NAME');
  assert.equal(updated[0]['Full name'], 'NEW NAME');
  assert.equal(updated[0]['Document ID'], '001307054285');
  assert.equal(updated[0]['Amount'], 790000);
  assert.equal(updated[1], original[1]);
  assert.equal(isSavedTransactionField(updated[0], 'Beneficiary Name'), true);
  const later = applyTransactionHistoryResolution(updated, {
    field: 'Document ID', value: 'CORRECT-ID', rowIndexes: [0], basedOnPeriods: ['2026-02'], resolvedAt: '2026-09-08T02:00:00Z',
  });
  assert.deepEqual((later[0][TRANSACTION_HISTORY_RESOLUTIONS_KEY] as unknown[])[0], {
    field: 'Beneficiary Name', from: 'OLD NAME', to: 'NEW NAME', basedOnPeriods: ['2026-01'], resolvedAt: '2026-09-08T01:00:00Z',
  });
});

test('name warning summaries stay short without dropping full source details', () => {
  const comparison = compareAccountsAcrossHistory([row()], [version('1', '2026-01', [row('VU THI NHU TRANG')])], 'VCB')[0];
  assert.equal(summarizeHistoryWarnings(comparison), 'Tên khác');
  assert.ok(comparison.issues.join(' ').includes('VU THI NHU TRANG'));
  assert.ok(comparison.issues.length > 1);
});
