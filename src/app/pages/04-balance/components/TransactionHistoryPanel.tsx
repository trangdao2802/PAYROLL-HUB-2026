import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { HistorySaveConflictError, loadAllPriorVersions, saveVersion, type TransactionVersion } from '../../../lib/transaction-history-store';
import { compareAccountsAcrossHistory, formatHistoryDate, selectPeriodRows, visibleHistoricalComparisons, type TransactionRow, type HistoricalAccountComparison } from '../../../lib/utils/transaction-history';

interface Props {
  rows: TransactionRow[];
  month: string;
  showReport: boolean;
  onOpenReport: () => void;
}
interface Report {
  context: string;
  versions: TransactionVersion[];
  comparisons: HistoricalAccountComparison[];
}

export function TransactionHistoryPanel({ rows, month, showReport, onOpenReport }: Props) {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [page, setPage] = useState(1);
  const operation = useRef(false);
  const authIdentity = useRef('');
  const retry = useRef<{context: string; requestId: string} | null>(null);
  // Fingerprint all source rows, not just visible/filtered Transaction rows.
  const context = useMemo(() => JSON.stringify([month, rows, userId]), [month, rows, userId]);
  const currentContext = useRef(context);
  useEffect(() => { currentContext.current = context; }, [context]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user.id || '';
      if (live && nextId !== authIdentity.current) {
        authIdentity.current = nextId;
        setUserId(nextId);
        setReport(null);
        retry.current = null;
      }
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const visibleReport = report?.context === context ? report : null;
  const comparisons = visibleReport
    ? visibleHistoricalComparisons(visibleReport.comparisons)
    : [];
  const exceptions = comparisons.filter(row => row.issues.length > 0);
  const pageCount = Math.max(1, Math.ceil(exceptions.length / 25));
  const activePage = Math.min(page, pageCount);
  const buttonClass = 'rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap hover:bg-primary/10 disabled:opacity-50 active:scale-[0.98]';

  async function run(action: 'save' | 'check') {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setMessage('');
    const started = context;
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa cấu hình Supabase URL và publishable/anon key.');
      const selected = selectPeriodRows(rows, month);
      if (action === 'save') {
        if (retry.current?.context !== started) retry.current = {context: started, requestId: crypto.randomUUID()};
        const id = await saveVersion(supabase, month, selected, retry.current.requestId);
        retry.current = null;
        if (currentContext.current === started) {
          setReport(null);
          setMessage(`Đã lưu tháng ${month}: ${selected.length} dòng (#${id}). Dữ liệu cũ của tháng này đã được thay thế.`);
        }
      } else {
        setReport(null);
        const versions = await loadAllPriorVersions(supabase, month);
        if (currentContext.current !== started) return;
        setReport({context: started, versions, comparisons: compareAccountsAcrossHistory(selected, versions)});
        setPage(1);
        onOpenReport();
      }
    } catch (error) {
      if (error instanceof HistorySaveConflictError) retry.current = null;
      if (currentContext.current === started) setMessage(error instanceof Error ? error.message : 'Không thể truy cập kho Transaction.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function login() {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa cấu hình Supabase.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setLoginOpen(false);
      setMessage('Đã đăng nhập kho.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại.');
    } finally {
      setPassword('');
      operation.current = false;
      setBusy(false);
    }
  }

  async function exportReport() {
    try {
      if (!visibleReport) return;
      const XLSX = await import('xlsx');
      const data = exceptions.map(row => ({
        'Tháng này': month,
        'Nguồn đối chiếu': row.sources.map(source => `${source.period} · #${source.versionId} · ${formatHistoryDate(source.createdAt)} · Document ID ${source.documentId || '—'} · STK ${source.account} · ${source.name}`).join('\n'),
        'Document ID lịch sử': row.previousDocumentId,
        'Document ID hiện tại': row.documentId,
        'STK lịch sử': row.previousAccount,
        'STK hiện tại': row.currentAccount, 'Tên lịch sử': row.previousName,
        'Tên hiện tại': row.currentName, 'Cảnh báo': row.issues.join('; '),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), 'Check STK-ID');
      XLSX.writeFile(workbook, `Check-STK-ID-${month.replace(/[^\d-]/g, '-')}.xlsx`);
    } catch { setMessage('Không thể xuất báo cáo Check STK & ID.'); }
  }

  return <section aria-label="Kho Transaction theo tháng" className="shrink-0 border-b border-primary/15 bg-card p-2 text-foreground" style={{fontFamily: 'var(--font-table, var(--font-main))'}}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold">Kho Transaction · {month}</span>
      <button type="button" className={buttonClass} disabled={busy || !userId} title="Thay toàn bộ dữ liệu đã lưu của tháng đang chọn bằng Transaction hiện tại" onClick={() => void run('save')}>Lưu tháng</button>
      <button type="button" className={buttonClass} disabled={busy || !userId} onClick={() => void run('check')}>Check STK & ID</button>
      {!userId ? <button type="button" className={buttonClass} disabled={busy} onClick={() => setLoginOpen(value => !value)}>Đăng nhập kho</button>
        : <button type="button" className={buttonClass} disabled={busy} onClick={async () => {
          const { error } = await supabase.auth.signOut();
          setMessage(error ? error.message : 'Đã đăng xuất kho.');
        }}>Đăng xuất kho</button>}
      {busy && <span role="status" className="text-xs">Đang xử lý…</span>}
    </div>
    {loginOpen && !userId && <form className="flex flex-wrap items-end gap-2 mt-2" onSubmit={event => {event.preventDefault(); void login();}}>
      <label className="text-xs">Email<input type="email" required autoComplete="username" className="block rounded border p-1 text-foreground bg-background" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="text-xs">Mật khẩu<input type="password" required autoComplete="current-password" className="block rounded border p-1 text-foreground bg-background" value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className={buttonClass} disabled={busy}>Đăng nhập</button>
      <span className="text-xs">Cần tài khoản được quản trị viên cấp quyền kho payroll.</span>
    </form>}
    {message && <p role="status" className="text-xs mt-2">{message}</p>}
    {showReport && report && !visibleReport && <p className="text-xs mt-2">Dữ liệu đã đổi. Bấm Check STK & ID để kiểm tra lại.</p>}
    {showReport && visibleReport && <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <strong>Check STK & Document ID · Tất cả tháng đã lưu → {month}</strong>
        <details><summary className="cursor-pointer">{visibleReport.versions.length} tháng nguồn{visibleReport.versions.length ? ` · ${visibleReport.versions[0].period.slice(0, 7)} – ${visibleReport.versions[visibleReport.versions.length - 1].period.slice(0, 7)}` : ''}</summary>
          <ul>{visibleReport.versions.map(version => <li key={version.id}>{version.period.slice(0, 7)} · Nguồn #{version.id} · {formatHistoryDate(version.created_at)}</li>)}</ul>
        </details>
        <span>{comparisons.length} dòng · {exceptions.length} cần kiểm tra · {comparisons.length - exceptions.length} khớp</span>
        <button type="button" className={buttonClass} disabled={!exceptions.length} onClick={() => void exportReport()}>Xuất Check STK & ID</button>
      </div>
      {exceptions.length > 0 && <>
        <div className="max-h-64 overflow-auto mt-2 rounded border border-primary/15">
          <table className="w-full text-xs text-left"><thead className="sticky top-0 bg-card"><tr>
            {['Document ID lịch sử', 'Document ID hiện tại', 'STK lịch sử', 'STK hiện tại', 'Tên lịch sử', 'Tên hiện tại', 'Nguồn đối chiếu', 'Cảnh báo'].map(header => <th key={header} className="p-2 border-b">{header}</th>)}
          </tr></thead><tbody>{exceptions.slice((activePage - 1) * 25, activePage * 25).map((row, index) => <tr key={index} className="bg-amber-50/40 dark:bg-amber-950/20">
            {[row.previousDocumentId, row.documentId, row.previousAccount, row.currentAccount, row.previousName, row.currentName, row.sources.map(source => `${source.period} · #${source.versionId}: ID ${source.documentId || '—'} · STK ${source.account || '—'} · ${source.name || '—'}`).join('\n'), row.issues.join('; ')].map((value, column) => <td key={column} className="p-2 border-b tabular-nums whitespace-pre-line">{value || '—'}</td>)}
          </tr>)}</tbody></table>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs"><button type="button" className={buttonClass} disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Trước</button><span>{activePage}/{pageCount}</span><button type="button" className={buttonClass} disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}>Sau</button></div>
      </>}
    </div>}
  </section>;
}
