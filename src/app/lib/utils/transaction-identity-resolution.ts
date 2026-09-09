import { normalizeBeneficiaryName, transactionBank } from './transaction-bank-check';
import { transactionDocumentId, type HistoricalSnapshot, type TransactionRow } from './transaction-history';
import { applyTransactionHistoryResolution, type TransactionHistoryResolutionField } from './transaction-history-resolution';

export const IDENTITY_FIELDS = [
  {field: 'Document ID', label: 'ID', rule: 'Cùng tên và STK, cùng ngân hàng.'},
  {field: 'Beneficiary Name', label: 'tên', rule: 'Cùng ID và STK, cùng ngân hàng.'},
  {field: 'Beneficiary Account No.', label: 'STK', rule: 'Cùng ID và tên, cùng ngân hàng.'},
] as const;

interface Member {
  versionId: string;
  period: string;
  rowIndex: number;
  row: TransactionRow;
  bank: string;
}
export interface IdentityResolutionOption {
  key: string;
  versionId: string;
  period: string;
  value: string;
}
export interface IdentityResolutionGroup {
  field: TransactionHistoryResolutionField;
  options: IdentityResolutionOption[];
  members: Member[];
}
export interface IdentityResolutionTarget {
  versionId: string;
  period: string;
  rowIndexes: number[];
  fromValues: string[];
}
export const identityValue = (row: TransactionRow, field: TransactionHistoryResolutionField) =>
  field === 'Document ID' ? transactionDocumentId(row) : String(row[field] ?? '').trim();
const normalized = (row: TransactionRow, field: TransactionHistoryResolutionField) => {
  const value = identityValue(row, field);
  return field === 'Beneficiary Name' ? normalizeBeneficiaryName(value)
    : field === 'Document ID' ? value.toUpperCase() : value;
};

function usable(row: TransactionRow, field: TransactionHistoryResolutionField): boolean {
  const value = identityValue(row, field);
  if (!value || value.includes('|') || /\p{Cc}|\p{Cf}/u.test(value)) return false;
  if (field === 'Beneficiary Name') return /\p{L}/u.test(value) && !/\d/u.test(value);
  if (field === 'Beneficiary Account No.') {
    return typeof row[field] === 'string' && /^\d+$/.test(row[field] as string) && !/^0+$/.test(value);
  }
  return !/\s/.test(value) && !/^0+$/.test(value) && !/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(value);
}

/** A field choice requires two complete, matching identity fields. No fuzzy
 * name-only/account-only match, majority vote or first-row choice may write data. */
export function createIdentityResolutionBuilder(current: HistoricalSnapshot, history: HistoricalSnapshot[], defaultBank = '') {
  const versions = [current, ...history];
  const all: Member[] = versions.flatMap(version => version.rows.map((row, rowIndex) => ({
    versionId: version.id, period: version.period.slice(0, 7), rowIndex, row,
    bank: transactionBank(row, defaultBank).bank,
  })));

  return (rowIndex: number, field: TransactionHistoryResolutionField): IdentityResolutionGroup | null => {
    const row = current.rows[rowIndex];
    if (!row) return null;
    const bank = transactionBank(row, defaultBank).bank;
    const anchors = IDENTITY_FIELDS.map(item => item.field).filter(item => item !== field);
    if (!bank || !anchors.every(anchor => usable(row, anchor))) return null;
    const matches = (item: Member) => item.bank === bank && anchors.every(anchor =>
      usable(item.row, anchor) && normalized(item.row, anchor) === normalized(row, anchor));
    const members = all.filter(matches);
    if (!members.some(member => member.versionId !== current.id)) return null;

    // A repeated identity with conflicting values within a month is not a
    // single employee correction. Exact duplicate payment rows remain valid.
    const byMonth = new Map<string, Set<string>>();
    for (const member of members) {
      const values = byMonth.get(member.versionId) || new Set<string>();
      values.add(normalized(member.row, field));
      byMonth.set(member.versionId, values);
    }
    if ([...byMonth.values()].some(values => values.size > 1)) return null;
    if (new Set(members.map(member => normalized(member.row, field))).size < 2) return null;

    const memberIds = new Set(members.map(member => normalized(member.row, 'Document ID')).filter(Boolean));
    // Same ID with another name AND account, a different bank, or overlapping
    // identities elsewhere needs verification before any field is copied.
    if (all.some(item => memberIds.has(normalized(item.row, 'Document ID')) && !matches(item))) return null;
    if (field === 'Beneficiary Name' && all.some(item => item.bank === bank
      && normalized(item.row, 'Beneficiary Account No.') === normalized(row, 'Beneficiary Account No.')
      && normalized(item.row, 'Document ID') !== normalized(row, 'Document ID'))) return null;
    if (field === 'Document ID' && all.some(item => item.bank === bank
      && normalized(item.row, 'Beneficiary Account No.') === normalized(row, 'Beneficiary Account No.')
      && normalized(item.row, 'Beneficiary Name') !== normalized(row, 'Beneficiary Name'))) return null;

    const options = new Map<string, IdentityResolutionOption>();
    for (const member of members) {
      if (!usable(member.row, field)) continue;
      // An account associated with another employee cannot be a donor. A bad
      // target account can still be repaired using a different, valid donor.
      if (field === 'Beneficiary Account No.' && all.some(item => item.bank === bank
        && normalized(item.row, field) === normalized(member.row, field)
        && (!normalized(item.row, 'Document ID')
          || normalized(item.row, 'Document ID') !== normalized(row, 'Document ID')
          || normalized(item.row, 'Beneficiary Name') !== normalized(row, 'Beneficiary Name')))) continue;
      const key = JSON.stringify([member.versionId, normalized(member.row, field)]);
      if (!options.has(key)) options.set(key, {
        key, versionId: member.versionId, period: member.period, value: identityValue(member.row, field),
      });
    }
    return options.size ? {field, options: [...options.values()], members} : null;
  };
}

export function identityResolutionTargets(group: IdentityResolutionGroup, optionKey: string): IdentityResolutionTarget[] {
  const option = group.options.find(item => item.key === optionKey);
  if (!option) return [];
  const donor = group.members.find(item => item.versionId === option.versionId
    && identityValue(item.row, group.field) === option.value);
  if (!donor) return [];
  const targets = new Map<string, IdentityResolutionTarget>();
  for (const member of group.members) {
    if (normalized(member.row, group.field) === normalized(donor.row, group.field)) continue;
    const target = targets.get(member.versionId) || {
      versionId: member.versionId, period: member.period, rowIndexes: [], fromValues: [],
    };
    target.rowIndexes.push(member.rowIndex);
    const from = identityValue(member.row, group.field);
    if (!target.fromValues.includes(from)) target.fromValues.push(from);
    targets.set(member.versionId, target);
  }
  return [...targets.values()].sort((left, right) => left.period.localeCompare(right.period));
}

export function planIdentityResolution(
  versions: HistoricalSnapshot[], group: IdentityResolutionGroup, optionKey: string,
  selectedVersionIds: string[], resolvedAt: string,
) {
  const option = group.options.find(item => item.key === optionKey);
  if (!option) throw new Error('Hãy chọn tháng có giá trị đúng.');
  const targets = identityResolutionTargets(group, optionKey);
  const selected = new Set(selectedVersionIds);
  if (!selected.size || [...selected].some(id => !targets.some(target => target.versionId === id))) {
    throw new Error('Danh sách tháng cập nhật không hợp lệ.');
  }
  return targets.filter(target => selected.has(target.versionId)).map(target => {
    const version = versions.find(item => item.id === target.versionId);
    if (!version) throw new Error('Không tìm thấy tháng cần cập nhật.');
    return {version, rows: applyTransactionHistoryResolution(version.rows, {
      field: group.field, value: option.value, rowIndexes: target.rowIndexes,
      basedOnPeriods: [option.period], resolvedAt,
    })};
  });
}
