import { documentIdResolutionNote } from './transaction-history-resolution';
import { normalizeBeneficiaryName, reviewBankAccounts, transactionBank, type BankAccountReview } from './transaction-bank-check';

export type TransactionRow = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '').trim();
const name = normalizeBeneficiaryName;
const DOCUMENT_ID_KEYS = [
  'Document ID',
  'Doc ID',
  'ID Number',
  'ID NUMBER',
  'Document ID / CCCD',
] as const;

export function transactionDocumentId(row: TransactionRow): string {
  for (const key of DOCUMENT_ID_KEYS) {
    const value = text(row[key]);
    if (value) return value;
  }
  return '';
}

export function withCanonicalTransactionDocumentId(
  row: TransactionRow,
): TransactionRow {
  const documentId = transactionDocumentId(row);
  return row['Document ID'] === documentId
    ? row
    : { ...row, 'Document ID': documentId };
}

export function canonicalTransactionHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  return headers
    .map(header => /^(document id|doc id|id number|document id \/ cccd)$/i.test(header.trim())
      ? 'Document ID'
      : header)
    .filter(header => {
      const normalized = header.trim().toUpperCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function normalizePeriod(value: unknown): string {
  const raw = text(value).replace(/^Tháng\s*/i, '');
  const iso = raw.match(/^(\d{4})-(\d{2})$/);
  const display = raw.match(/^(\d{1,2})[./](\d{4})$/);
  const year = Number(iso?.[1] ?? display?.[2]);
  const month = Number(iso?.[2] ?? display?.[1]);
  if (!year || year < 1900 || month < 1 || month > 12 || !Number.isInteger(month)) {
    throw new Error('Tháng không hợp lệ. Dùng MM.YYYY hoặc YYYY-MM.');
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function previousPeriod(value: unknown): string {
  const [year, month] = normalizePeriod(value).split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function selectPeriodRows(rows: TransactionRow[], period: string): TransactionRow[] {
  const target = normalizePeriod(period);
  const selected = rows.filter(row => {
    if (row._isSubtotal || row._isTotalRow) return false;
    const source = text(row['Tháng báo cáo']) || text(row._fileMonth);
    if (!source) throw new Error('Có dòng Transaction thiếu tháng báo cáo.');
    return normalizePeriod(source) === target;
  }).map(row => ({...row, 'Tháng báo cáo': target,
    // Transaction uses Document ID as its canonical field. ID Number is kept
    // as a read-compatible legacy alias for snapshots saved by older builds.
    'Document ID': transactionDocumentId(row),
    'Beneficiary Account No.': text(row['Beneficiary Account No.']),
    'Beneficiary Name': text(row['Beneficiary Name']),
  }));
  if (!selected.length) throw new Error('Không có Transaction thuộc tháng đang chọn.');
  return selected;
}

export interface AccountComparison {
  documentId: string;
  previousDocumentId: string;
  currentAccount: string;
  previousAccount: string;
  currentName: string;
  previousName: string;
  issues: string[];
}

function groupById(rows: TransactionRow[]): Map<string, TransactionRow[]> {
  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const id = transactionDocumentId(row).toUpperCase();
    if (id) {
      const group = groups.get(id);
      if (group) group.push(row);
      else groups.set(id, [row]);
    }
  }
  return groups;
}
const conflicting = (rows: TransactionRow[]) => new Set(rows.map(row => JSON.stringify([
  text(row['Beneficiary Account No.']), name(row['Beneficiary Name']),
]))).size > 1;

export function compareAccounts(current: TransactionRow[], previous: TransactionRow[] | null): AccountComparison[] {
  const currentGroups = groupById(current);
  const previousGroups = groupById(previous || []);
  const currentConflicts = new Set([...currentGroups].filter(([, rows]) => conflicting(rows)).map(([id]) => id));
  const previousConflicts = new Set([...previousGroups].filter(([, rows]) => conflicting(rows)).map(([id]) => id));
  const previousValues = new Map([...previousGroups].map(([id, rows]) => [id, {
    documentId: [...new Set(rows.map(transactionDocumentId).filter(Boolean))].join(' | '),
    account: [...new Set(rows.map(r => text(r['Beneficiary Account No.'])))].join(' | '),
    name: previousConflicts.has(id)
      ? [...new Set(rows.map(r => text(r['Beneficiary Name'])))].join(' | ')
      : text(rows[0]['Beneficiary Name']),
  }]));
  return current.map(row => {
    const documentId = transactionDocumentId(row).toUpperCase();
    const currentAccount = text(row['Beneficiary Account No.']);
    const currentName = text(row['Beneficiary Name']);
    const matches = previousGroups.get(documentId) || [];
    const issues: string[] = [];
    if (!documentId) issues.push('Thiếu Document ID');
    if (!currentAccount) issues.push('Thiếu STK tháng này');
    if (!currentName) issues.push('Thiếu tên tháng này');
    const currentConflict = currentConflicts.has(documentId);
    const previousConflict = previousConflicts.has(documentId);
    if (currentConflict) issues.push('ID mâu thuẫn tháng này');
    if (previousConflict) issues.push('ID mâu thuẫn tháng trước');
    if (previous === null) issues.push('Chưa có dữ liệu tháng trước');
    else if (documentId && !matches.length) issues.push('Không có ID ở tháng trước');
    const previousDocumentId = previousValues.get(documentId)?.documentId || '';
    const previousAccount = previousValues.get(documentId)?.account || '';
    const previousName = previousValues.get(documentId)?.name || '';
    if (matches.length && !previousConflict && !currentConflict) {
      if (!previousAccount) issues.push('Thiếu STK tháng trước');
      else if (currentAccount && currentAccount !== previousAccount) issues.push('STK khác');
      if (!previousName) issues.push('Thiếu tên tháng trước');
      else if (currentName && name(currentName) !== name(previousName)) issues.push('Tên khác');
    }
    return {documentId, previousDocumentId, currentAccount, previousAccount, currentName, previousName, issues};
  });
}

export interface HistoricalSnapshot {
  id: string;
  period: string;
  created_at: string;
  rows: TransactionRow[];
}
export interface HistoricalAccountComparison extends AccountComparison {
  bankCheck?: BankAccountReview;
  currentRowIndex: number;
  currentRowIndexes: number[];
  currentDocumentIdVote: string;
  currentDocumentIdSyncNote: string;
  sources: {
    bankCheck?: BankAccountReview;
    period: string;
    versionId: string;
    createdAt: string;
    documentId: string;
    documentIdSyncNote: string;
    account: string;
    name: string;
    rowIndexes: number[];
  }[];
}

export const MISSING_HISTORICAL_ID_ISSUE = 'Không có ID trong các tháng đã lưu';

export function visibleHistoricalComparisons(
  comparisons: HistoricalAccountComparison[],
): HistoricalAccountComparison[] {
  return comparisons.filter(
    comparison => !comparison.issues.includes(MISSING_HISTORICAL_ID_ISSUE)
      || Boolean(comparison.bankCheck?.findings.length),
  );
}

export function formatHistoryDate(value: unknown): string {
  const raw = text(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isValid = date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);

  return isValid ? `${day}/${month}/${year.slice(-2)}` : raw;
}

function nameAndAccountKey(row: TransactionRow, defaultBank = ''): string {
  const account = text(row['Beneficiary Account No.']);
  const normalizedName = name(row['Beneficiary Name']);
  return account && normalizedName ? JSON.stringify([transactionBank(row, defaultBank).bank, account, normalizedName]) : '';
}

function groupByNameAndAccount(
  rows: TransactionRow[],
  defaultBank = '',
): Map<string, TransactionRow[]> {
  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const key = nameAndAccountKey(row, defaultBank);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function uniqueJoined(values: string[]): string {
  return [...new Set(values.filter(Boolean))].join(' | ');
}

export function compareAccountsAcrossHistory(current: TransactionRow[], history: HistoricalSnapshot[], defaultBank = ''): HistoricalAccountComparison[] {
  const bankChecks = reviewBankAccounts(current, history, defaultBank);
  const currentIdentities = groupByNameAndAccount(current, defaultBank);
  const currentIndexes = new Map(current.map((item, index) => [item, index]));
  const results = compareAccounts(current, []).map((row, currentRowIndex) => ({
    ...row, issues: row.issues.filter(issue => issue !== 'Không có ID ở tháng trước'),
    bankCheck: bankChecks[currentRowIndex],
    currentRowIndex,
    currentRowIndexes: (currentIdentities.get(nameAndAccountKey(current[currentRowIndex], defaultBank)) || [current[currentRowIndex]])
      .map(item => currentIndexes.get(item))
      .filter((index): index is number => index !== undefined),
    currentDocumentIdVote: uniqueJoined(
      (currentIdentities.get(nameAndAccountKey(current[currentRowIndex], defaultBank)) || [current[currentRowIndex]])
        .map(item => transactionDocumentId(item).toUpperCase()),
    ),
    currentDocumentIdSyncNote: documentIdResolutionNote(current[currentRowIndex]),
    sources: [] as HistoricalAccountComparison['sources'],
  }));
  for (const snapshot of history) {
    const period = snapshot.period.slice(0, 7);
    const snapshotIndexes = new Map(snapshot.rows.map((item, index) => [item, index]));
    // A donor account must also be checked against other IDs, months and current rows.
    const sourceBankChecks = reviewBankAccounts(snapshot.rows, [
      ...history.filter(version => version !== snapshot),
      {id: '', period: 'Hiện tại', created_at: '', rows: current},
    ], defaultBank);
    const ids = groupById(snapshot.rows);
    const identities = groupByNameAndAccount(snapshot.rows, defaultBank);
    const comparisons = compareAccounts(current, snapshot.rows);
    comparisons.forEach((comparison, index) => {
      const result = results[index];
      const directMatches = ids.get(comparison.documentId) || [];
      const identityMatches = directMatches.length > 0
        ? directMatches
        : identities.get(nameAndAccountKey(current[index], defaultBank)) || [];
      if (!identityMatches.length) return;

      const sourceDocumentId = uniqueJoined(
        identityMatches.map(row => transactionDocumentId(row).toUpperCase()),
      );
      const sourceAccount = directMatches.length > 0
        ? comparison.previousAccount
        : uniqueJoined(identityMatches.map(row => text(row['Beneficiary Account No.'])));
      const sourceName = directMatches.length > 0
        ? comparison.previousName
        : uniqueJoined(identityMatches.map(row => text(row['Beneficiary Name'])));
      result.sources.push({
        bankCheck: identityMatches.map(row => sourceBankChecks[snapshotIndexes.get(row)!])
          .find(check => check.blocksSync),
        period,
        versionId: snapshot.id,
        createdAt: snapshot.created_at,
        documentId: sourceDocumentId,
        documentIdSyncNote: uniqueJoined(identityMatches.map(documentIdResolutionNote)),
        account: sourceAccount,
        name: sourceName,
        rowIndexes: identityMatches
          .map(row => snapshotIndexes.get(row))
          .filter((index): index is number => index !== undefined),
      });

      if (!directMatches.length) {
        const issue = !sourceDocumentId
          ? 'Thiếu Document ID tháng nguồn'
          : sourceDocumentId.includes(' | ')
            ? `Document ID lịch sử mâu thuẫn (${sourceDocumentId})`
            : comparison.documentId
              ? `Document ID khác (${sourceDocumentId} → ${comparison.documentId})`
              : '';
        if (issue) result.issues.push(`${period} (#${snapshot.id}): ${issue}`);
        return;
      }

      for (const issue of comparison.issues) {
        if (!result.issues.includes(issue) && !issue.includes('tháng này') && issue !== 'Thiếu Document ID') {
          result.issues.push(`${period} (#${snapshot.id}): ${issue.replace('tháng trước', 'tháng nguồn')}`);
        }
      }
    });
  }
  return results.map(result => ({ ...result,
    previousDocumentId: uniqueJoined(result.sources.map(source => source.documentId)),
    previousAccount: [...new Set(result.sources.map(source => source.account))].join(' | '),
    previousName: [...new Set(result.sources.map(source => source.name))].join(' | '),
    issues: [...result.issues, ...result.bankCheck.findings.map(item => item.message), ...(!history.length ? ['Chưa có lịch sử trước tháng đang chọn']
      : result.documentId && !result.sources.length ? [MISSING_HISTORICAL_ID_ISSUE] : [])],
  }));
}
