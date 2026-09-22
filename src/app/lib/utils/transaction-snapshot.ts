import { normalizePeriod, selectPeriodRows, type TransactionRow } from './transaction-history';

function fingerprint(rows: TransactionRow[]): string {
  // JSONB does not retain object key order. Array/row order and every stored value matter.
  return JSON.stringify(rows, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value);
}

export function sameTransactionSnapshot(localRows: TransactionRow[], savedRows: TransactionRow[], month: string): boolean {
  try {
    return fingerprint(selectPeriodRows(localRows, month)) === fingerprint(selectPeriodRows(savedRows, month));
  } catch { return false; }
}

/** Map snapshot-relative row indexes back to the complete local table without touching other months. */
export function replaceTransactionPeriod(rows: TransactionRow[], month: string, replacement: TransactionRow[]): TransactionRow[] {
  const period = normalizePeriod(month);
  const selected = selectPeriodRows(replacement, period);
  if (selected.length !== replacement.length) throw new Error('Dữ liệu thay thế phải thuộc đúng tháng đang chọn.');
  const output: TransactionRow[] = [];
  let inserted = false;
  for (const row of rows) {
    const raw = row['Tháng báo cáo'] || row._fileMonth;
    if (raw && normalizePeriod(raw) === period) {
      if (!inserted) output.push(...selected);
      inserted = true;
    } else output.push(row);
  }
  if (!inserted) output.push(...selected);
  return output;
}
