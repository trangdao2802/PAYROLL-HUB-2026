import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBeneficiaryName } from './transaction-bank-check';
import { transactionDocumentId, type TransactionRow } from './transaction-history';

export interface TransactionEmployeeRecord {
  ma_nv: string;
  ho_ten: string;
  bank_number_acc: string;
}

export interface TransactionEmployeeSyncSummary {
  synced: number;
  inserted: number;
  updated: number;
  skipped: number;
  skippedDocumentIds: string[];
}

interface EmployeeGroup {
  ma_nv: string;
  names: Map<string, string>;
  accounts: Set<string>;
}

interface ExistingEmployee {
  id: string;
  ma_nv: string;
  ho_ten: string | null;
  bank_number_acc: string | null;
}

const text = (value: unknown) => String(value ?? '').trim();
const firstText = (row: TransactionRow, keys: string[]) => {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return '';
};

function employeeKey(value: string): string {
  return value.toUpperCase();
}

/**
 * Reduce one saved Transaction month to the unambiguous employee identities
 * that may be written to nhan_vien. Conflicting values are deliberately left
 * for the reconciliation dialog instead of silently picking one row.
 */
export function buildTransactionEmployeeRecords(rows: TransactionRow[]): {
  records: TransactionEmployeeRecord[];
  skippedDocumentIds: string[];
} {
  const groups = new Map<string, EmployeeGroup>();
  for (const row of rows) {
    if (row._isSubtotal || row._isTotalRow) continue;
    const maNv = text(transactionDocumentId(row));
    if (!maNv) continue;
    const key = employeeKey(maNv);
    const group = groups.get(key) || {ma_nv: maNv, names: new Map(), accounts: new Set()};
    const name = firstText(row, ['Beneficiary Name', 'Full Name', 'Full name', 'FULL NAME', 'Họ tên', 'Họ và tên']);
    if (name) {
      const normalized = normalizeBeneficiaryName(name);
      if (!group.names.has(normalized)) group.names.set(normalized, name);
    }
    const account = firstText(row, ['Beneficiary Account No.', 'Bank Account Number', 'BANK ACCOUNT NUMBER', 'STK', 'Số tài khoản']);
    if (account) group.accounts.add(account);
    groups.set(key, group);
  }

  const skippedDocumentIds: string[] = [];
  const records: TransactionEmployeeRecord[] = [];
  for (const group of groups.values()) {
    if (group.names.size > 1 || group.accounts.size > 1) {
      skippedDocumentIds.push(group.ma_nv);
      continue;
    }
    records.push({
      ma_nv: group.ma_nv,
      ho_ten: [...group.names.values()][0] || '',
      bank_number_acc: [...group.accounts][0] || '',
    });
  }
  return {records, skippedDocumentIds};
}

function syncError(action: string, error: {message?: string; code?: string}): Error {
  const code = error.code ? ` [${error.code}]` : '';
  return new Error(`Không thể ${action} bảng nhan_vien${code}: ${error.message || 'Lỗi không xác định.'}`);
}

/**
 * Upsert the current Transaction month into the actual payroll directory
 * schema: ma_nv = Document ID, ho_ten = Beneficiary Name and
 * bank_number_acc = Beneficiary Account No. Existing values are merged when
 * the current Transaction cell is blank so a partial row cannot erase master
 * data. The table's unique ma_nv key makes the operation idempotent.
 */
export async function syncTransactionEmployeesToSupabase(
  client: SupabaseClient,
  rows: TransactionRow[],
): Promise<TransactionEmployeeSyncSummary> {
  const {records, skippedDocumentIds} = buildTransactionEmployeeRecords(rows);
  if (!records.length) {
    return {synced: 0, inserted: 0, updated: 0, skipped: skippedDocumentIds.length, skippedDocumentIds};
  }

  const existing = new Map<string, ExistingEmployee>();
  for (let offset = 0; offset < records.length; offset += 100) {
    const ids = records.slice(offset, offset + 100).map(record => record.ma_nv);
    const {data, error} = await client
      .from('nhan_vien')
      .select('id,ma_nv,ho_ten,bank_number_acc')
      .in('ma_nv', ids);
    if (error) throw syncError('đọc', error);
    for (const row of (data || []) as ExistingEmployee[]) {
      existing.set(employeeKey(text(row.ma_nv)), row);
    }
  }

  // Keep inserts and updates in separate requests. PostgREST builds one
  // column list for each bulk upsert; mixing rows with an existing `id` and
  // new rows without one can turn the missing id into explicit null.
  const updatePayload = records.flatMap(record => {
    const prior = existing.get(employeeKey(record.ma_nv));
    return prior ? [{
      id: prior.id,
      ma_nv: prior.ma_nv,
      ho_ten: record.ho_ten || text(prior.ho_ten),
      bank_number_acc: record.bank_number_acc || text(prior.bank_number_acc),
    }] : [];
  });
  const insertPayload = records.filter(record => !existing.has(employeeKey(record.ma_nv)));

  for (const payload of [updatePayload, insertPayload]) {
    for (let offset = 0; offset < payload.length; offset += 100) {
      const {error} = await client
        .from('nhan_vien')
        .upsert(payload.slice(offset, offset + 100), {onConflict: 'ma_nv'});
      if (error) throw syncError('ghi', error);
    }
  }

  const updated = records.filter(record => existing.has(employeeKey(record.ma_nv))).length;
  return {
    synced: records.length,
    inserted: records.length - updated,
    updated,
    skipped: skippedDocumentIds.length,
    skippedDocumentIds,
  };
}
