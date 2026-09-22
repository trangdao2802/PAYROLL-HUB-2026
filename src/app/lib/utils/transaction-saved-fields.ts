import type { TransactionRow } from './transaction-history';

const SAVED_IDENTITY = '_savedTransactionIdentity';
const IDENTITY_ALIASES: Record<string, string[]> = {
  'Document ID': ['Doc ID', 'ID Number', 'ID NUMBER', 'Document ID / CCCD'],
  'Beneficiary Account No.': ['Bank Account Number', 'BANK ACCOUNT NUMBER', 'Số tài khoản', 'STK'],
  'Beneficiary Name': ['Full name', 'Full Name', 'FULL NAME', 'Họ tên', 'Họ và tên'],
};

export function editTransactionField(row: TransactionRow, field: string, value: unknown): TransactionRow {
  const next = {...row, [field]: value};
  for (const alias of IDENTITY_ALIASES[field] || []) {
    if (alias in row) next[alias] = value;
  }
  return next;
}

/** An explicitly saved identity takes precedence over inferred Raw Timesheet repairs. */
export function protectSavedTransactionIdentity(row: TransactionRow): TransactionRow {
  const fields: Record<string, unknown> = {};
  for (const [canonical, aliases] of Object.entries(IDENTITY_ALIASES)) {
    for (const key of [canonical, ...aliases]) if (key in row) fields[key] = row[key];
  }
  return {...row, [SAVED_IDENTITY]: fields};
}

export function isSavedTransactionField(row: TransactionRow, key: string): boolean {
  const fields = row[SAVED_IDENTITY];
  return Boolean(fields && typeof fields === 'object'
    && Object.prototype.hasOwnProperty.call(fields, key)
    && (fields as Record<string, unknown>)[key] === row[key]);
}
