import { normalizeBeneficiaryName, reviewBankAccounts, transactionBank } from './transaction-bank-check';
import { transactionDocumentId, type HistoricalSnapshot, type TransactionRow } from './transaction-history';

export interface NameResolutionOption {
  key: string;
  versionId: string;
  period: string;
  name: string;
}
export interface NameResolutionTarget {
  versionId: string;
  period: string;
  rowIndexes: number[];
  names: string[];
}
export interface NameResolutionGroup {
  documentId: string;
  account: string;
  bank: string;
  options: NameResolutionOption[];
  members: {versionId: string; period: string; rowIndex: number; name: string}[];
}

// Manual name choice is confined to the exact ID + bank + account. The wider
// name/account identity groups used for ID voting must never be used as targets.
export function buildNameResolutionGroup(
  current: HistoricalSnapshot,
  history: HistoricalSnapshot[],
  currentRowIndex: number,
  defaultBank = '',
): NameResolutionGroup | null {
  const row = current.rows[currentRowIndex];
  if (!row) return null;
  const documentId = transactionDocumentId(row).toUpperCase();
  const account = row['Beneficiary Account No.'];
  const bank = transactionBank(row, defaultBank).bank;
  if (!documentId || !bank || typeof account !== 'string' || !/^\d+$/.test(account) || /^0+$/.test(account)) return null;
  const matches = (item: TransactionRow) => transactionDocumentId(item).toUpperCase() === documentId
    && item['Beneficiary Account No.'] === account && transactionBank(item, defaultBank).bank === bank;
  const members: NameResolutionGroup['members'] = [];
  const options = new Map<string, NameResolutionOption>();
  for (const version of [current, ...history]) {
    version.rows.forEach((item, rowIndex) => {
      if (!matches(item)) return;
      const name = String(item['Beneficiary Name'] ?? '').trim();
      const period = version.period.slice(0, 7);
      members.push({versionId: version.id, period, rowIndex, name});
      // Missing or malformed names may be corrected, but cannot be donors.
      if (reviewBankAccounts([item], [], defaultBank)[0].findings.some(finding => finding.code.startsWith('NAME_'))) return;
      const key = JSON.stringify([version.id, normalizeBeneficiaryName(name)]);
      if (!options.has(key)) options.set(key, {key, versionId: version.id, period, name});
    });
  }
  if (!members.some(member => member.versionId !== current.id)
    || new Set(members.map(member => normalizeBeneficiaryName(member.name))).size < 2
    || !options.size) return null;
  return {documentId, account, bank, options: [...options.values()], members};
}

export function nameResolutionTargets(group: NameResolutionGroup, optionKey: string): NameResolutionTarget[] {
  const option = group.options.find(item => item.key === optionKey);
  if (!option) return [];
  const targets = new Map<string, NameResolutionTarget>();
  for (const member of group.members) {
    if (member.name === option.name) continue;
    const target = targets.get(member.versionId) || {
      versionId: member.versionId, period: member.period, rowIndexes: [], names: [],
    };
    target.rowIndexes.push(member.rowIndex);
    if (!target.names.includes(member.name)) target.names.push(member.name);
    targets.set(member.versionId, target);
  }
  return [...targets.values()];
}
