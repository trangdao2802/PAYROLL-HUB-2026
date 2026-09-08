import type { TransactionRow } from './transaction-history';

export const TRANSACTION_HISTORY_RESOLUTIONS_KEY = '_transactionHistoryResolutions';

export type TransactionHistoryResolutionField =
  | 'Document ID'
  | 'Beneficiary Account No.';

export interface TransactionHistoryResolutionEntry {
  field: TransactionHistoryResolutionField;
  from: string;
  to: string;
  basedOnPeriods: string[];
  resolvedAt: string;
}

interface ResolutionSource {
  period: string;
  versionId: string;
  documentId: string;
  account: string;
  rowIndexes: number[];
}

interface ResolutionComparison {
  documentId: string;
  currentAccount: string;
  currentRowIndex: number;
  currentRowIndexes?: number[];
  currentDocumentIdVote?: string;
  sources: ResolutionSource[];
}

export type DocumentIdResolutionTarget = {
  location: 'current';
  period: string;
  rowIndexes: number[];
  fromDocumentId: string;
} | {
  location: 'history';
  period: string;
  versionId: string;
  rowIndexes: number[];
  fromDocumentId: string;
};

export interface DocumentIdMajorityPlan {
  targetDocumentId: string;
  supportingPeriods: string[];
  supportLabel: string;
  outliers: DocumentIdResolutionTarget[];
}

export type BankAccountResolutionOption = ResolutionSource;

export interface ApplyTransactionHistoryResolutionOptions {
  field: TransactionHistoryResolutionField;
  value: string;
  rowIndexes: number[];
  basedOnPeriods: string[];
  resolvedAt: string;
}

const valueText = (value: unknown) => String(value ?? '').trim();
const idKey = (value: unknown) => valueText(value).toUpperCase();

function normalizeResolutionPeriod(value: unknown): string {
  const raw = valueText(value).replace(/^Tháng\s*/i, '');
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const display = raw.match(/^(\d{1,2})[./](\d{4})$/);
  if (display) return `${display[2]}-${display[1].padStart(2, '0')}`;
  return raw;
}

function singleDocumentId(value: unknown): string {
  const normalized = idKey(value);
  return normalized && !normalized.includes(' | ') ? normalized : '';
}

export function formatResolutionPeriods(periods: string[]): string {
  const grouped = new Map<string, Set<string>>();
  for (const rawPeriod of periods) {
    const period = normalizeResolutionPeriod(rawPeriod);
    const match = period.match(/^(\d{4})-(\d{2})$/);
    if (!match) continue;
    const months = grouped.get(match[1]) || new Set<string>();
    months.add(match[2]);
    grouped.set(match[1], months);
  }
  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, months]) => `${[...months].sort().join(', ')}/${year.slice(-2)}`)
    .join(' · ');
}

export function buildDocumentIdMajorityPlan(
  comparison: ResolutionComparison,
  currentPeriod: string,
): DocumentIdMajorityPlan | null {
  const records: DocumentIdResolutionTarget[] = [{
    location: 'current',
    period: normalizeResolutionPeriod(currentPeriod),
    rowIndexes: comparison.currentRowIndexes?.length
      ? comparison.currentRowIndexes
      : [comparison.currentRowIndex],
    fromDocumentId: comparison.currentDocumentIdVote || comparison.documentId,
  }, ...comparison.sources.map(source => ({
    location: 'history' as const,
    period: normalizeResolutionPeriod(source.period),
    versionId: source.versionId,
    rowIndexes: source.rowIndexes,
    fromDocumentId: source.documentId,
  }))];

  const counts = new Map<string, number>();
  for (const record of records) {
    const documentId = singleDocumentId(record.fromDocumentId);
    if (documentId) counts.set(documentId, (counts.get(documentId) || 0) + 1);
  }
  const winner = [...counts].sort((left, right) => right[1] - left[1])[0];
  if (!winner || winner[1] < 2 || winner[1] <= records.length / 2) return null;

  const [targetDocumentId] = winner;
  const supportingPeriods = records
    .filter(record => singleDocumentId(record.fromDocumentId) === targetDocumentId)
    .map(record => record.period);
  const outliers = records.filter(
    record => singleDocumentId(record.fromDocumentId) !== targetDocumentId,
  );
  if (!outliers.length || outliers.some(record => !record.rowIndexes.length)) return null;

  return {
    targetDocumentId,
    supportingPeriods,
    supportLabel: formatResolutionPeriods(supportingPeriods),
    outliers,
  };
}

function resolutionEntries(row: TransactionRow): TransactionHistoryResolutionEntry[] {
  const entries = row[TRANSACTION_HISTORY_RESOLUTIONS_KEY];
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry): entry is TransactionHistoryResolutionEntry => (
    entry !== null
    && typeof entry === 'object'
    && (entry.field === 'Document ID' || entry.field === 'Beneficiary Account No.')
    && typeof entry.from === 'string'
    && typeof entry.to === 'string'
    && Array.isArray(entry.basedOnPeriods)
    && typeof entry.resolvedAt === 'string'
  ));
}

function documentIdValue(row: TransactionRow): string {
  return valueText(
    row['Document ID']
    || row['Doc ID']
    || row['ID Number']
    || row['ID NUMBER']
    || row['Document ID / CCCD'],
  );
}

export function documentIdResolutionNote(row: TransactionRow): string {
  const documentId = idKey(documentIdValue(row));
  const latest = resolutionEntries(row).findLast(entry => (
    entry.field === 'Document ID' && idKey(entry.to) === documentId
  ));
  return latest ? formatResolutionPeriods(latest.basedOnPeriods) : '';
}

export function applyTransactionHistoryResolution(
  rows: TransactionRow[],
  options: ApplyTransactionHistoryResolutionOptions,
): TransactionRow[] {
  const selected = new Set(options.rowIndexes);
  return rows.map((row, index) => {
    if (!selected.has(index)) return row;
    const from = options.field === 'Document ID'
      ? documentIdValue(row)
      : valueText(row['Beneficiary Account No.']);
    const entry: TransactionHistoryResolutionEntry = {
      field: options.field,
      from,
      to: options.value,
      basedOnPeriods: options.basedOnPeriods.map(normalizeResolutionPeriod),
      resolvedAt: options.resolvedAt,
    };
    const next: TransactionRow = {
      ...row,
      [options.field]: options.value,
      [TRANSACTION_HISTORY_RESOLUTIONS_KEY]: [...resolutionEntries(row), entry],
    };
    if (options.field === 'Document ID') {
      for (const alias of ['Doc ID', 'ID Number', 'ID NUMBER', 'Document ID / CCCD']) {
        if (alias in row) next[alias] = options.value;
      }
    }
    return next;
  });
}

export function bankAccountResolutionOptions(
  comparison: ResolutionComparison,
): BankAccountResolutionOption[] {
  const currentAccount = valueText(comparison.currentAccount);
  if (!currentAccount) return [];
  const seen = new Set<string>();
  return comparison.sources.filter(source => {
    const account = valueText(source.account);
    if (!account || account.includes(' | ') || account === currentAccount) return false;
    const key = `${source.versionId}\u0000${account}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
