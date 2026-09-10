import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compareAccountsAcrossHistory, visibleHistoricalComparisons, type HistoricalSnapshot, type TransactionRow } from '../src/app/lib/utils/transaction-history';
import { createIdentityResolutionBuilder, IDENTITY_FIELDS, identityResolutionTargets, planIdentityResolution } from '../src/app/lib/utils/transaction-identity-resolution';
import { TransactionHistoryTable } from '../src/app/pages/04-balance/components/TransactionHistoryTable';

const row = (values: TransactionRow = {}): TransactionRow => ({
  'Document ID': '001', 'Beneficiary Name': 'NGUYEN VAN AN', 'Beneficiary Account No.': '0012345678', Amount: 500, ...values,
});
const version = (id: string, period: string, rows: TransactionRow[]): HistoricalSnapshot => ({
  id, period: `${period}-01`, created_at: '2026-09-09', rows: rows.map(item => ({...item, 'Tháng báo cáo': period})),
});
const fields = IDENTITY_FIELDS.map(item => item.field);
const changed = ['009', 'NGUYEN VAN BINH', '0099887766'];

for (let mask = 0; mask < 8; mask++) {
  test(`three-field scenario ${mask.toString(2).padStart(3, '0')} only offers the single differing field`, () => {
    const current = version('8', '2026-08', [row()]);
    const past = version('7', '2026-07', [row(Object.fromEntries(fields.filter((_, index) => mask & (1 << index)).map(field => [field, changed[fields.indexOf(field)]])))]);
    const build = createIdentityResolutionBuilder(current, [past], 'VCB');
    const available = fields.filter(field => build(0, field));
    const differences = fields.filter((_, index) => mask & (1 << index));
    assert.deepEqual(available, differences.length === 1 ? differences : []);
    const result = compareAccountsAcrossHistory(current.rows, [past], 'VCB')[0];
    if (mask === 5) {
      assert.equal(visibleHistoricalComparisons([result]).length, 0, 'Name alone does not establish an identity');
      assert.equal(result.sources.length, 0);
    } else if (differences.length === 2) {
      assert.equal(visibleHistoricalComparisons([result]).length, 1);
      assert.equal(result.sources.length, 1);
    }
  });
}

for (const field of fields) {
  for (const empty of ['current', 'history']) {
    test(`${field}: fill a missing ${empty} value using only the valid source`, () => {
      const current = version('8', '2026-08', [row(empty === 'current' ? {[field]: ''} : {})]);
      const past = version('7', '2026-07', [row(empty === 'history' ? {[field]: ''} : {})]);
      const group = createIdentityResolutionBuilder(current, [past], 'VCB')(0, field);
      assert.ok(group);
      assert.equal(group.options.length, 1);
      assert.equal(group.options[0].versionId, empty === 'current' ? '7' : '8');
      assert.deepEqual(identityResolutionTargets(group, group.options[0].key).map(target => target.versionId), [empty === 'current' ? '8' : '7']);
    });
  }
}

test('the chosen value updates only checked months and exact rows, retaining zeroes, amounts and report months', () => {
  const current = version('8', '2026-08', [row(), row({'Document ID': 'OTHER', 'Beneficiary Name': 'OTHER PERSON', 'Beneficiary Account No.': '888888'})]);
  const past = version('7', '2026-07', [row({'Beneficiary Account No.': '009999'})]);
  const older = version('6', '2026-06', [row({'Beneficiary Account No.': '008888'})]);
  const group = createIdentityResolutionBuilder(current, [past, older], 'VCB')(0, 'Beneficiary Account No.');
  assert.ok(group);
  const chosen = group.options.find(option => option.versionId === '7')!;
  const plan = planIdentityResolution([current, past, older], group, chosen.key, ['6'], '2026-09-09T00:00:00Z');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].version.id, '6');
  assert.equal(plan[0].rows[0]['Beneficiary Account No.'], '009999');
  assert.equal(plan[0].rows[0].Amount, 500);
  assert.equal(plan[0].rows[0]['Tháng báo cáo'], '2026-06');
  assert.equal(plan[0].rows[0]['Document ID'], '001');
  assert.equal(current.rows[0]['Beneficiary Account No.'], '0012345678');
  assert.throws(() => planIdentityResolution([current, past], group, chosen.key, ['unrelated'], ''), /không hợp lệ/);
});

test('ambiguous values in one month and shared IDs across different people do not offer sync', () => {
  const current = version('8', '2026-08', [row()]);
  for (const field of fields) {
    const past = version('7', '2026-07', [row(), row({[field]: changed[fields.indexOf(field)]})]);
    assert.equal(createIdentityResolutionBuilder(current, [past], 'VCB')(0, field), null);
  }
  const past = version('7', '2026-07', [row({'Beneficiary Account No.': '009999'}), row({'Beneficiary Name': 'OTHER PERSON', 'Beneficiary Account No.': '777777'})]);
  assert.equal(createIdentityResolutionBuilder(current, [past], 'VCB')(0, 'Beneficiary Account No.'), null);
});

test('a bank change, multiple missing fields or both values blank do not offer sync', () => {
  const current = version('8', '2026-08', [row()]);
  const past = version('7', '2026-07', [row({'Beneficiary Bank': 'OTHER BANK', 'Beneficiary Account No.': '009999'})]);
  assert.equal(createIdentityResolutionBuilder(current, [past], 'VCB')(0, 'Beneficiary Account No.'), null);
  const incomplete = version('7', '2026-07', [row({'Document ID': '', 'Beneficiary Name': ''})]);
  assert.ok(fields.every(field => !createIdentityResolutionBuilder(current, [incomplete], 'VCB')(0, field)));
  const blank = version('8', '2026-08', [row({'Document ID': ''})]);
  assert.equal(createIdentityResolutionBuilder(blank, [version('7', '2026-07', blank.rows)], 'VCB')(0, 'Document ID'), null);
});

test('bad accounts can be repaired but cannot be sources; never infer a leading zero', () => {
  for (const bad of ['', '1.234E+12', 'ACCOUNT-ALIAS', '00000', '001 234', 1234]) {
    const current = version('8', '2026-08', [row({'Beneficiary Account No.': bad})]);
    const past = version('7', '2026-07', [row()]);
    const group = createIdentityResolutionBuilder(current, [past], 'VCB')(0, 'Beneficiary Account No.');
    assert.ok(group);
    assert.deepEqual(group.options.map(option => option.value), ['0012345678']);
  }
  const current = version('8', '2026-08', [row({'Beneficiary Account No.': '12345678'})]);
  const group = createIdentityResolutionBuilder(current, [version('7', '2026-07', [row()])], 'VCB')(0, 'Beneficiary Account No.');
  assert.equal(group?.options.length, 2);
});

test('account used by another ID is excluded as donor while a safe corrective source remains available', () => {
  const current = version('8', '2026-08', [row(), row({'Document ID': 'OTHER', 'Beneficiary Name': 'OTHER PERSON', 'Beneficiary Account No.': '009999'})]);
  const past = version('7', '2026-07', [row({'Beneficiary Account No.': '009999'})]);
  const group = createIdentityResolutionBuilder(current, [past], 'VCB')(0, 'Beneficiary Account No.');
  assert.ok(group);
  assert.deepEqual(group.options.map(option => option.versionId), ['8']);
});

test('normalization does not rewrite matching names; exact duplicate payment rows are retained', () => {
  const current = version('8', '2026-08', [row(), row({Amount: 100})]);
  const past = version('7', '2026-07', [row({'Beneficiary Name': 'Nguyễn  Văn An', 'Document ID': '009'})]);
  const build = createIdentityResolutionBuilder(current, [past], 'VCB');
  assert.equal(build(0, 'Beneficiary Name'), null);
  const group = build(0, 'Document ID')!;
  const chosen = group.options.find(option => option.versionId === '7')!;
  const plan = planIdentityResolution([current, past], group, chosen.key, ['8'], '2026-09-09');
  assert.deepEqual(plan[0].rows.map(item => item.Amount), [500, 100]);
  assert.ok(plan[0].rows.every(item => item['Document ID'] === '009'));
});

test('compact result has five columns, shared values once, grouped months and no source links', () => {
  const current = version('8', '2026-08', [row()]);
  const past = [version('7', '2026-07', [row({'Beneficiary Account No.': '009999'})]), version('6', '2026-06', [row({'Beneficiary Account No.': '009999'})])];
  const comparisons = compareAccountsAcrossHistory(current.rows, past, 'VCB');
  const html = renderToStaticMarkup(createElement(TransactionHistoryTable, {rows: comparisons, month: '08.2026', page: 1, renderActions: () => 'Chọn STK'}));
  assert.equal((html.match(/<th /g) || []).length, 5);
  assert.equal((html.match(/<dd class="font-medium">001<\/dd>/g) || []).length, 1);
  assert.equal((html.match(/<p class="font-semibold">009999<\/p>/g) || []).length, 1);
  assert.ok(html.includes('06, 07/26'));
  assert.ok(!html.includes('href=') && !html.includes('↗') && !html.includes('Mở nguồn'));
});

test('overlapping IDs remain visible even when a direct historical ID matches', () => {
  const current = version('8', '2026-08', [row()]);
  const past = version('7', '2026-07', [row(), row({'Document ID':'009'})]);
  const comparison = compareAccountsAcrossHistory(current.rows, [past], 'VCB')[0];
  assert.ok(comparison.issues.some(issue => issue.includes('Nhiều ID')));
  assert.equal(comparison.sources[0].documentId, '001 | 009');
  assert.equal(createIdentityResolutionBuilder(current, [past], 'VCB')(0, 'Document ID'), null);
});

test('a shared account with a different name blocks ID correction across otherwise matching name/account records', () => {
  const current = version('8','2026-08',[row(),row({'Document ID':'OTHER','Beneficiary Name':'OTHER PERSON'})]);
  const past = version('7','2026-07',[row({'Document ID':'009'})]);
  assert.equal(createIdentityResolutionBuilder(current,[past],'VCB')(0,'Document ID'),null);
});
