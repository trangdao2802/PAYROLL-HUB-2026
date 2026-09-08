import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTransactionHistoryResolution,
  bankAccountResolutionOptions,
  buildDocumentIdMajorityPlan,
  documentIdResolutionNote,
  formatResolutionPeriods,
} from '../src/app/lib/utils/transaction-history-resolution';

const comparison = {
  documentId: '001',
  currentAccount: 'CURRENT-ACC',
  currentRowIndex: 4,
  sources: [
    {period: '2026-01', versionId: '1', documentId: '001', account: 'CURRENT-ACC', rowIndexes: [0]},
    {period: '2026-02', versionId: '2', documentId: '001', account: 'OLD-ACC', rowIndexes: [1]},
    {period: '2026-03', versionId: '3', documentId: '999', account: 'OTHER-ACC', rowIndexes: [2]},
  ],
};

test('a strict cross-month ID majority proposes only the outlier month', () => {
  const plan = buildDocumentIdMajorityPlan(comparison, '08.2026');

  assert.equal(plan?.targetDocumentId, '001');
  assert.equal(plan?.supportLabel, '01, 02, 08/26');
  assert.deepEqual(plan?.outliers, [{
    location: 'history',
    period: '2026-03',
    versionId: '3',
    rowIndexes: [2],
    fromDocumentId: '999',
  }]);
});

test('ID synchronization is not proposed for a tie or a one-month value', () => {
  assert.equal(buildDocumentIdMajorityPlan({
    ...comparison,
    documentId: '999',
    sources: [comparison.sources[0]],
  }, '08.2026'), null);
  assert.equal(buildDocumentIdMajorityPlan({
    ...comparison,
    sources: [],
  }, '08.2026'), null);
});

test('the current month can be identified as the outlier', () => {
  const plan = buildDocumentIdMajorityPlan({
    ...comparison,
    documentId: '999',
    sources: comparison.sources.slice(0, 2),
  }, '08.2026');

  assert.equal(plan?.targetDocumentId, '001');
  assert.deepEqual(plan?.outliers, [{
    location: 'current',
    period: '2026-08',
    rowIndexes: [4],
    fromDocumentId: '999',
  }]);
});

test('conflicting IDs inside the current month count as one outlier month', () => {
  const plan = buildDocumentIdMajorityPlan({
    ...comparison,
    documentId: '999',
    currentDocumentIdVote: '999 | 888',
    currentRowIndexes: [4, 5],
    sources: comparison.sources.slice(0, 2),
  }, '08.2026');

  assert.equal(plan?.targetDocumentId, '001');
  assert.deepEqual(plan?.outliers[0].rowIndexes, [4, 5]);
});

test('resolution changes only selected rows and records a display-only ID note', () => {
  const untouched = {'Document ID': 'KEEP'};
  const rows = [
    {'Document ID': 'OLD', 'ID Number': 'OLD'},
    untouched,
  ];
  const resolved = applyTransactionHistoryResolution(rows, {
    field: 'Document ID',
    value: 'NEW',
    rowIndexes: [0],
    basedOnPeriods: ['2026-01', '2026-02'],
    resolvedAt: '2026-09-08T00:00:00.000Z',
  });

  assert.equal(resolved[0]['Document ID'], 'NEW');
  assert.equal(resolved[0]['ID Number'], 'NEW');
  assert.equal(documentIdResolutionNote(resolved[0]), '01, 02/26');
  assert.equal(resolved[1], untouched);
  assert.equal(resolved[0]['Document ID'].includes('!'), false);
});

test('bank-account decisions are offered once for each unambiguous mismatched month', () => {
  assert.deepEqual(
    bankAccountResolutionOptions(comparison).map(option => [option.period, option.account]),
    [['2026-02', 'OLD-ACC'], ['2026-03', 'OTHER-ACC']],
  );
  assert.equal(formatResolutionPeriods(['2025-12', '2026-01', '2026-03']), '12/25 · 01, 03/26');
});

test('copying the latest saved account updates legacy account fields used by reconciliation', () => {
  const resolved = applyTransactionHistoryResolution([
    {'Document ID': 'EMP-1', 'Beneficiary Account No.': '0099887766', 'Bank Account Number': '0099887766'},
  ], {
    field: 'Beneficiary Account No.', value: '0011223344', rowIndexes: [0],
    basedOnPeriods: ['2026-08'], resolvedAt: '2026-09-08T00:00:00Z',
  });
  assert.equal(resolved[0]['Beneficiary Account No.'], '0011223344');
  assert.equal(resolved[0]['Bank Account Number'], '0011223344');
});
