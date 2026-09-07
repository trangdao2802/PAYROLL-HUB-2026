export type TransactionRow = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '').trim();
const name = (value: unknown) => text(value).replace(/\s+/g, ' ').toUpperCase();

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
    'Document ID': text(row['Document ID']),
    'Beneficiary Account No.': text(row['Beneficiary Account No.']),
    'Beneficiary Name': text(row['Beneficiary Name']),
  }));
  if (!selected.length) throw new Error('Không có Transaction thuộc tháng đang chọn.');
  return selected;
}

export interface AccountComparison {
  documentId: string;
  currentAccount: string;
  previousAccount: string;
  currentName: string;
  previousName: string;
  issues: string[];
}

function groupById(rows: TransactionRow[]): Map<string, TransactionRow[]> {
  const groups = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const id = text(row['Document ID']).toUpperCase();
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
    account: [...new Set(rows.map(r => text(r['Beneficiary Account No.'])))].join(' | '),
    name: previousConflicts.has(id)
      ? [...new Set(rows.map(r => text(r['Beneficiary Name'])))].join(' | ')
      : text(rows[0]['Beneficiary Name']),
  }]));
  return current.map(row => {
    const documentId = text(row['Document ID']).toUpperCase();
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
    const previousAccount = previousValues.get(documentId)?.account || '';
    const previousName = previousValues.get(documentId)?.name || '';
    if (matches.length && !previousConflict && !currentConflict) {
      if (!previousAccount) issues.push('Thiếu STK tháng trước');
      else if (currentAccount && currentAccount !== previousAccount) issues.push('STK khác');
      if (!previousName) issues.push('Thiếu tên tháng trước');
      else if (currentName && name(currentName) !== name(previousName)) issues.push('Tên khác');
    }
    return {documentId, currentAccount, previousAccount, currentName, previousName, issues};
  });
}
