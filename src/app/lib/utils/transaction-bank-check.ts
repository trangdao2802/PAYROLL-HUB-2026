import type { HistoricalSnapshot, TransactionRow } from './transaction-history';

// Source-backed scope and limitations: docs/bank-account-check.md.
// These checks assess payroll data; they do not verify an account with a bank.
export interface BankFinding {
  code: string;
  severity: 'error' | 'review';
  message: string;
}
export interface BankAccountReview {
  bank: string;
  bankAssumed: boolean;
  findings: BankFinding[];
  blocksSync: boolean;
}

const text = (value: unknown) => String(value ?? '').trim();
export const normalizeBeneficiaryName = (value: unknown): string => text(value)
  .normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'D')
  .replace(/\s+/g, ' ').toUpperCase();

function firstValue(row: TransactionRow, keys: string[]): unknown {
  for (const key of keys) if (text(row[key])) return row[key];
  return '';
}
function documentId(row: TransactionRow): string {
  return text(firstValue(row, ['Document ID', 'Doc ID', 'ID Number', 'ID NUMBER', 'Document ID / CCCD'])).toUpperCase();
}
export function transactionBank(row: TransactionRow, defaultBank = ''): {bank: string; bankAssumed: boolean} {
  const supplied = text(firstValue(row, [
    'Beneficiary Bank Swift Code / IFSC Code', 'Beneficiary Bank', 'Bank Name', 'Ngân hàng', 'Tên ngân hàng',
  ]));
  const normalized = normalizeBeneficiaryName(supplied || defaultBank);
  const bank = normalized === 'VCB' || normalized.includes('VIETCOMBANK')
    || /^BFTVVNVX(?:[A-Z0-9]{3})?$/.test(normalized)
    || normalized === 'NGAN HANG TMCP NGOAI THUONG VIET NAM'
    ? 'VCB' : normalized;
  return {bank, bankAssumed: !supplied && Boolean(defaultBank)};
}

interface Occurrence {
  row: TransactionRow;
  period: string;
  versionId: string;
  bank: string;
  account: string;
  name: string;
  id: string;
}

export function reviewBankAccounts(
  current: TransactionRow[],
  history: HistoricalSnapshot[],
  defaultBank = '',
): BankAccountReview[] {
  const accounts = new Map<string, Occurrence[]>();
  const historicalIds = new Map<string, Occurrence[]>();
  function index(row: TransactionRow, period: string, versionId: string) {
    const occurrence: Occurrence = {
      row, period, versionId, bank: transactionBank(row, defaultBank).bank,
      account: text(row['Beneficiary Account No.']), name: normalizeBeneficiaryName(row['Beneficiary Name']), id: documentId(row),
    };
    if (occurrence.account) {
      const key = JSON.stringify([occurrence.bank, occurrence.account]);
      const group = accounts.get(key) || [];
      group.push(occurrence);
      accounts.set(key, group);
    }
    if (versionId && occurrence.id) {
      const group = historicalIds.get(occurrence.id) || [];
      group.push(occurrence);
      historicalIds.set(occurrence.id, group);
    }
  }
  current.forEach(row => index(row, 'Hiện tại', ''));
  history.forEach(version => version.rows.forEach(row => index(row, version.id ? version.period.slice(0, 7) : version.period, version.id)));

  return current.map(row => {
    const findings: BankFinding[] = [];
    const add = (code: string, severity: BankFinding['severity'], message: string) => {
      if (!findings.some(item => item.code === code && item.message === message)) findings.push({code, severity, message});
    };
    const raw = row['Beneficiary Account No.'];
    const account = text(raw);
    const owner = text(row['Beneficiary Name']);
    const bankInfo = transactionBank(row, defaultBank);
    if (!account) add('ACCOUNT_MISSING', 'error', 'Thiếu STK người hưởng.');
    else if (typeof raw !== 'string') {
      add('ACCOUNT_NOT_TEXT', 'review', 'STK đang ở dạng số; cần đối chiếu bản gốc để bảo toàn số 0 đầu và độ chính xác.');
    } else if (/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(account)) {
      add('ACCOUNT_SCIENTIFIC', 'error', 'STK đang ở dạng số mũ Excel; nhập lại đúng chuỗi STK từ ngân hàng.');
    } else if (/\s|\p{Cc}|\p{Cf}/u.test(raw)) {
      add('ACCOUNT_SPACING', 'review', 'STK chứa khoảng trắng hoặc ký tự ẩn; đối chiếu và sửa trực tiếp tại Transaction.');
    } else if (/^0+$/.test(account)) {
      add('ACCOUNT_PLACEHOLDER', 'error', 'STK chỉ gồm số 0; cần kiểm tra dữ liệu gốc.');
    } else if (!/^\d+$/.test(account)) {
      add('ACCOUNT_ALIAS', 'review', bankInfo.bank === 'VCB'
        ? 'STK có chữ/ký hiệu: VCB hỗ trợ nickname, nhưng cần xác nhận nickname và kênh chi lương trước khi đồng bộ.'
        : 'STK có chữ/ký hiệu: cần xác nhận ngân hàng, loại tài khoản/alias và kênh chi lương.');
    }
    if (!owner) add('NAME_MISSING', 'error', 'Thiếu tên người hưởng.');
    else if (!/\p{L}/u.test(owner) || /\p{Cc}|\p{Cf}|\d/u.test(owner)) {
      add('NAME_FORMAT', 'review', 'Tên người hưởng có ký tự bất thường; đối chiếu tên đăng ký tại ngân hàng.');
    }

    const normalizedName = normalizeBeneficiaryName(owner);
    const otherOwners = (accounts.get(JSON.stringify([bankInfo.bank, account])) || [])
      .filter(item => normalizedName && item.name && item.name !== normalizedName);
    if (otherOwners.length) {
      const references = [...new Set(otherOwners.map(item =>
        `${item.period}${item.versionId ? ` (#${item.versionId})` : ''} · ID ${item.id || '—'} · ${text(item.row['Beneficiary Name'])}`))];
      add('ACCOUNT_OWNER_CONFLICT', 'review',
        `STK xuất hiện với tên người hưởng khác${bankInfo.bank ? ` tại ${bankInfo.bank}` : ' (chưa xác định ngân hàng)'}: ${references.join('; ')}. Cần xác minh đồng sở hữu/đổi chủ hoặc nhập sai; không tự gộp người.`);
    }
    for (const previous of historicalIds.get(documentId(row)) || []) {
      if (normalizedName && previous.name && normalizedName !== previous.name) {
        add('NAME_HISTORY_MISMATCH', 'review', `${previous.period} (#${previous.versionId}): Cùng Document ID nhưng tên người hưởng khác (${text(previous.row['Beneficiary Name'])} → ${owner}); cần xác minh trước khi đồng bộ.`);
      }
      if (previous.bank && bankInfo.bank && previous.bank !== bankInfo.bank) {
        add('BANK_CHANGED', 'review', `${previous.period} (#${previous.versionId}): Ngân hàng hưởng khác (${previous.bank} → ${bankInfo.bank}); cần kiểm tra cùng với STK.`);
      } else if (/^\d+$/.test(account) && /^\d+$/.test(previous.account)
        && account !== previous.account && account.replace(/^0+/, '') === previous.account.replace(/^0+/, '')) {
        add('POSSIBLE_LOST_ZERO', 'review', `${previous.period} (#${previous.versionId}): STK có thể mất/thừa số 0 đầu (${previous.account} → ${account}); đối chiếu bản ngân hàng, không tự thêm số.`);
      }
    }
    return {...bankInfo, findings, blocksSync: findings.length > 0};
  });
}
