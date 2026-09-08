import type { HistoricalAccountComparison } from './transaction-history';
import { normalizeBeneficiaryName } from './transaction-bank-check';

export const HISTORY_IDENTITY_FIELDS = [
  {key: 'documentId', label: 'Document ID', column: 'Document ID'},
  {key: 'account', label: 'STK', column: 'Beneficiary Account No.'},
  {key: 'name', label: 'Tên người hưởng', column: 'Beneficiary Name'},
] as const;
export type HistoryIdentityKey = typeof HISTORY_IDENTITY_FIELDS[number]['key'];
type HistorySource = HistoricalAccountComparison['sources'][number];

export function historyFieldValues(row: HistoricalAccountComparison, key: HistoryIdentityKey) {
  const current = key === 'documentId' ? row.documentId : key === 'account' ? row.currentAccount : row.currentName;
  const normalize = (value: string) => key === 'name' ? normalizeBeneficiaryName(value)
    : key === 'documentId' ? value.trim().toUpperCase() : value.trim();
  const history = new Map<string, {value: string; sources: HistorySource[]}>();
  for (const source of row.sources) {
    const value = source[key];
    const normalized = normalize(value);
    const entry = history.get(normalized) || {value, sources: []};
    entry.sources.push(source);
    history.set(normalized, entry);
  }
  return {
    current, history: [...history.values()], hasHistory: row.sources.length > 0,
    different: [...history.keys()].some(value => value !== normalize(current)),
  };
}

/** Use the complete filtered result, never just one page, to keep headers stable. */
export function historyColumnLayout(rows: HistoricalAccountComparison[]) {
  return HISTORY_IDENTITY_FIELDS.map(field => ({
    ...field, split: rows.some(row => historyFieldValues(row, field.key).different),
  }));
}

interface FinancialComparison {
  accountNo: string;
  benefitsAccountNo: string;
  actualAmount: number;
  sheet1Amount: number;
  holdAmount: number;
}
export function financialSharedValues(row: FinancialComparison) {
  return {
    // A missing ACC account is not evidence that it matches AE.
    account: row.accountNo.trim() === row.benefitsAccountNo.trim(),
    amount: row.actualAmount === row.sheet1Amount + row.holdAmount,
  };
}
export function financialColumnLayout(rows: FinancialComparison[]) {
  const splitAccount = rows.some(row => !financialSharedValues(row).account);
  const splitAmount = rows.some(row => !financialSharedValues(row).amount);
  const count = 6 + (splitAccount ? 2 : 1) + (splitAmount ? 2 : 1);
  return {splitAccount, splitAmount, count, varianceIndex: count - 3};
}
