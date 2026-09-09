import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { assertTransactionCheckCurrent, HistorySaveConflictError, loadLatestVersion, loadTransactionCheckSource, replaceVersionIfCurrent, saveVersion, type TransactionCheckSource } from '../../../lib/transaction-history-store';
import { compareAccountsAcrossHistory, formatHistoryDate, selectPeriodRows, visibleHistoricalComparisons, type TransactionRow, type HistoricalAccountComparison } from '../../../lib/utils/transaction-history';
import { applyTransactionHistoryResolution, bankAccountResolutionOptions, buildDocumentIdResolutionGroup, documentIdResolutionTargets, formatResolutionPeriods, type BankAccountResolutionOption } from '../../../lib/utils/transaction-history-resolution';
import { replaceTransactionPeriod, sameTransactionSnapshot } from '../../../lib/utils/transaction-snapshot';
import { buildNameResolutionGroup, nameResolutionTargets } from '../../../lib/utils/transaction-name-resolution';
import { summarizeHistoryWarnings } from '../../../lib/utils/transaction-history-summary';
import { syncTransactionEmployeesToSupabase } from '../../../lib/utils/transaction-employee-sync';
import { TransactionHistorySourceTable, type TransactionSourceLocation } from './TransactionHistorySourceTable';

interface Props {
  rows: TransactionRow[];
  month: string;
  showReport: boolean;
  onOpenReport: () => void;
  onReplaceRows: (rows: TransactionRow[]) => void;
  hasPendingEdits: boolean;
  onReportStateChange?: (hasExceptions: boolean, viewingSource: boolean) => void;
}
interface Report extends TransactionCheckSource {
  context: string;
  comparisons: HistoricalAccountComparison[];
}
interface AccountDecision {
  context: string;
  comparison: HistoricalAccountComparison;
  source: BankAccountResolutionOption;
}

function employeeSyncMessage(summary: Awaited<ReturnType<typeof syncTransactionEmployeesToSupabase>>): string {
  const skipped = summary.skipped
    ? ` Bỏ qua ID mâu thuẫn: ${summary.skippedDocumentIds.join(', ')}.`
    : '';
  return `Đã cập nhật nhan_vien: ${summary.synced} dòng (${summary.inserted} mới, ${summary.updated} cập nhật).${skipped}`;
}

const markedDocumentId = (value: string, syncNote: string) => (
  value ? `${value}${syncNote ? '!' : ''}` : '—'
);

export function TransactionHistoryPanel({ rows, month, showReport, onOpenReport, onReplaceRows, hasPendingEdits, onReportStateChange }: Props) {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [documentIdDecision, setDocumentIdDecision] = useState<{context: string; rowIndex: number; optionKey: string} | null>(null);
  const [accountDecision, setAccountDecision] = useState<AccountDecision | null>(null);
  const [nameDecision, setNameDecision] = useState<{context: string; rowIndex: number; optionKey: string} | null>(null);
  const [sourceLocation, setSourceLocation] = useState<(TransactionSourceLocation & {context: string}) | null>(null);
  const reportScroll = useRef<HTMLDivElement>(null);
  const savedReportScroll = useRef({top: 0, left: 0});
  const [page, setPage] = useState(1);
  const [defaultBank, setDefaultBank] = useState('VCB');
  const operation = useRef(false);
  const authIdentity = useRef('');
  const retry = useRef<{context: string; requestId: string} | null>(null);
  // Fingerprint all source rows, not just visible/filtered Transaction rows.
  const context = useMemo(() => JSON.stringify([month, rows, userId, hasPendingEdits, defaultBank]), [month, rows, userId, hasPendingEdits, defaultBank]);
  const currentContext = useRef(context);
  useEffect(() => { currentContext.current = context; }, [context]);
  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener('open-transaction-settings', openSettings);
    return () => window.removeEventListener('open-transaction-settings', openSettings);
  }, []);
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
  const localMatchesCloud = useMemo(() => Boolean(visibleReport
    && sameTransactionSnapshot(rows, visibleReport.currentVersion.rows, month)), [visibleReport, rows, month]);
  const visibleAccountDecision = accountDecision?.context === context && visibleReport
    ? accountDecision
    : null;
  const visibleDocumentIdGroup = useMemo(() => {
    if (!documentIdDecision || documentIdDecision.context !== context || !visibleReport) return null;
    const comparison = visibleReport.comparisons.find(item => item.currentRowIndex === documentIdDecision.rowIndex);
    return comparison ? buildDocumentIdResolutionGroup(comparison, month) : null;
  }, [documentIdDecision, context, visibleReport, month]);
  const documentIdTargets = visibleDocumentIdGroup && documentIdDecision
    ? documentIdResolutionTargets(visibleDocumentIdGroup, documentIdDecision.optionKey)
    : [];
  const comparisons = useMemo(() => visibleReport
    ? visibleHistoricalComparisons(visibleReport.comparisons)
    : [], [visibleReport]);
  const exceptions = useMemo(
    () => comparisons.filter(row => row.issues.length > 0),
    [comparisons],
  );
  const visibleNameGroup = useMemo(() => nameDecision?.context === context && visibleReport
    ? buildNameResolutionGroup(visibleReport.currentVersion, visibleReport.versions, nameDecision.rowIndex, defaultBank)
    : null, [nameDecision, context, visibleReport, defaultBank]);
  const nameTargets = visibleNameGroup && nameDecision ? nameResolutionTargets(visibleNameGroup, nameDecision.optionKey) : [];
  const sourceVersion = visibleReport && sourceLocation?.context === context
    ? [visibleReport.currentVersion, ...visibleReport.versions].find(version => version.id === sourceLocation.versionId)
    : undefined;
  const viewingSource = Boolean(sourceVersion);
  const hasExceptions = exceptions.length > 0;
  useEffect(() => {
    onReportStateChange?.(showReport && hasExceptions, showReport && viewingSource);
  }, [showReport, hasExceptions, viewingSource, onReportStateChange]);
  useEffect(() => {
    if (!viewingSource && reportScroll.current) {
      reportScroll.current.scrollTop = savedReportScroll.current.top;
      reportScroll.current.scrollLeft = savedReportScroll.current.left;
    }
  }, [viewingSource]);
  const pageCount = Math.max(1, Math.ceil(exceptions.length / 25));
  const activePage = Math.min(page, pageCount);
  const buttonClass = 'rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap hover:bg-primary/10 disabled:opacity-50 active:scale-[0.98]';
  const resolutionButtonClass = 'rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-foreground hover:bg-primary/20 disabled:opacity-50 active:scale-[0.98]';

  function requireUnchangedContext(started: string) {
    if (currentContext.current !== started) throw new HistorySaveConflictError('Transaction hoặc tháng đang chọn đã đổi. Hãy kiểm tra lại.');
  }

  async function refreshReport(started: string) {
    const source = await loadTransactionCheckSource(supabase, month);
    if (currentContext.current !== started) return false;
    setReport({
      context: started,
      ...source,
      comparisons: compareAccountsAcrossHistory(selectPeriodRows(source.currentVersion.rows, month), source.versions, defaultBank),
    });
    setPage(1);
    return true;
  }

  async function run(action: 'save' | 'check' | 'load') {
    if (operation.current || hasPendingEdits) return;
    operation.current = true;
    setBusy(true);
    setMessage('');
    setReport(null);
    setDocumentIdDecision(null);
    setAccountDecision(null);
    setNameDecision(null);
    setSourceLocation(null);
    const started = context;
    try {
      if (!isSupabaseConfigured()) throw new Error('Chưa cấu hình Supabase URL và publishable/anon key.');
      if (action === 'save') {
        const selected = selectPeriodRows(rows, month);
        if (retry.current?.context !== started) retry.current = {context: started, requestId: crypto.randomUUID()};
        const id = await saveVersion(supabase, month, selected, retry.current.requestId);
        retry.current = null;
        const latest = await loadLatestVersion(supabase, month);
        if (!latest || latest.id !== id) throw new HistorySaveConflictError('Tháng vừa có phiên bản mới hơn trên Supabase. Bấm Check STK & ID để lấy dữ liệu mới nhất.');
        if (!sameTransactionSnapshot(selected, latest.rows, month)) throw new HistorySaveConflictError('Dữ liệu đọc lại từ Supabase chưa khớp Transaction vừa lưu. Bấm Lưu tháng lại trước khi Check STK & ID.');
        const employeeSync = await syncTransactionEmployeesToSupabase(supabase, latest.rows);
        if (currentContext.current === started) {
          setReport(null);
          setMessage(`Đã lưu tháng ${month} lên Supabase: ${selected.length} dòng (#${id}). ${employeeSyncMessage(employeeSync)} Check STK & ID sẽ tải lại phiên bản mới nhất.`);
        }
      } else if (action === 'load') {
        const latest = await loadLatestVersion(supabase, month);
        if (!latest) throw new Error('Tháng này chưa có dữ liệu trên Supabase.');
        requireUnchangedContext(started);
        onReplaceRows(replaceTransactionPeriod(rows, month, latest.rows));
        setMessage(`Đã tải tháng ${month} từ Supabase (#${latest.id}). Bấm Check STK & ID để đối chiếu.`);
      } else if (await refreshReport(started)) {
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

  async function resolveDocumentId() {
    if (!visibleReport || !visibleDocumentIdGroup || !documentIdDecision || operation.current || hasPendingEdits || !localMatchesCloud) return;
    const option = visibleDocumentIdGroup.options.find(item => item.key === documentIdDecision.optionKey);
    const targets = documentIdResolutionTargets(visibleDocumentIdGroup, documentIdDecision.optionKey);
    if (!option || !targets.length) return;
    operation.current = true;
    setBusy(true);
    setMessage('');
    const started = context;
    const resolvedAt = new Date().toISOString();
    let nextLocalRows = rows;
    const completed: string[] = [];
    try {
      await assertTransactionCheckCurrent(supabase, visibleReport);
      requireUnchangedContext(started);
      const ordered = targets.filter(target => target.location === 'history')
        .concat(targets.filter(target => target.location === 'current'));
      for (const target of ordered) {
        const version = target.location === 'current'
          ? visibleReport.currentVersion
          : visibleReport.versions.find(item => item.id === target.versionId);
        if (!version) throw new Error(`Không tìm thấy nguồn tháng ${target.period}. Hãy kiểm tra lại.`);
        const nextRows = applyTransactionHistoryResolution(version.rows, {
          field: 'Document ID',
          value: option.documentId,
          rowIndexes: target.rowIndexes,
          basedOnPeriods: [option.period],
          resolvedAt,
        });
        requireUnchangedContext(started);
        const savedRows = target.location === 'current' ? selectPeriodRows(nextRows, month) : nextRows;
        const id = await replaceVersionIfCurrent(supabase, version, savedRows, crypto.randomUUID());
        const saved = await loadLatestVersion(supabase, target.period);
        if (!saved || saved.id !== id || !sameTransactionSnapshot(saved.rows, savedRows, target.period)) {
          throw new HistorySaveConflictError(`Bản lưu Document ID tháng ${target.period} đã thay đổi hoặc chưa đọc lại được.`);
        }
        completed.push(target.period);
        if (target.location === 'current') nextLocalRows = replaceTransactionPeriod(rows, month, saved.rows);
      }
      requireUnchangedContext(started);
      const fresh = await loadTransactionCheckSource(supabase, month);
      requireUnchangedContext(started);
      const employeeSync = await syncTransactionEmployeesToSupabase(supabase, fresh.currentVersion.rows);
      requireUnchangedContext(started);
      if (nextLocalRows !== rows) {
        onReplaceRows(nextLocalRows);
        setReport(null);
      } else {
        setReport({
          ...fresh,
          context: started,
          comparisons: compareAccountsAcrossHistory(selectPeriodRows(fresh.currentVersion.rows, month), fresh.versions, defaultBank),
        });
      }
      setDocumentIdDecision(null);
      if (currentContext.current === started) {
        setMessage(`Đã đồng bộ Document ID thành ${option.documentId} theo tháng ${formatResolutionPeriods([option.period])}. Đã lưu tháng ${formatResolutionPeriods(completed)} lên Supabase. ${employeeSyncMessage(employeeSync)}`);
      }
    } catch (error) {
      if (currentContext.current === started) {
        if (nextLocalRows !== rows) onReplaceRows(nextLocalRows);
        setReport(null);
        setDocumentIdDecision(null);
        setMessage(`${completed.length ? `Đã lưu tháng ${formatResolutionPeriods(completed)}. ` : ''}${error instanceof Error ? error.message : 'Không thể đồng bộ Document ID.'} Bấm Check STK & ID để tải trạng thái mới nhất.`);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function resolveBankAccount(use: 'current' | 'history') {
    if (!visibleReport || !visibleAccountDecision || operation.current || hasPendingEdits || !localMatchesCloud) return;
    operation.current = true;
    setBusy(true);
    setMessage('');
    const started = context;
    const { comparison, source } = visibleAccountDecision;
    if (comparison.bankCheck?.blocksSync || (use === 'history' && source.bankCheck?.blocksSync)) {
      operation.current = false;
      setBusy(false);
      return;
    }
    setAccountDecision(null);
    try {
      await assertTransactionCheckCurrent(supabase, visibleReport);
      requireUnchangedContext(started);
      if (use === 'current') {
        const version = visibleReport.versions.find(item => item.id === source.versionId);
        if (!version) throw new Error(`Không tìm thấy nguồn tháng ${source.period}. Hãy kiểm tra lại.`);
        const nextRows = applyTransactionHistoryResolution(version.rows, {
          field: 'Beneficiary Account No.',
          value: comparison.currentAccount,
          rowIndexes: source.rowIndexes,
          basedOnPeriods: [month],
          resolvedAt: new Date().toISOString(),
        });
        await replaceVersionIfCurrent(supabase, version, nextRows, crypto.randomUUID());
      } else {
        const nextRows = applyTransactionHistoryResolution(visibleReport.currentVersion.rows, {
          field: 'Beneficiary Account No.',
          value: source.account,
          rowIndexes: comparison.currentRowIndexes,
          basedOnPeriods: [source.period],
          resolvedAt: new Date().toISOString(),
        });
        await replaceVersionIfCurrent(
          supabase,
          visibleReport.currentVersion,
          selectPeriodRows(nextRows, month),
          crypto.randomUUID(),
        );
        requireUnchangedContext(started);
        onReplaceRows(replaceTransactionPeriod(rows, month, nextRows));
        setReport(null);
      }
      const current = await loadLatestVersion(supabase, month);
      if (!current) throw new HistorySaveConflictError('Không đọc lại được tháng hiện tại sau khi đồng bộ STK.');
      const employeeSync = await syncTransactionEmployeesToSupabase(supabase, current.rows);
      if (use === 'current') {
        if (await refreshReport(started)) setMessage(`Đã dùng STK hiện tại ${comparison.currentAccount} cho tháng ${formatResolutionPeriods([source.period])}. ${employeeSyncMessage(employeeSync)}`);
      } else {
        setMessage(`Đã dùng STK quá khứ ${source.account} cho tháng hiện tại ${formatResolutionPeriods([month])}. ${employeeSyncMessage(employeeSync)}`);
      }
    } catch (error) {
      if (currentContext.current === started) {
        setReport(null);
        setMessage(`${error instanceof Error ? error.message : 'Không thể đồng bộ STK.'} Bấm Check STK & ID để tải trạng thái mới nhất.`);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function openSource(location: TransactionSourceLocation) {
    if (!visibleReport || operation.current) return;
    operation.current = true;
    setBusy(true);
    const started = context;
    try {
      await assertTransactionCheckCurrent(supabase, visibleReport);
      requireUnchangedContext(started);
      savedReportScroll.current = {top: reportScroll.current?.scrollTop || 0, left: reportScroll.current?.scrollLeft || 0};
      setSourceLocation({...location, context: started});
    } catch (error) {
      if (currentContext.current === started) {
        setReport(null);
        setMessage(`${error instanceof Error ? error.message : 'Không thể mở nguồn.'} Bấm Check STK & ID để tải lại.`);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function resolveName() {
    if (!visibleReport || !visibleNameGroup || !nameDecision || operation.current || hasPendingEdits || !localMatchesCloud) return;
    const option = visibleNameGroup.options.find(item => item.key === nameDecision.optionKey);
    const targets = nameResolutionTargets(visibleNameGroup, nameDecision.optionKey);
    if (!option || !targets.length) return;
    operation.current = true;
    setBusy(true);
    setMessage('');
    const started = context;
    const resolvedAt = new Date().toISOString();
    const completed: string[] = [];
    let nextLocalRows = rows;
    try {
      await assertTransactionCheckCurrent(supabase, visibleReport);
      requireUnchangedContext(started);
      // Update historical months first; replace local Transaction only after
      // the current month has been saved and read back successfully.
      const ordered = targets.filter(target => target.versionId !== visibleReport.currentVersion.id)
        .concat(targets.filter(target => target.versionId === visibleReport.currentVersion.id));
      for (const target of ordered) {
        const version = [visibleReport.currentVersion, ...visibleReport.versions].find(item => item.id === target.versionId);
        if (!version) throw new HistorySaveConflictError('Không tìm thấy tháng nguồn.');
        const nextRows = applyTransactionHistoryResolution(version.rows, {
          field: 'Beneficiary Name', value: option.name, rowIndexes: target.rowIndexes,
          basedOnPeriods: [option.period], resolvedAt,
        });
        requireUnchangedContext(started);
        const id = await replaceVersionIfCurrent(supabase, version, nextRows, crypto.randomUUID());
        const saved = await loadLatestVersion(supabase, target.period);
        if (!saved || saved.id !== id || !sameTransactionSnapshot(saved.rows, nextRows, target.period)) {
          throw new HistorySaveConflictError('Bản lưu tên đã thay đổi hoặc chưa đọc lại được.');
        }
        completed.push(target.period);
        if (version.id === visibleReport.currentVersion.id) nextLocalRows = replaceTransactionPeriod(rows, month, saved.rows);
      }
      requireUnchangedContext(started);
      // Refresh automatically, using the same local rows that will be committed.
      const fresh = await loadTransactionCheckSource(supabase, month);
      requireUnchangedContext(started);
      const employeeSync = await syncTransactionEmployeesToSupabase(supabase, fresh.currentVersion.rows);
      requireUnchangedContext(started);
      if (nextLocalRows !== rows) onReplaceRows(nextLocalRows);
      setReport({
        ...fresh, context: JSON.stringify([month, nextLocalRows, userId, hasPendingEdits, defaultBank]),
        comparisons: compareAccountsAcrossHistory(selectPeriodRows(fresh.currentVersion.rows, month), fresh.versions, defaultBank),
      });
      setMessage(`Đã đồng bộ tên theo tháng ${formatResolutionPeriods([option.period])}: ${option.name}. Đã lưu tháng ${formatResolutionPeriods(completed)} lên Supabase. ${employeeSyncMessage(employeeSync)}`);
      setNameDecision(null);
    } catch (error) {
      if (currentContext.current === started) {
        // A later refresh can fail after a verified current-month write.
        if (nextLocalRows !== rows) onReplaceRows(nextLocalRows);
        setReport(null);
        setNameDecision(null);
        setMessage(`${completed.length ? `Đã lưu tháng ${formatResolutionPeriods(completed)}. ` : ''}${error instanceof Error ? error.message : 'Không thể đồng bộ tên.'} Bấm Check STK & ID để tải trạng thái mới nhất.`);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  function sourceLink(value: string, location: TransactionSourceLocation, title?: string) {
    return <button type="button" className="text-left text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary disabled:opacity-50 active:scale-[0.98]"
      disabled={busy} title={title || `Mở Transaction nguồn · ${location.field} · dòng ${location.rowIndexes.map(index => index + 1).join(', ')}`}
      onClick={() => void openSource(location)}>{value || '—'} <span aria-hidden="true">↗</span></button>;
  }

  async function exportReport() {
    try {
      if (!visibleReport) return;
      const XLSX = await import('xlsx');
      const data = exceptions.map(row => ({
        'Tháng này': month,
        'Nguồn tháng hiện tại': `Supabase #${visibleReport.currentVersion.id} · ${visibleReport.currentVersion.created_at}`,
        'Ngân hàng kiểm tra': row.bankCheck?.bank || 'Chưa xác định',
        'Ngân hàng mặc định': row.bankCheck?.bankAssumed ? 'Có' : 'Không',
        'Phạm vi xác minh': 'Đối chiếu dữ liệu; chưa xác minh với ngân hàng',
        'Nguồn đối chiếu': row.sources.map(source => `${source.period} · #${source.versionId} · ${formatHistoryDate(source.createdAt)} · Document ID ${markedDocumentId(source.documentId, source.documentIdSyncNote)} · STK ${source.account} · ${source.name}${source.documentIdSyncNote ? ` · ! Đồng bộ theo ${source.documentIdSyncNote}` : ''}`).join('\n'),
        'Document ID lịch sử': markedDocumentId(row.previousDocumentId, row.sources.map(source => source.documentIdSyncNote).find(Boolean) || ''),
        'Document ID hiện tại': markedDocumentId(row.documentId, row.currentDocumentIdSyncNote),
        'STK lịch sử': row.previousAccount,
        'STK hiện tại': row.currentAccount, 'Tên lịch sử': row.previousName,
        'Tên hiện tại': row.currentName,
        'Ghi chú đồng bộ ID': [
          row.currentDocumentIdSyncNote ? `Hiện tại: ${row.currentDocumentIdSyncNote}` : '',
          ...row.sources.filter(source => source.documentIdSyncNote)
            .map(source => `${formatResolutionPeriods([source.period])}: ${source.documentIdSyncNote}`),
        ].filter(Boolean).join('\n'),
        'Cảnh báo': row.issues.join('; '),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), 'Check STK-ID');
      XLSX.writeFile(workbook, `Check-STK-ID-${month.replace(/[^\d-]/g, '-')}.xlsx`);
    } catch { setMessage('Không thể xuất báo cáo Check STK & ID.'); }
  }

  return <section aria-label="Kho Transaction theo tháng" className="shrink-0 border-b border-primary/15 bg-card p-2 text-foreground" style={{fontFamily: 'var(--font-table, var(--font-main))'}}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold">Kho Transaction · {month}</span>
      <button type="button" className={buttonClass} disabled={busy || !userId || hasPendingEdits} title="Lưu Transaction đã bấm Lưu sửa lên Supabase, thay dữ liệu đúng tháng đang chọn" onClick={() => void run('save')}>Lưu tháng</button>
      <button type="button" className={buttonClass} disabled={busy || !userId || hasPendingEdits} title="Tải phiên bản mới nhất của tháng này và các tháng trước từ Supabase" onClick={() => void run('check')}>Check STK & ID</button>
      {busy && <span role="status" className="text-xs">Đang xử lý…</span>}
    </div>
    {hasPendingEdits && <p role="status" className="mt-2 text-xs text-primary">Có chỉnh sửa chưa lưu. Bấm Lưu sửa trong Transaction trước khi Lưu tháng hoặc Check STK & ID.</p>}
    {message && <p role="status" className="text-xs mt-2">{message}</p>}
    {showReport && report && !visibleReport && <p className="text-xs mt-2">Dữ liệu đã đổi. Bấm Check STK & ID để kiểm tra lại.</p>}
    {showReport && sourceVersion && sourceLocation && <TransactionHistorySourceTable key={`${sourceVersion.id}-${sourceLocation.field}-${sourceLocation.rowIndexes.join(',')}`} version={sourceVersion} location={sourceLocation} onBack={() => setSourceLocation(null)} />}
    {showReport && visibleReport && !sourceVersion && <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <strong>Check STK & Document ID · Tất cả tháng đã lưu → {month}</strong>
        <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold">Tháng hiện tại: Supabase #{visibleReport.currentVersion.id} · {formatHistoryDate(visibleReport.currentVersion.created_at)}</span>
        <details><summary className="cursor-pointer">{visibleReport.versions.length} tháng nguồn{visibleReport.versions.length ? ` · ${visibleReport.versions[0].period.slice(0, 7)} – ${visibleReport.versions[visibleReport.versions.length - 1].period.slice(0, 7)}` : ''}</summary>
          <ul>{visibleReport.versions.map(version => <li key={version.id}>{version.period.slice(0, 7)} · Nguồn #{version.id} · {formatHistoryDate(version.created_at)}</li>)}</ul>
        </details>
        <span>{visibleReport.comparisons.length} dòng · {exceptions.length} cần kiểm tra · {comparisons.length - exceptions.length} khớp dữ liệu · {visibleReport.comparisons.length - comparisons.length} ID mới ẩn</span>
        <button type="button" className={buttonClass} disabled={!exceptions.length} onClick={() => void exportReport()}>Xuất Check STK & ID</button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Mỗi lần Check tải lại phiên bản Supabase mới nhất. Kết quả là đối chiếu dữ liệu, chưa xác minh chủ tài khoản hoặc trạng thái tài khoản với ngân hàng.</p>
      {!localMatchesCloud && <div role="status" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2 text-xs">
        <span>Transaction trên máy khác bản Supabase đang kiểm tra. Lưu tháng để dùng dữ liệu trên máy, hoặc tải bản đã lưu trước khi đồng bộ.</span>
        <button type="button" className={buttonClass} disabled={busy || hasPendingEdits} onClick={() => void run('load')}>Tải bản đã lưu</button>
      </div>}
      <details className="mt-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">Quy tắc STK · Nguồn Vietcombank · 08/09/26</summary>
        <div className="mt-2 space-y-1.5">
          <p>Đối chiếu ngân hàng + STK + tên + Document ID; giữ số 0 đầu. Tên bỏ khác biệt hoa/thường, dấu tiếng Việt và khoảng trắng khi so sánh, giữ nguyên dữ liệu đã nhập.</p>
          <p>STK trùng tên người khác cần xác minh: VCB có tài khoản chung và số tài khoản đã đóng có thể được cấp lại. Một người có thể dùng nhiều tài khoản; nickname cần xác nhận khả năng dùng trên kênh chi lương.</p>
          <p>Document ID trong payroll có thể là mã nhân sự, không mặc định là CCCD. Điều kiện tuổi, giấy tờ còn hiệu lực, sinh trắc học và tình trạng hoạt động cần hồ sơ/xác nhận ngân hàng.</p>
          <p className="flex flex-wrap gap-3">
            <a className="underline" href="https://www.vietcombank.com.vn/vi-VN/KHCN/SPDV/Dich-vu-tai-khoan/Tai-khoan-thanh-toan" target="_blank" rel="noreferrer">Điều kiện mở tài khoản</a>
            <a className="underline" href="https://www.vietcombank.com.vn/-/media/Project/VCB-Sites/VCB/KHCN/Bieu-mau-Bieu-phi-KHCN/Bieu-mau/Dich-vu-tai-khoan/Tai-khoan-thanh-toan/16122025-DKDK-mo-va-su--dung-TKTT-truc-tuyen.pdf" target="_blank" rel="noreferrer">Điều khoản VCB</a>
            <a className="underline" href="https://www.vietcombank.com.vn/vi-VN/KHCN/Truy-cap-nhanh/Tin-noi-bat/Articles/chuyen-tien-lien-ngan-hang-toi-nickname-tai-khoan-vietcombank-that-de-dang" target="_blank" rel="noreferrer">Nickname tài khoản</a>
          </p>
        </div>
      </details>
      {exceptions.length > 0 && <>
        <div ref={reportScroll} className="max-h-[55vh] overflow-auto mt-2 rounded-xl border border-primary/15">
          <table className="w-full text-xs text-left"><thead className="sticky top-0 bg-card"><tr>
            {['Mức kiểm tra / NH', 'Document ID lịch sử', 'Document ID hiện tại', 'STK lịch sử', 'STK hiện tại', 'Tên lịch sử', 'Tên hiện tại', 'Nguồn đối chiếu', 'Cảnh báo', 'Giải quyết'].map(header => <th key={header} className="p-2 border-b">{header}</th>)}
          </tr></thead><tbody>{exceptions.slice((activePage - 1) * 25, activePage * 25).map(row => {
            const idGroup = buildDocumentIdResolutionGroup(row, month);
            const accountOptions = bankAccountResolutionOptions(row);
            const nameGroup = buildNameResolutionGroup(visibleReport.currentVersion, visibleReport.versions, row.currentRowIndex, defaultBank);
            const currentLocation = {versionId: visibleReport.currentVersion.id, rowIndexes: [row.currentRowIndex]};
            const historicalLinks = (field: string, getValue: (source: HistoricalAccountComparison['sources'][number]) => string) => row.sources.length
              ? <div className="space-y-1">{row.sources.map(source => <div key={source.versionId}>
                {sourceLink(getValue(source), {versionId: source.versionId, rowIndexes: source.rowIndexes, field})}
                <span className="ml-1 text-[10px] text-muted-foreground">{formatResolutionPeriods([source.period])}</span>
              </div>)}</div> : '—';
            return <tr key={row.currentRowIndex} className="bg-amber-50/40 dark:bg-amber-950/20">
              <td className="p-2 border-b"><span className="block whitespace-nowrap font-semibold">{row.bankCheck?.findings.some(item => item.severity === 'error') ? 'Cần sửa' : 'Cần đối chiếu'}</span><span className="text-[10px] text-muted-foreground">{row.bankCheck?.bank || 'Chưa rõ NH'}{row.bankCheck?.bankAssumed ? ' · mặc định' : ''}</span></td>
              <td className="p-2 border-b tabular-nums">{historicalLinks('Document ID', source => markedDocumentId(source.documentId, source.documentIdSyncNote))}</td>
              <td className="p-2 border-b tabular-nums">{sourceLink(markedDocumentId(row.documentId, row.currentDocumentIdSyncNote), {...currentLocation, field: 'Document ID'}, row.currentDocumentIdSyncNote ? `! Đồng bộ theo ${row.currentDocumentIdSyncNote} · Mở nguồn` : undefined)}</td>
              <td className="p-2 border-b tabular-nums">{historicalLinks('Beneficiary Account No.', source => source.account)}</td>
              <td className="p-2 border-b tabular-nums">{sourceLink(row.currentAccount, {...currentLocation, field: 'Beneficiary Account No.'})}</td>
              <td className="p-2 border-b">{historicalLinks('Beneficiary Name', source => source.name)}</td>
              <td className="p-2 border-b">{sourceLink(row.currentName, {...currentLocation, field: 'Beneficiary Name'})}</td>
              <td className="p-2 border-b tabular-nums whitespace-pre-line">
                <div className="space-y-1.5">{row.sources.map(source => <div key={`${source.period}-${source.versionId}`}>
                  <div>{sourceLink(`${formatResolutionPeriods([source.period])} · #${source.versionId}`, {versionId: source.versionId, rowIndexes: source.rowIndexes, field: 'Document ID'}, `Transaction ${source.period} · lưu ${formatHistoryDate(source.createdAt)}`)}</div>
                  {source.documentIdSyncNote && <div className="mt-0.5 inline-flex rounded-full bg-primary/20 px-2 py-0.5 font-semibold text-foreground">! Đồng bộ theo {source.documentIdSyncNote}</div>}
                </div>)}</div>
              </td>
              <td className="p-2 border-b min-w-40 max-w-64"><span>{summarizeHistoryWarnings(row)}</span>
                <details className="mt-1 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Chi tiết</summary><p className="mt-1 whitespace-pre-line">{row.issues.join('\n')}</p></details>
              </td>
              <td className="p-2 border-b">
                <div className="flex min-w-max flex-col items-start gap-1.5">
                  {idGroup && <button type="button" className={resolutionButtonClass} disabled={busy || !localMatchesCloud} title="Mở hộp thoại chọn tháng nguồn cho Document ID" onClick={() => setDocumentIdDecision({context, rowIndex: row.currentRowIndex, optionKey: ''})}>Đồng bộ ID</button>}
                  {nameGroup && <button type="button" className={resolutionButtonClass} disabled={busy || !localMatchesCloud} onClick={() => setNameDecision({context, rowIndex: row.currentRowIndex, optionKey: ''})}>Đồng bộ tên</button>}
                  {accountOptions.map(source => <button key={`${source.versionId}-${source.account}`} type="button" className={resolutionButtonClass} disabled={busy || !localMatchesCloud} title={`Chọn STK cho tháng ${formatResolutionPeriods([source.period])}`} onClick={() => setAccountDecision({context, comparison: row, source})}>Chọn STK {formatResolutionPeriods([source.period])}</button>)}
                  {!idGroup && !nameGroup && accountOptions.length === 0 && <span className="text-[10px] text-muted-foreground">{row.bankCheck?.blocksSync ? 'Cần xác minh' : '—'}</span>}
                </div>
              </td>
            </tr>;
          })}</tbody></table>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs"><button type="button" className={buttonClass} disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Trước</button><span>{activePage}/{pageCount}</span><button type="button" className={buttonClass} disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}>Sau</button></div>
      </>}
    </div>}
    <Dialog open={settingsOpen} onOpenChange={open => { if (!busy) { setSettingsOpen(open); if (!open) setLoginOpen(false); } }}>
      <DialogContent className="!max-w-md !rounded-2xl !border !border-primary/20 !bg-card p-5 text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold normal-case not-italic tracking-tight">Cài đặt Transaction</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Các tuỳ chọn kết nối và dữ liệu mặc định của riêng bảng Transaction.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <label className="block space-y-1.5">
            <span className="font-semibold">Ngân hàng mặc định khi dòng chưa ghi ngân hàng</span>
            <select aria-label="Ngân hàng mặc định khi dòng chưa ghi ngân hàng" disabled={busy} className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-foreground" value={defaultBank} onChange={event => setDefaultBank(event.target.value)}>
              <option value="VCB">Vietcombank</option><option value="">Chưa xác định</option>
            </select>
          </label>
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
            <p className="font-semibold">Kho dữ liệu Supabase</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Đăng nhập để lưu tháng và kiểm tra dữ liệu Transaction đã lưu.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!userId ? <button type="button" className={buttonClass} disabled={busy} onClick={() => setLoginOpen(value => !value)}>Đăng nhập kho</button>
                : <button type="button" className={buttonClass} disabled={busy} onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  setMessage(error ? error.message : 'Đã đăng xuất kho.');
                }}>Đăng xuất kho</button>}
              {userId && <span className="text-[10px] text-emerald-700">Đã kết nối</span>}
            </div>
            {loginOpen && !userId && <form className="mt-3 space-y-2" onSubmit={event => {event.preventDefault(); void login();}}>
              <label className="block">Email<input type="email" required autoComplete="username" className="mt-1 block w-full rounded border p-2 text-foreground bg-background" value={email} onChange={event => setEmail(event.target.value)} /></label>
              <label className="block">Mật khẩu<input type="password" required autoComplete="current-password" className="mt-1 block w-full rounded border p-2 text-foreground bg-background" value={password} onChange={event => setPassword(event.target.value)} /></label>
              <button className={buttonClass} disabled={busy}>Đăng nhập</button>
              <p className="text-[10px] text-muted-foreground">Cần tài khoản được quản trị viên cấp quyền kho payroll.</p>
            </form>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(visibleDocumentIdGroup)} onOpenChange={open => { if (!open && !busy) setDocumentIdDecision(null); }}>
      <DialogContent className="!max-w-lg !rounded-2xl !border !border-primary/20 !bg-card p-5 text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold normal-case not-italic tracking-tight">Đồng bộ Document ID theo tháng nào?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Chọn tháng có Document ID đúng. Chỉ cột Document ID của các tháng có giá trị khác mới được cập nhật; các cột khác và Tháng báo cáo được giữ nguyên.</DialogDescription>
        </DialogHeader>
        {visibleDocumentIdGroup && <div className="space-y-3 text-xs">
          <p className="font-semibold">Đối tượng đang đối soát · chọn đúng nguồn dữ liệu trước khi lưu lên Supabase.</p>
          <fieldset disabled={busy} className="max-h-52 space-y-2 overflow-auto">
            <legend className="mb-2 font-semibold">Tháng lấy Document ID</legend>
            {visibleDocumentIdGroup.options.map(option => <label key={option.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${documentIdDecision?.optionKey === option.key ? 'border-primary bg-primary/10' : 'border-primary/20'}`}>
              <input type="radio" name="document-id-source-month" value={option.key} checked={documentIdDecision?.optionKey === option.key} onChange={() => setDocumentIdDecision(value => value ? {...value, optionKey: option.key} : null)} />
              <span><span className="block font-bold">Tháng {formatResolutionPeriods([option.period])}{option.location === 'current' ? ' · hiện tại' : ' · lịch sử'}</span><span className="tabular-nums">Document ID: {option.documentId}</span></span>
            </label>)}
          </fieldset>
          {documentIdTargets.length > 0 && <div className="rounded-xl border border-primary/20 p-2.5">
            <p className="font-semibold">Các tháng sẽ tự động cập nhật trên Supabase</p>
            <ul className="mt-1 max-h-36 space-y-1 overflow-auto">{documentIdTargets.map(target => <li key={`${target.location}-${target.location === 'history' ? target.versionId : 'current'}`}>Tháng {formatResolutionPeriods([target.period])} · {target.rowIndexes.length} dòng: {target.fromDocumentId || '(trống)'} → {visibleDocumentIdGroup.options.find(option => option.key === documentIdDecision?.optionKey)?.documentId}</li>)}</ul>
          </div>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} disabled={busy} onClick={() => setDocumentIdDecision(null)}>Hủy</button>
            <button type="button" className={buttonClass} disabled={busy || !documentIdTargets.length || !localMatchesCloud} onClick={() => void resolveDocumentId()}>Lưu đồng bộ</button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(visibleNameGroup)} onOpenChange={open => { if (!open && !busy) setNameDecision(null); }}>
      <DialogContent className="!max-w-lg !rounded-2xl !border !border-primary/20 !bg-card p-5 text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold normal-case not-italic tracking-tight">Đồng bộ tên theo tháng nào?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">Chọn tháng có tên đúng. Tên này sẽ được lưu vào các dòng cùng ID, ngân hàng và STK trong những tháng liệt kê bên dưới.</DialogDescription>
        </DialogHeader>
        {visibleNameGroup && <div className="space-y-3 text-xs">
          <p className="font-semibold tabular-nums">ID {visibleNameGroup.documentId} · {visibleNameGroup.bank} · STK {visibleNameGroup.account}</p>
          <fieldset disabled={busy} className="max-h-52 space-y-2 overflow-auto">
            <legend className="mb-2 font-semibold">Tháng lấy tên</legend>
            {visibleNameGroup.options.map(option => <label key={option.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 ${nameDecision?.optionKey === option.key ? 'border-primary bg-primary/10' : 'border-primary/20'}`}>
              <input type="radio" name="name-source-month" value={option.key} checked={nameDecision?.optionKey === option.key} onChange={() => setNameDecision(value => value ? {...value, optionKey: option.key} : null)} />
              <span><span className="block font-bold">Tháng {formatResolutionPeriods([option.period])}{option.versionId === visibleReport?.currentVersion.id ? ' · hiện tại' : ''}</span><span>{option.name}</span></span>
            </label>)}
          </fieldset>
          {nameTargets.length > 0 && <div className="rounded-xl border border-primary/20 p-2.5">
            <p className="font-semibold">Các tháng sẽ cập nhật</p>
            <ul className="mt-1 max-h-36 space-y-1 overflow-auto">{nameTargets.map(target => <li key={target.versionId}>Tháng {formatResolutionPeriods([target.period])} · {target.rowIndexes.length} dòng: {target.names.map(name => name || '(trống)').join(' / ')} → {visibleNameGroup.options.find(option => option.key === nameDecision?.optionKey)?.name}</li>)}</ul>
          </div>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} disabled={busy} onClick={() => setNameDecision(null)}>Hủy</button>
            <button type="button" className={buttonClass} disabled={busy || !nameTargets.length || !localMatchesCloud} onClick={() => void resolveName()}>Lưu đồng bộ</button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(visibleAccountDecision)} onOpenChange={open => { if (!open) setAccountDecision(null); }}>
      <DialogContent className="!max-w-md !rounded-2xl !border !border-primary/20 !bg-card p-5 text-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold normal-case not-italic tracking-tight">Chọn STK · {visibleAccountDecision ? formatResolutionPeriods([visibleAccountDecision.source.period]) : ''}</DialogTitle>
          <DialogDescription className="text-xs font-medium normal-case text-muted-foreground">
            Tháng này sẽ dùng STK của tháng hiện tại hay STK đã lưu trong quá khứ?
          </DialogDescription>
        </DialogHeader>
        {visibleAccountDecision && <div className="grid gap-2">
          <button type="button" disabled={busy} className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-left transition-colors hover:bg-primary/20 active:scale-[0.98]" onClick={() => void resolveBankAccount('current')}>
            <span className="block text-xs font-bold">STK hiện tại</span>
            <span className="mt-1 block text-sm font-semibold tabular-nums">{visibleAccountDecision.comparison.currentAccount}</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">Cập nhật STK này vào tháng {formatResolutionPeriods([visibleAccountDecision.source.period])}.</span>
          </button>
          <button type="button" disabled={busy || visibleAccountDecision.source.bankCheck?.blocksSync} className="rounded-xl border border-primary/20 bg-background p-3 text-left transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:opacity-50" onClick={() => void resolveBankAccount('history')}>
            <span className="block text-xs font-bold">STK quá khứ</span>
            <span className="mt-1 block text-sm font-semibold tabular-nums">{visibleAccountDecision.source.account}</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">{visibleAccountDecision.source.bankCheck?.blocksSync ? 'STK quá khứ cần xác minh trước khi sử dụng.' : `Đổi tháng hiện tại ${formatResolutionPeriods([month])} sang STK này.`}</span>
          </button>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
