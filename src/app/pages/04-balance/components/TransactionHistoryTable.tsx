import { Fragment, useId, useMemo, type ReactNode } from 'react';
import type { HistoricalAccountComparison, HistoricalSnapshot } from '../../../lib/utils/transaction-history';
import { formatHistoryDate } from '../../../lib/utils/transaction-history';
import { formatResolutionPeriods } from '../../../lib/utils/transaction-history-resolution';
import { historyColumnLayout, historyFieldValues } from '../../../lib/utils/reconcile-column-layout';
import { summarizeHistoryWarnings } from '../../../lib/utils/transaction-history-summary';
import type { TransactionSourceLocation } from './TransactionHistorySourceTable';

interface Props {
  rows: HistoricalAccountComparison[];
  currentVersion: HistoricalSnapshot;
  month: string;
  page: number;
  sourceLink: (value: string, location: TransactionSourceLocation, title?: string) => ReactNode;
  renderActions: (row: HistoricalAccountComparison) => ReactNode;
}
const cellClass = 'p-2 border-b border-r border-primary/15 align-top tabular-nums';
const headerClass = 'p-2 border-b border-r border-primary/20 text-center font-semibold';

export function TransactionHistoryTable({rows, currentVersion, month, page, sourceLink, renderActions}: Props) {
  const prefix = useId();
  const columns = useMemo(() => historyColumnLayout(rows), [rows]);
  const hasChildren = columns.some(column => column.split);
  const headerRows = hasChildren ? 2 : 1;
  return <table aria-label="Check STK và ID" className="w-full text-xs text-left">
    <caption className="sr-only">Giá trị chung hiển thị một lần; giá trị khác được tách theo tháng nguồn và tháng hiện tại.</caption>
    {columns.map(column => <colgroup key={column.key} span={column.split ? 2 : 1} />)}
    <colgroup span={2} />
    <thead className="sticky top-0 z-10 bg-[var(--table-column-header-bg,var(--card))]">
      <tr>{columns.map(column => <th key={column.key} id={`${prefix}-${column.key}`} scope={column.split ? 'colgroup' : 'col'}
        colSpan={column.split ? 2 : 1} rowSpan={column.split ? 1 : headerRows} className={headerClass}>{column.label}</th>)}
        <th id={`${prefix}-warning`} scope="col" rowSpan={headerRows} className={headerClass}>Cần kiểm tra</th>
        <th id={`${prefix}-action`} scope="col" rowSpan={headerRows} className={headerClass}>Giải quyết</th>
      </tr>
      {hasChildren && <tr>{columns.filter(column => column.split).map(column => <Fragment key={column.key}>
        <th id={`${prefix}-${column.key}-history`} headers={`${prefix}-${column.key}`} scope="col" className={headerClass}>Tháng nguồn</th>
        <th id={`${prefix}-${column.key}-current`} headers={`${prefix}-${column.key}`} scope="col" className={headerClass}>Hiện tại · {formatResolutionPeriods([month])}</th>
      </Fragment>)}</tr>}
    </thead>
    <tbody>{rows.slice((page - 1) * 25, page * 25).map(row => <tr key={row.currentRowIndex}>
      {columns.map(column => {
        const values = historyFieldValues(row, column.key);
        const currentLocation = {versionId: currentVersion.id, rowIndexes: [row.currentRowIndex], field: column.column};
        const marked = (value: string, note: string) => value ? `${value}${note ? '!' : ''}` : '—';
        const currentNote = column.key === 'documentId' ? row.currentDocumentIdSyncNote : '';
        const sharedNote = column.key === 'documentId' ? [currentNote, ...row.sources.map(source => source.documentIdSyncNote)].filter(Boolean).join(' · ') : '';
        const header = `${prefix}-${column.key}`;
        if (!column.split || !values.different) return <td key={column.key} colSpan={column.split ? 2 : 1}
          headers={column.split ? `${header} ${header}-history ${header}-current` : header} className={cellClass} data-comparison="shared">
          {sourceLink(marked(values.current, sharedNote), currentLocation, sharedNote ? `! Đồng bộ theo ${sharedNote} · Mở nguồn hiện tại` : undefined)}
          {!values.hasHistory && <span className="sr-only"> · Chỉ có dữ liệu hiện tại</span>}
        </td>;
        return <Fragment key={column.key}>
          <td headers={`${header} ${header}-history`} className={`${cellClass} bg-primary/5`} data-comparison="different">
            <div className="space-y-2">{values.history.map((group, index) => {
              const first = group.sources[0];
              const note = column.key === 'documentId' ? group.sources.map(source => source.documentIdSyncNote).filter(Boolean).join(' · ') : '';
              return <div key={index}>
                <span className="font-semibold">{sourceLink(marked(group.value, note), {versionId: first.versionId, rowIndexes: first.rowIndexes, field: column.column}, `Transaction ${first.period} · ${column.label}${note ? ` · ! Đồng bộ theo ${note}` : ''}`)}</span>
                {group.sources.length === 1 ? <div className="text-[10px] text-muted-foreground">{formatResolutionPeriods([first.period])}</div>
                  : <details className="text-[10px] text-muted-foreground"><summary className="cursor-pointer">{formatResolutionPeriods(group.sources.map(source => source.period))}</summary>
                    <div className="mt-1 flex flex-wrap gap-2">{group.sources.map(source => <span key={source.versionId}>{sourceLink(formatResolutionPeriods([source.period]), {versionId: source.versionId, rowIndexes: source.rowIndexes, field: column.column})}</span>)}</div>
                  </details>}
              </div>;
            })}</div>
          </td>
          <td headers={`${header} ${header}-current`} className={`${cellClass} bg-primary/10 font-semibold`} data-comparison="different">
            {sourceLink(marked(values.current, currentNote), currentLocation, currentNote ? `! Đồng bộ theo ${currentNote} · Mở nguồn hiện tại` : undefined)}
          </td>
        </Fragment>;
      })}
      <td headers={`${prefix}-warning`} className={`${cellClass} min-w-36 max-w-60`}>
        <span className="font-semibold">{summarizeHistoryWarnings(row)}</span>
        <details className="mt-1 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Chi tiết</summary>
          <p className="mt-1">{row.bankCheck?.bank || 'Chưa rõ NH'}{row.bankCheck?.bankAssumed ? ' · mặc định' : ''}</p>
          <p className="mt-1 whitespace-pre-line">{row.issues.join('\n')}</p>
          <div className="mt-2 space-y-1">
            {[{period: currentVersion.period, versionId: currentVersion.id, createdAt: currentVersion.created_at, rowIndexes: [row.currentRowIndex], documentIdSyncNote: row.currentDocumentIdSyncNote}, ...row.sources].map(source => <div key={source.versionId}>
              {sourceLink(`${formatResolutionPeriods([source.period])} · #${source.versionId}`, {versionId: source.versionId, rowIndexes: source.rowIndexes, field: 'Document ID'})}
              <span> · {formatHistoryDate(source.createdAt)}</span>
              {source.documentIdSyncNote && <p>! Đồng bộ ID theo {source.documentIdSyncNote}</p>}
            </div>)}
          </div>
        </details>
      </td>
      <td headers={`${prefix}-action`} className={cellClass}>{renderActions(row)}</td>
    </tr>)}</tbody>
  </table>;
}
