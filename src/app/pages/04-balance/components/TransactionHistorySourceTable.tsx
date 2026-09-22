import { useEffect, useMemo, useRef, useState } from 'react';
import { canonicalTransactionHeaders, formatHistoryDate, withCanonicalTransactionDocumentId, type HistoricalSnapshot } from '../../../lib/utils/transaction-history';
import { formatResolutionPeriods } from '../../../lib/utils/transaction-history-resolution';

export interface TransactionSourceLocation {
  versionId: string;
  rowIndexes: number[];
  field: string;
}

const buttonClass = 'rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold whitespace-nowrap hover:bg-primary/10 disabled:opacity-50 active:scale-[0.98]';

export function TransactionHistorySourceTable({ version, location, onBack }: {
  version: HistoricalSnapshot;
  location: TransactionSourceLocation;
  onBack: () => void;
}) {
  const [target, setTarget] = useState(location.rowIndexes[0] ?? 0);
  const [page, setPage] = useState(Math.floor(target / 25) + 1);
  const cell = useRef<HTMLTableCellElement>(null);
  const rows = useMemo(() => version.rows.map(withCanonicalTransactionDocumentId), [version.rows]);
  const headers = useMemo(() => canonicalTransactionHeaders([
    'Document ID', 'Beneficiary Account No.', 'Beneficiary Name',
    ...new Set(rows.flatMap(row => Object.keys(row).filter(key => !key.startsWith('_') && key !== 'id'))),
  ]), [rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  useEffect(() => {
    cell.current?.focus({preventScroll: true});
    cell.current?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  }, [page, target]);

  return <div className="mt-2" aria-label="Bảng Transaction nguồn">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" className={buttonClass} onClick={onBack}>← Quay lại Reconcile</button>
      <strong>Transaction · {formatResolutionPeriods([version.period])}</strong>
      <span>Supabase #{version.id} · {formatHistoryDate(version.created_at)} · {rows.length} dòng</span>
      <label className="flex items-center gap-1">Dòng tham chiếu
        <select aria-label="Dòng nguồn cần kiểm tra" value={target} className="rounded-lg border border-primary/20 bg-background px-2 py-1" onChange={event => {
          const index = Number(event.target.value);
          setTarget(index);
          setPage(Math.floor(index / 25) + 1);
        }}>
          {location.rowIndexes.map(index => <option key={index} value={index}>{index + 1}</option>)}
        </select>
      </label>
    </div>
    <p className="my-2 text-[10px] text-muted-foreground">Bảng gốc đã lưu trên Supabase · Ô {location.field} cần kiểm tra được đánh dấu. Đây là chế độ xem nguồn; dữ liệu Transaction trên máy được giữ nguyên.</p>
    <div className="max-h-[60vh] overflow-auto rounded-xl border border-primary/20">
      <table className="w-full text-left text-xs tabular-nums" aria-label={`Transaction nguồn ${version.period.slice(0, 7)}`}>
        <thead className="sticky top-0 z-10 bg-card"><tr><th className="border-b p-2">Dòng</th>{headers.map(header => <th className="border-b p-2 whitespace-nowrap" key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * 25, page * 25).map((row, offset) => {
          const index = (page - 1) * 25 + offset;
          return <tr key={index} className={location.rowIndexes.includes(index) ? 'bg-primary/10' : ''}>
            <th scope="row" className="border-b p-2">{index + 1}</th>
            {headers.map(header => {
              const isTarget = index === target && header === location.field;
              return <td key={header} ref={isTarget ? cell : undefined} tabIndex={isTarget ? 0 : undefined}
                aria-label={isTarget ? `Ô nguồn dòng ${index + 1}: ${header}` : undefined}
                className={`border-b p-2 whitespace-nowrap ${isTarget ? 'bg-primary/20 font-bold outline outline-2 -outline-offset-2 outline-primary' : ''}`}>
                {typeof row[header] === 'object' && row[header] !== null ? JSON.stringify(row[header]) : String(row[header] ?? '') || '—'}
              </td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="mt-2 flex items-center gap-2 text-xs">
      <button type="button" className={buttonClass} disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button>
      <span>{page}/{pageCount}</span>
      <button type="button" className={buttonClass} disabled={page === pageCount} onClick={() => setPage(value => value + 1)}>Sau</button>
    </div>
  </div>;
}
