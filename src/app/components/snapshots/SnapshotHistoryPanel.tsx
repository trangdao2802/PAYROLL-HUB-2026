import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  History,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Pin,
  PinOff,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  Layers,
  FileSpreadsheet,
  Database,
  ArrowRight,
  ShieldCheck,
  Search,
  Loader2,
} from "lucide-react";
import {
  getSnapshotsList,
  getSnapshotById,
  saveSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  togglePinSnapshot,
  renameSnapshot,
  exportSnapshotJson,
  calculateSnapshotStats,
  type SnapshotMetadata,
  type DataSnapshot,
} from "../../lib/utils/snapshot-manager";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

interface SnapshotHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SnapshotHistoryPanel({ isOpen, onClose }: SnapshotHistoryPanelProps) {
  const { appData, updateAppData } = useAppData();
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<DataSnapshot | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTrigger, setFilterTrigger] = useState<string>("all");

  // Create Snapshot State
  const [isCreating, setIsCreating] = useState(false);
  const [newSnapshotTitle, setNewSnapshotTitle] = useState("");
  const [newSnapshotNote, setNewSnapshotNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Rename State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Restore Confirmation State
  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState<SnapshotMetadata | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Table Preview Tab State
  const [previewTableTab, setPreviewTableTab] = useState<
    "Timesheet_Roster" | "Master_Roster" | "Q_Staff" | "Q_Salary_Scale"
  >("Timesheet_Roster");

  // Current App Data Stats
  const currentStats = useMemo(() => calculateSnapshotStats(appData), [appData]);

  // Load snapshots list
  const loadSnapshots = useCallback(async () => {
    const list = await getSnapshotsList();
    setSnapshots(list);
  }, []);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      getSnapshotsList().then((list) => {
        if (active) setSnapshots(list);
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Listen to update events
  useEffect(() => {
    const handleUpdate = () => {
      loadSnapshots();
    };
    window.addEventListener("payroll-snapshots-updated", handleUpdate);
    return () => window.removeEventListener("payroll-snapshots-updated", handleUpdate);
  }, [loadSnapshots]);

  // Auto-create initial baseline snapshot if none exists
  useEffect(() => {
    if (isOpen && snapshots.length === 0 && appData) {
      // Check if current data has rows
      const stats = calculateSnapshotStats(appData);
      if (stats.totalRows > 0) {
        saveSnapshot(appData, {
          title: "Trạng thái khởi tạo",
          trigger: "auto",
          note: "Tự động ghi nhận khi mở lịch sử phiên bản",
        }).then(() => {
          getSnapshotsList().then(setSnapshots);
        });
      }
    }
  }, [isOpen, snapshots.length, appData]);

  // Handle selecting snapshot for preview
  const handleSelectSnapshot = async (id: string) => {
    if (selectedSnapshotId === id) {
      // Toggle off preview
      setSelectedSnapshotId(null);
      setPreviewSnapshot(null);
      return;
    }

    setSelectedSnapshotId(id);
    setIsLoadingPreview(true);
    try {
      const data = await getSnapshotById(id);
      setPreviewSnapshot(data);
    } catch {
      toast.error("Không thể tải dữ liệu xem trước điểm khôi phục");
      setSelectedSnapshotId(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle Manual Snapshot Creation
  const handleCreateSnapshot = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const title = newSnapshotTitle.trim() || undefined;
      await saveSnapshot(appData, {
        title,
        note: newSnapshotNote.trim() || undefined,
        trigger: "manual",
        isPinned: true, // Manual snapshots pinned by default
      });
      toast.success("Đã tạo điểm khôi phục dữ liệu thành công!");
      setIsCreating(false);
      setNewSnapshotTitle("");
      setNewSnapshotNote("");
      await loadSnapshots();
    } catch {
      toast.error("Lỗi khi tạo điểm khôi phục");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Restore Execution
  const handleConfirmRestore = async () => {
    if (!restoreConfirmTarget || isRestoring) return;
    setIsRestoring(true);
    try {
      const { restoredData, meta } = await restoreSnapshot(
        restoreConfirmTarget.id,
        appData,
      );
      // Update AppData state with the restored data
      updateAppData(() => restoredData, true, true);
      toast.success(`Đã khôi phục dữ liệu về phiên bản: ${meta.title}!`);
      setRestoreConfirmTarget(null);
      setSelectedSnapshotId(null);
      setPreviewSnapshot(null);
      await loadSnapshots();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi khôi phục dữ liệu");
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Pin
  const handleTogglePin = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const pinned = await togglePinSnapshot(id);
    toast.info(pinned ? "Đã ghim điểm khôi phục" : "Đã bỏ ghim điểm khôi phục");
    loadSnapshots();
  };

  // Handle Delete
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa điểm khôi phục này không?")) {
      await deleteSnapshot(id);
      if (selectedSnapshotId === id) {
        setSelectedSnapshotId(null);
        setPreviewSnapshot(null);
      }
      toast.success("Đã xóa điểm khôi phục");
      loadSnapshots();
    }
  };

  // Handle Rename Submit
  const handleSaveRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await renameSnapshot(id, editTitle);
    toast.success("Đã cập nhật tên điểm khôi phục");
    setEditingId(null);
    loadSnapshots();
  };

  // Filtered list
  const filteredSnapshots = useMemo(() => {
    return snapshots.filter((item) => {
      if (filterTrigger === "user_edited") {
        // User edited versions: manual changes, updates, or edits after raw import
        return item.trigger === "manual" || item.trigger === "edit" || (item.note && item.note.toLowerCase().includes("chỉnh sửa"));
      }
      if (filterTrigger === "import") {
        return item.trigger === "import" || (item.note && item.note.toLowerCase().includes("nhập"));
      }
      if (filterTrigger !== "all" && item.trigger !== filterTrigger) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        item.timeString.includes(q) ||
        item.dateString.includes(q) ||
        item.globalMonth.toLowerCase().includes(q)
      );
    });
  }, [snapshots, filterTrigger, searchQuery]);

  // Preview Data Rows for the selected table tab
  const previewRows = useMemo(() => {
    if (!previewSnapshot || !previewSnapshot.data) return [];
    const tableData = previewSnapshot.data[previewTableTab];
    if (Array.isArray(tableData)) {
      return tableData.slice(0, 25);
    }
    return [];
  }, [previewSnapshot, previewTableTab]);

  // Preview Columns extracted from the sample rows
  const previewColumns = useMemo(() => {
    if (previewRows.length === 0) return [];
    const firstRow = previewRows[0];
    if (!firstRow || typeof firstRow !== "object") return [];
    const rowObj = firstRow as Record<string, unknown>;
    return Object.keys(rowObj)
      .filter((k) => !k.startsWith("_") && typeof rowObj[k] !== "object")
      .slice(0, 8); // Display top 8 relevant columns
  }, [previewRows]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-[1120px] h-[92vh] max-h-[820px] rounded-2xl border border-border bg-card text-foreground shadow-2xl overflow-hidden"
        style={{ fontFamily: "var(--font-main)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
                  Lịch sử phiên bản & Điểm khôi phục
                </h2>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
                  {snapshots.length} điểm sao lưu
                </span>
                {selectedSnapshotId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold animate-pulse">
                    <Eye className="w-3 h-3" /> Đang xem trước
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Xem trước và phục hồi dữ liệu bảng tính theo thời gian — chỉ hiển thị các phiên bản chỉnh sửa từ file/link gốc
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo điểm khôi phục</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Đóng bảng điều khiển"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content (Split view: Left Timeline / Right Preview) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Column: Timeline list of snapshots */}
          <div className="w-full md:w-[380px] lg:w-[410px] flex flex-col border-b md:border-b-0 md:border-r border-border bg-card shrink-0">
            {/* Search & Filters */}
            <div className="p-3 border-b border-border/80 space-y-2 bg-muted/15">
              <div className="relative flex items-center w-full">
                <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, ghi chú, giờ, ngày..."
                  className="w-full h-8 pl-8 pr-7 text-xs bg-card border border-border rounded-lg focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "user_edited", label: "Chỉnh sửa (User Edited)" },
                  { id: "import", label: "Gốc (File/Link)" },
                  { id: "manual", label: "Thủ công" },
                  { id: "auto", label: "Tự động" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterTrigger(f.id)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      filterTrigger === f.id
                        ? "bg-foreground text-background shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Active Working State Box */}
            <div className="p-3 border-b border-border/60 bg-emerald-500/5 dark:bg-emerald-500/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                  </span>
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">
                    Phiên bản hiện tại (Đang làm việc)
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                  {currentStats.totalRows.toLocaleString("vi-VN")} dòng
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>Kỳ: <strong>{appData?.globalMonth || "03.2026"}</strong></span>
                <span>Timesheet: {currentStats.timesheetRows} • Master: {currentStats.masterRows}</span>
              </div>
            </div>

            {/* Snapshots Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40">
              {filteredSnapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-2">
                    <Database className="w-5 h-5 opacity-40" />
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    {searchQuery ? "Không tìm thấy điểm khôi phục" : "Chưa có điểm khôi phục nào"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px]">
                    Bấm &quot;Tạo điểm khôi phục&quot; ở trên để lưu lại phiên bản hiện tại trước khi tính toán
                  </p>
                </div>
              ) : (
                filteredSnapshots.map((item) => {
                  const isSelected = selectedSnapshotId === item.id;
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSnapshot(item.id)}
                      className={`group relative p-2.5 rounded-xl cursor-pointer transition-all my-0.5 ${
                        isSelected
                          ? "bg-primary/10 dark:bg-primary/20 border border-primary/40 shadow-xs"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      {/* Top row: Title + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-6 px-1.5 text-xs font-bold border border-primary rounded bg-card text-foreground focus:outline-none w-full"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(item.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(item.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1 text-muted-foreground hover:bg-muted rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4
                                className={`text-xs font-extrabold truncate ${
                                  isSelected ? "text-primary" : "text-foreground"
                                }`}
                                title={item.title}
                              >
                                {item.title}
                              </h4>
                              {item.isPinned && (
                                <span title="Đã ghim">
                                  <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                </span>
                              )}
                            </div>
                          )}

                          {/* Time info */}
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-foreground/80">
                              {item.relativeTime}
                            </span>
                            <span>•</span>
                            <span className="font-mono tabular-nums">{item.timeString}</span>
                            <span>•</span>
                            <span className="font-mono tabular-nums">{item.dateString}</span>
                          </div>
                        </div>

                        {/* Snapshot action icons */}
                        <div
                          className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(e, item.id)}
                            className="p-1 text-muted-foreground hover:text-amber-500 rounded hover:bg-muted transition-colors cursor-pointer"
                            title={item.isPinned ? "Bỏ ghim" : "Ghim điểm này"}
                          >
                            {item.isPinned ? (
                              <PinOff className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Pin className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditTitle(item.title);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors cursor-pointer"
                            title="Đổi tên"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => exportSnapshotJson(item.id)}
                            className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-muted transition-colors cursor-pointer"
                            title="Tải về file JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, item.id)}
                            className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Xóa điểm này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row count stats & tag badge */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/30 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">
                            Kỳ {item.globalMonth}
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {item.stats.totalRows.toLocaleString("vi-VN")} dòng
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                              <Eye className="w-3 h-3" /> Đang chọn
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/80 group-hover:text-foreground">
                              Bấm xem trước →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Preview & Comparison Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-muted/10 overflow-hidden">
            {isLoadingPreview ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <p className="text-xs font-bold text-foreground">Đang tải dữ liệu điểm khôi phục...</p>
              </div>
            ) : selectedSnapshotId && previewSnapshot ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Active Preview Action Bar (Google Sheets Style) */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-2xs">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-primary uppercase tracking-wider">
                          Xem trước phiên bản:
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          {previewSnapshot.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {previewSnapshot.timeString} ngày {previewSnapshot.dateString} • Kỳ {previewSnapshot.globalMonth}
                      </p>
                    </div>
                  </div>

                  {/* Top Restore & Exit CTA buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshotId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Thoát xem trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRestoreConfirmTarget(previewSnapshot)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                      title="Khôi phục toàn bộ bảng tính về phiên bản này"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Khôi phục phiên bản này</span>
                    </button>
                  </div>
                </div>

                {/* Diff & Comparison Card */}
                <div className="p-4 border-b border-border/80 bg-card shrink-0">
                  <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    So sánh với dữ liệu hiện tại
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* Month Diff */}
                    <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        Kỳ báo cáo (Tháng)
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono font-bold">
                        <span className="text-foreground">{previewSnapshot.globalMonth}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            previewSnapshot.globalMonth !== appData.globalMonth
                              ? "text-amber-600 font-black"
                              : "text-muted-foreground"
                          }
                        >
                          {appData.globalMonth}
                        </span>
                      </div>
                    </div>

                    {/* Timesheet Diff */}
                    <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        Timesheet Roster
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono font-bold">
                        <span className="text-foreground">
                          {previewSnapshot.stats.timesheetRows.toLocaleString("vi-VN")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            currentStats.timesheetRows > previewSnapshot.stats.timesheetRows
                              ? "text-emerald-600"
                              : currentStats.timesheetRows < previewSnapshot.stats.timesheetRows
                                ? "text-rose-600"
                                : "text-muted-foreground"
                          }
                        >
                          {currentStats.timesheetRows.toLocaleString("vi-VN")}
                          {currentStats.timesheetRows !== previewSnapshot.stats.timesheetRows && (
                            <span className="text-[10px] ml-1">
                              ({currentStats.timesheetRows - previewSnapshot.stats.timesheetRows > 0 ? "+" : ""}
                              {currentStats.timesheetRows - previewSnapshot.stats.timesheetRows})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Master Diff */}
                    <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        Master Roster
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono font-bold">
                        <span className="text-foreground">
                          {previewSnapshot.stats.masterRows.toLocaleString("vi-VN")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            currentStats.masterRows !== previewSnapshot.stats.masterRows
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }
                        >
                          {currentStats.masterRows.toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>

                    {/* Staff Diff */}
                    <div className="p-2.5 rounded-xl border border-border bg-muted/20">
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        Nhân sự (Q_Staff)
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-mono font-bold">
                        <span className="text-foreground">
                          {previewSnapshot.stats.staffRows.toLocaleString("vi-VN")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            currentStats.staffRows !== previewSnapshot.stats.staffRows
                              ? "text-amber-600"
                              : "text-muted-foreground"
                          }
                        >
                          {currentStats.staffRows.toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Table Data Preview Selector Tabs */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/80 bg-card">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                      Bảng:
                    </span>
                    {[
                      { id: "Timesheet_Roster" as const, label: "Timesheet Roster" },
                      { id: "Master_Roster" as const, label: "Master Roster" },
                      { id: "Q_Staff" as const, label: "Danh sách Nhân sự" },
                      { id: "Q_Salary_Scale" as const, label: "Thang lương" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPreviewTableTab(tab.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          previewTableTab === tab.id
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10px] text-muted-foreground font-medium">
                    Xem trước 25 dòng đầu tiên
                  </span>
                </div>

                {/* Table Data Preview Grid */}
                <div className="flex-1 overflow-auto p-3 bg-muted/5">
                  {previewRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                      <FileSpreadsheet className="w-8 h-8 opacity-40 mb-1" />
                      <p className="text-xs font-semibold">
                        Bảng {previewTableTab} không có dòng dữ liệu nào trong bản ghi này
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs bg-card">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-[11px] font-black uppercase text-foreground tracking-wider">
                            <th className="px-3 py-2 w-12 text-center text-muted-foreground">#</th>
                            {previewColumns.map((col) => (
                              <th key={col} className="px-3 py-2 truncate max-w-[160px]">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                          {previewRows.map((rowItem, idx: number) => {
                            const row = rowItem as Record<string, unknown>;
                            return (
                              <tr key={idx} className="hover:bg-muted/40 transition-colors">
                                <td className="px-3 py-1.5 text-center text-muted-foreground/70 font-mono tabular-nums">
                                  {idx + 1}
                                </td>
                                {previewColumns.map((col) => {
                                  const val = row[col];
                                  const strVal =
                                    val === null || val === undefined
                                      ? "-"
                                      : typeof val === "number"
                                        ? val.toLocaleString("vi-VN")
                                        : String(val);
                                  return (
                                    <td
                                      key={col}
                                      className="px-3 py-1.5 truncate max-w-[160px] text-foreground"
                                      title={strVal}
                                    >
                                      {strVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* No snapshot selected state */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                  <History className="w-7 h-7 opacity-50" />
                </div>
                <h3 className="text-sm font-black text-foreground">
                  Chọn một điểm khôi phục ở cột bên trái
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[340px] leading-relaxed">
                  Bấm vào bất kỳ điểm nào để xem trước dữ liệu chi tiết, so sánh thay đổi với trạng thái hiện tại trước khi quyết định khôi phục.
                </p>
                <div className="flex items-center gap-2 mt-4 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Dữ liệu hiện tại luôn được sao lưu an toàn tự động trước khi khôi phục</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Điểm khôi phục được lưu trữ cục bộ an toàn trong IndexedDB của trình duyệt</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-[11px]">
              {filteredSnapshots.length} / {snapshots.length} điểm khả dụng
            </span>
          </div>
        </div>
      </div>

      {/* Dialog: Create Manual Snapshot */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md rounded-2xl p-5 border border-border shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Tạo điểm khôi phục dữ liệu mới
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Lưu lại toàn bộ trạng thái bảng tính hiện tại để có thể khôi phục lại bất kỳ lúc nào.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold text-foreground block mb-1">
                Tên điểm khôi phục (Tùy chọn)
              </label>
              <input
                type="text"
                value={newSnapshotTitle}
                onChange={(e) => setNewSnapshotTitle(e.target.value)}
                placeholder="VD: Trước khi chốt bảng lương T9, Sau khi nhập Roster..."
                className="w-full h-8 px-3 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="font-bold text-foreground block mb-1">
                Ghi chú thêm (Tùy chọn)
              </label>
              <textarea
                value={newSnapshotNote}
                onChange={(e) => setNewSnapshotNote(e.target.value)}
                placeholder="VD: Đã kiểm tra 45 cơ sở, khớp dữ liệu hold..."
                className="w-full h-16 p-2 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary transition-all resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1 text-[11px]">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Kỳ làm việc:</span>
                <span className="font-bold text-foreground">{appData?.globalMonth || "03.2026"}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Tổng số dòng dữ liệu:</span>
                <span className="font-bold font-mono text-foreground">
                  {currentStats.totalRows.toLocaleString("vi-VN")} dòng
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Đang lưu..." : "Xác nhận tạo điểm khôi phục"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Restore Confirmation */}
      <Dialog
        open={Boolean(restoreConfirmTarget)}
        onOpenChange={(open) => !open && setRestoreConfirmTarget(null)}
      >
        <DialogContent className="max-w-md rounded-2xl p-5 border border-border shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              Xác nhận khôi phục dữ liệu
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Vui lòng kiểm tra kỹ thông tin phiên bản trước khi tiến hành khôi phục.
            </DialogDescription>
          </DialogHeader>

          {restoreConfirmTarget && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block">
                  Phiên bản đích:
                </span>
                <h4 className="text-sm font-extrabold text-foreground">
                  {restoreConfirmTarget.title}
                </h4>
                <p className="text-[11px] text-muted-foreground font-mono">
                  Lúc {restoreConfirmTarget.timeString} ngày {restoreConfirmTarget.dateString} • Kỳ {restoreConfirmTarget.globalMonth}
                </p>
                <div className="pt-1 text-[11px] text-foreground/90 font-medium">
                  Tổng {restoreConfirmTarget.stats.totalRows.toLocaleString("vi-VN")} dòng (Timesheet: {restoreConfirmTarget.stats.timesheetRows}, Master: {restoreConfirmTarget.stats.masterRows})
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Bảo vệ dữ liệu tự động:</strong> Hệ thống sẽ tự động tạo một điểm sao lưu dự phòng cho trạng thái hiện tại trước khi khôi phục, bạn luôn có thể quay lại bất cứ lúc nào.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRestoreConfirmTarget(null)}
              className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {isRestoring ? "Đang khôi phục..." : "Xác nhận khôi phục"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>,
    document.body
  );
}

export default SnapshotHistoryPanel;
