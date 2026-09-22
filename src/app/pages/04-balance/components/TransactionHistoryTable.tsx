import { type ReactNode } from 'react';
import type { HistoricalAccountComparison } from '../../../lib/utils/transaction-history';
import { formatResolutionPeriods } from '../../../lib/utils/transaction-history-resolution';
import { HISTORY_IDENTITY_FIELDS, historyFieldValues } from '../../../lib/utils/reconcile-column-layout';
import { summarizeHistoryWarnings } from '../../../lib/utils/transaction-history-summary';

interface Props {
  rows: HistoricalAccountComparison[];
  month: string;
  page: number;
  renderActions: (row: HistoricalAccountComparison) => ReactNode;
}
const cellClass = 'p-2 border-b border-r border-primary/15 align-top tabular-nums [overflow-wrap:anywhere]';

export function TransactionHistoryTable({rows, month, page, renderActions}: Props) {
  return <table aria-label="Check STK và ID" className="w-full min-w-[760px] table-fixed text-xs text-left">
    <caption className="sr-only">Thông tin chung hiển thị một lần. Các giá trị khác nhau được so sánh giữa lịch sử và tháng hiện tại.</caption>
    <colgroup><col className="w-[26%]" /><col className="w-[21%]" /><col className="w-[21%]" /><col className="w-[18%]" /><col className="w-[14%]" /></colgroup>
    <thead className="sticky top-0 z-10 bg-[var(--table-column-header-bg,var(--card))]">
      <tr>{['Thông tin chung', 'Lịch sử', `Hiện tại · ${formatResolutionPeriods([month])}`, 'Cần kiểm tra', 'Xử lý'].map(label =>
        <th key={label} scope="col" className="p-2 border-b border-r border-primary/20 font-semibold">{label}</th>)}</tr>
    </thead>
    <tbody>{rows.slice((page - 1) * 25, page * 25).map(row => {
      const fields = HISTORY_IDENTITY_FIELDS.map(field => ({...field, values: historyFieldValues(row, field.key)}));
      const common = fields.filter(field => !field.values.different);
      const different = fields.filter(field => field.values.different);
      return <tr key={row.currentRowIndex}>
        <td className={cellClass} data-comparison="shared">
          <dl className="space-y-1.5">{common.map(field => <div key={field.key}>
            <dt className="text-muted-foreground">{field.label === 'Document ID' ? 'ID' : field.label === 'Tên người hưởng' ? 'Tên' : field.label}</dt>
            <dd className="font-medium">{field.values.current || '—'}</dd>
          </div>)}</dl>
          {!common.length && <span className="text-muted-foreground">Không có thông tin chung</span>}
          {!row.sources.length && <p className="mt-1 text-muted-foreground">Chưa tìm thấy lịch sử</p>}
        </td>
        <td className={cellClass} data-comparison="history">
          <div className="space-y-2">{different.map(field => <div key={field.key}>
            <p className="text-muted-foreground">{field.label === 'Document ID' ? 'ID' : field.label === 'Tên người hưởng' ? 'Tên' : field.label}</p>
            {field.values.history.map((group, index) => <div key={index} className="mt-1">
              <p className="font-semibold">{group.value || '(trống)'}</p>
              <p className="text-muted-foreground">{formatResolutionPeriods(group.sources.map(source => source.period))}</p>
            </div>)}
          </div>)}</div>
          {!different.length && <span className="text-muted-foreground">—</span>}
        </td>
        <td className={cellClass} data-comparison="current">
          <dl className="space-y-2">{different.map(field => <div key={field.key}>
            <dt className="text-muted-foreground">{field.label === 'Document ID' ? 'ID' : field.label === 'Tên người hưởng' ? 'Tên' : field.label}</dt>
            <dd className="font-semibold">{field.values.current || '(trống)'}</dd>
          </div>)}</dl>
          {!different.length && <span className="text-muted-foreground">—</span>}
        </td>
        <td className={cellClass}>
          <p className="font-semibold">{summarizeHistoryWarnings(row)}</p>
          <details className="mt-1 text-muted-foreground"><summary className="cursor-pointer">Chi tiết</summary>
            <p className="mt-1">{row.bankCheck?.bank || 'Chưa rõ ngân hàng'}{row.bankCheck?.bankAssumed ? ' · mặc định' : ''}</p>
            <ul className="mt-1 space-y-1">{[...new Set(row.issues)].map(issue => <li key={issue}>{issue}</li>)}</ul>
            {row.currentDocumentIdSyncNote && <p className="mt-1">ID đã đồng bộ theo {row.currentDocumentIdSyncNote}</p>}
            {row.sources.filter(source => source.documentIdSyncNote).map(source =>
              <p key={source.versionId} className="mt-1">{formatResolutionPeriods([source.period])}: ID đã đồng bộ theo {source.documentIdSyncNote}</p>)}
          </details>
        </td>
        <td className={cellClass}>{renderActions(row)}</td>
      </tr>;
    })}</tbody>
  </table>;
}
