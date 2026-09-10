import type { HistoricalAccountComparison } from './transaction-history';

const BANK_LABELS: Record<string, string> = {
  ACCOUNT_MISSING: 'Thiếu STK', ACCOUNT_NOT_TEXT: 'STK dạng số',
  ACCOUNT_SCIENTIFIC: 'STK dạng số mũ', ACCOUNT_SPACING: 'STK có ký tự ẩn/khoảng trắng',
  ACCOUNT_PLACEHOLDER: 'STK toàn số 0', ACCOUNT_ALIAS: 'Xác nhận nickname STK',
  NAME_MISSING: 'Thiếu tên', NAME_FORMAT: 'Tên có ký tự lạ',
  ACCOUNT_OWNER_CONFLICT: 'STK có tên khác', NAME_HISTORY_MISMATCH: 'Tên khác',
  BANK_CHANGED: 'Ngân hàng khác', POSSIBLE_LOST_ZERO: 'Kiểm tra số 0 đầu STK',
};

/** Keep full messages in details/export, while the table shows each issue once. */
export function summarizeHistoryWarnings(comparison: HistoricalAccountComparison): string {
  const labels = new Set<string>();
  const findings = comparison.bankCheck?.findings || [];
  const bankMessages = new Set(findings.map(finding => finding.message));
  for (const issue of comparison.issues) {
    if (bankMessages.has(issue)) continue;
    const simple = issue.replace(/^\d{4}-\d{2}\s*\(#[^)]+\):\s*/, '').replace(/\s*\([^)]*\)/g, '').trim();
    labels.add(simple.replace(/^Thiếu STK.*$/, 'Thiếu STK').replace(/^Thiếu tên.*$/, 'Thiếu tên')
      .replace(/^Thiếu Document ID.*$/, 'Thiếu ID')
      .replace(/^Chỉ trùng STK.*$/, 'Chưa xác định cùng người'));
  }
  for (const finding of findings) labels.add(BANK_LABELS[finding.code] || 'Cần xác minh');
  if (labels.has('Tên khác')) labels.delete('STK có tên khác');
  return [...labels].join(' · ') || '—';
}
