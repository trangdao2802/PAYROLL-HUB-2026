/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useMemo } from "react";
import { Link as RouterLink } from "react-router";
import { getBusinessFromL07 } from "@/app/lib/utils/center-utils";
import {
  Search,
  Plus,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Clock,
  Trash2,
  FileSpreadsheet,
  RefreshCw,
  Link,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  getL07FromFileName,
  getCenterInfoByL07,
  mapL07,
  getCenterInfoByAECode
} from "../../../lib/utils/center-utils";

export interface TimesheetInputRow {
  id: string;
  l07: string;
  aeCode: string;
  bus: string;
  url: string;
  fileName?: string;
  sheetName?: string;
  status: "pending" | "processing" | "success" | "error";
  count?: number;
  date?: string;
  columnMapping?: Record<string, string>;
  legacyRowIds?: string[];
}

function getSyncDateInfo(dateStr?: string) {
  if (!dateStr || dateStr === "---" || !dateStr.trim()) {
    return {
      status: "none",
      label: "Chưa đồng bộ",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200/80",
      dotClass: "bg-slate-400",
      isOutdated: false,
      diffDays: null,
    };
  }

  try {
    let dateObj: Date | null = null;
    const cleanStr = dateStr.trim();

    // Match DD/MM/YYYY or DD/MM/YYYY, HH:mm
    const matchVi = cleanStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (matchVi) {
      const day = parseInt(matchVi[1], 10);
      const month = parseInt(matchVi[2], 10) - 1;
      const year = parseInt(matchVi[3], 10);
      const hour = matchVi[4] ? parseInt(matchVi[4], 10) : 0;
      const min = matchVi[5] ? parseInt(matchVi[5], 10) : 0;
      dateObj = new Date(year, month, day, hour, min);
    } else {
      dateObj = new Date(cleanStr);
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return {
        status: "unknown",
        label: dateStr,
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        dotClass: "bg-slate-400",
        isOutdated: false,
        diffDays: null,
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffTime = today.getTime() - targetDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays <= 0) {
      return {
        status: "fresh",
        label: "Mới (Hôm nay)",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300/80 font-bold",
        dotClass: "bg-emerald-500",
        isOutdated: false,
        diffDays: 0,
      };
    } else if (diffDays === 1) {
      return {
        status: "recent",
        label: "Hôm qua (1 ngày)",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-300/80 font-semibold",
        dotClass: "bg-sky-500",
        isOutdated: false,
        diffDays: 1,
      };
    } else if (diffDays <= 3) {
      return {
        status: "warning",
        label: `${diffDays} ngày trước (Cũ)`,
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300/90 font-bold",
        dotClass: "bg-amber-500",
        isOutdated: true,
        diffDays,
      };
    } else {
      return {
        status: "outdated",
        label: `Cũ (${diffDays} ngày trước)`,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-300/90 font-bold",
        dotClass: "bg-rose-500",
        isOutdated: true,
        diffDays,
      };
    }
  } catch (e) {
    return {
      status: "unknown",
      label: dateStr,
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      dotClass: "bg-slate-400",
      isOutdated: false,
      diffDays: null,
    };
  }
}

interface TimesheetInputTableProps {
  rows: TimesheetInputRow[];
  onUpdateRow: (id: string, field: keyof TimesheetInputRow, value: any) => void;
  onClearRow: (id: string) => void;
  onAddRow: () => void;
  onUploadFile: (id: string, file: File) => void;
  onClearAll: () => void;
  onClearEmptyL07?: () => void;
  onUploadFiles: (files: File[]) => void;
  onUrlInput?: (id: string, url: string) => void;
  isProcessing?: boolean;
  onRefresh?: () => void;
  onRestoreDefaults?: () => void;
  onSyncRow?: (id: string, urlOverride?: string) => void;
  onReloadFromFolder?: (id: string, l07: string) => void;
}

export function TimesheetInputTable({
  rows,
  onUpdateRow,
  onClearRow,
  onAddRow,
  onUploadFile,
  onUploadFiles,
  onUrlInput,
  onClearAll,
  onClearEmptyL07,
  isProcessing,
  onRefresh,
  onRestoreDefaults,
  onSyncRow,
  onReloadFromFolder,
}: TimesheetInputTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const syncStats = useMemo(() => {
    let fresh = 0;
    let recent = 0;
    let outdated = 0;
    let unsynced = 0;

    rows.forEach((r) => {
      const info = getSyncDateInfo(r.date);
      if (info.status === "fresh") fresh++;
      else if (info.status === "recent") recent++;
      else if (info.status === "warning" || info.status === "outdated") outdated++;
      else unsynced++;
    });

    return { fresh, recent, outdated, unsynced, total: rows.length };
  }, [rows]);

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    no: 55,
    l07: 180,
    aeCode: 160,
    bus: 140,
    file: 340,
    date: 160,
    status: 120,
    actions: 130,
  });

  const handleMouseDown = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + deltaX),
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const paginatedRows = rows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleFileClick = (id: string) => {
    setActiveRowId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      if (activeRowId) {
        // Single file upload case (retry existing row)
        const file = files[0];
        onUploadFile(activeRowId, file);
        const l07 = getL07FromFileName(file.name);
        if (l07) {
          onUpdateRow(activeRowId, "l07", l07);
          const centerInfo = getCenterInfoByL07(l07);
          if (centerInfo) {
            onUpdateRow(activeRowId, "aeCode", centerInfo.aeCode || "");
            onUpdateRow(activeRowId, "bus", getBusinessFromL07(l07));
          }
        }
      } else {
        // Multiple file upload case (new bulk upload)
        onUploadFiles(Array.from(files));
      }
    }
    e.target.value = "";
    setActiveRowId(null);
  };

  return (
    <div 
      id="roster-center-table-wrapper" 
      className="flex-1 flex flex-col min-h-0 relative font-[family-name:var(--font-table,var(--font-main))]"
      style={{
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        paddingRight: "0px",
      } as React.CSSProperties}
    >
      <div className="relative flex flex-col flex-1 min-h-0 bg-card p-0">
        {/* Synchronization Panel Visual Indicator Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[11px] text-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-primary" /> Trạng thái đồng bộ:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Hôm nay: <strong className="ml-0.5">{syncStats.fresh}</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Hôm qua: <strong className="ml-0.5">{syncStats.recent}</strong>
              </span>
              {syncStats.outdated > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  Cảnh báo cũ (&gt;1 ngày): <strong className="ml-0.5">{syncStats.outdated}</strong>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  0 cảnh báo cũ
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                Chưa đồng bộ: <strong className="ml-0.5">{syncStats.unsynced}</strong>
              </span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium hidden sm:block">
            So sánh ngày upload với hiện tại (Hệ thống tự động ghi đè dữ liệu mới)
          </div>
        </div>

        {/* Selection Action Bar */}
        {selectedRowIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0 text-xs font-bold relative z-[130]">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Đã chọn <strong className="tabular-nums text-rose-600 text-sm">{selectedRowIds.size}</strong> dòng</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  selectedRowIds.forEach((id) => onClearRow(id));
                  setSelectedRowIds(new Set());
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedRowIds.size} dòng đã chọn</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRowIds(new Set())}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline ml-2 cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        <div 
          className="flex-1 overflow-auto custom-scrollbar bg-card relative min-h-0 shadow-none p-0 scroll-pt-0"
          style={{ borderWidth: "0.5px", borderStyle: "solid", borderColor: "var(--border)" }}
        >
          <table className="w-full min-w-max border-separate border-spacing-0 border-l border-t border-border" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border w-10 text-center px-2 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
              >
                <input
                  type="checkbox"
                  checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedRowIds.has(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRowIds(new Set(rows.map((r) => r.id)));
                    } else {
                      setSelectedRowIds(new Set());
                    }
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.no }}
              >
                <span>No.</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "no")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.l07 }}
              >
                <span>L07</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "l07")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.aeCode }}
              >
                <span>AE Code</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "aeCode")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.bus }}
              >
                <span>Business</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "bus")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.file }}
              >
                <span>File / Link</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "file")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.date }}
              >
                <span>Upload Date</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "date")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.status }}
              >
                <span>Status</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "status")}
                />
              </th>
              <th 
                className="sticky top-0 z-[110] bg-muted/80 border-b border-r border-border text-[10px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1.5 text-center whitespace-nowrap group select-none shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                style={{ width: colWidths.actions }}
              >
                <span>Actions</span>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 bg-transparent transition-all z-50 select-none"
                  onMouseDown={(e) => handleMouseDown(e, "actions")}
                />
              </th>
            </tr>
          </thead>
          <tbody className="">
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-16 text-center text-sm text-slate-400 border-b border-r border-[#E2E8F0]"
                >
                  <div className="flex flex-col items-center justify-center gap-3 py-6">
                    <span className="text-slate-500 font-medium">Chưa có dữ liệu nào hoặc danh sách L07 trống</span>
                    {onRestoreDefaults && (
                      <button
                        type="button"
                        onClick={onRestoreDefaults}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 hover:text-primary border border-primary/20 text-primary text-[0.6875rem] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin-hover" />
                        Khởi tạo lại 50+ trung tâm L07 gốc
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="transition-colors group animate-in fade-in duration-300 fill-mode-both"
                >
                  <td className="px-2 py-3.5 text-center border-b border-r border-border">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.has(row.id)}
                      onChange={(e) => {
                        const next = new Set(selectedRowIds);
                        if (e.target.checked) {
                          next.add(row.id);
                        } else {
                          next.delete(row.id);
                        }
                        setSelectedRowIds(next);
                      }}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </td>
                  <td
                    className="px-4 py-3.5 text-center text-[0.85em] text-muted-foreground border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td
                    className="px-4 py-3.5 border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    <input
                      id={`l07-${row.id}`}
                      name={`l07-${row.id}`}
                      type="text"
                      value={row.l07 || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateRow(row.id, "l07", val);
                        if (val) {
                          const mappedL07 = mapL07(val);
                          const info = getCenterInfoByL07(mappedL07);
                          if (info) {
                            if (info.aeCode) onUpdateRow(row.id, "aeCode", info.aeCode);
                            onUpdateRow(row.id, "bus", getBusinessFromL07(mappedL07));
                          }
                        }
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-[1em] font-semibold text-foreground p-0"
                      style={{ fontFamily: "inherit", fontSize: "inherit" }}
                      placeholder="L07..."
                    />
                  </td>
                  <td
                    className="px-4 py-3.5 border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    <input
                      id={`aeCode-${row.id}`}
                      name={`aeCode-${row.id}`}
                      type="text"
                      value={row.aeCode || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateRow(row.id, "aeCode", val);
                        if (val) {
                          const info = getCenterInfoByAECode(val);
                          if (info) {
                            if (info.l07) {
                              onUpdateRow(row.id, "l07", info.l07);
                              onUpdateRow(row.id, "bus", getBusinessFromL07(info.l07));
                            }
                          }
                        }
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-[1em] font-semibold text-foreground p-0"
                      style={{ fontFamily: "inherit", fontSize: "inherit" }}
                      placeholder="L07..."
                    />
                  </td>
                  <td
                    className="px-4 py-3.5 border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    <input
                      id={`bus-${row.id}`}
                      name={`bus-${row.id}`}
                      type="text"
                      value={row.bus || ""}
                      onChange={(e) =>
                        onUpdateRow(row.id, "bus", e.target.value)
                      }
                      className="w-full bg-transparent border-none focus:ring-0 text-[1em] font-semibold text-foreground p-0"
                      style={{ fontFamily: "inherit", fontSize: "inherit" }}
                      placeholder="Business..."
                    />
                  </td>
                  <td
                    className="px-4 py-3.5 border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFileClick(row.id)}
                          className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-card border border-border hover:bg-muted text-primary transition-all shadow-2xs group/btn cursor-pointer"
                          title="Tải lên tệp tin"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-primary group-hover/btn:scale-105 transition-transform" />
                        </button>
                        {row.fileName ? (
                          <div className="w-full h-8 bg-muted/50 border border-border rounded-lg px-2.5 text-[0.85em] text-foreground flex items-center justify-between gap-2 overflow-hidden shadow-2xs">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate font-medium" title={row.fileName}>{row.fileName}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {row.url && (
                                <a 
                                  href={row.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-card rounded transition-colors"
                                  title="Mở URL nguồn (Google Sheet/Folder)"
                                >
                                  <Link className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button 
                                onClick={() => {
                                  onUpdateRow(row.id, "url", "");
                                  onUpdateRow(row.id, "fileName", "");
                                  onUpdateRow(row.id, "status", "pending");
                                  onUpdateRow(row.id, "date", "");
                                }}
                                className="text-muted-foreground hover:text-rose-600 p-0.5 rounded hover:bg-card shrink-0 transition-colors cursor-pointer"
                                title="Xóa file"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              defaultValue={row.url || ""}
                              placeholder="Dán link GSheet/Folder..."
                              className="w-full h-8 bg-card border border-border rounded-lg px-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition-all shadow-2xs"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = e.currentTarget.value.trim();
                                  if (val && onUrlInput) {
                                    onUrlInput(row.id, val);
                                  }
                                }
                              }}
                              onPaste={(e) => {
                                const val = e.clipboardData.getData('text').trim();
                                if (val && onUrlInput) {
                                  onUrlInput(row.id, val);
                                  e.preventDefault();
                                }
                              }}
                            />
                            {row.url && (
                              <a 
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0"
                                title="Mở URL nguồn (Google Sheet/Folder)"
                              >
                                <Link className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-3 py-2.5 text-center border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    {(() => {
                      const syncInfo = getSyncDateInfo(row.date);
                      return (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="text-[11px] font-medium text-foreground">
                            {row.date || "---"}
                          </span>
                          {row.date && (
                            <span
                              className={`inline-flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full border shadow-2xs ${syncInfo.badgeClass}`}
                              title={
                                syncInfo.isOutdated
                                  ? `Cảnh báo: Dữ liệu này được upload ${syncInfo.diffDays} ngày trước, đã cũ so với hiện tại. Hãy nhấn 'Đồng bộ' để tự động cập nhật dữ liệu mới đè lên dữ liệu cũ.`
                                  : `Đồng bộ gần nhất: ${syncInfo.label}`
                              }
                            >
                              {syncInfo.isOutdated ? (
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              ) : syncInfo.status === "fresh" ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              ) : (
                                <span className={`w-1.5 h-1.5 rounded-full ${syncInfo.dotClass}`} />
                              )}
                              <span>{syncInfo.label}</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    className="px-4 py-3.5 text-center border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                      fontSize: "var(--font-size)",
                    }}
                  >
                    <div className="flex justify-center">
                      {row.status === "success" ? (
                        <span
                          className="text-[0.65rem] font-bold uppercase py-0.5 px-2 rounded-full bg-accent/10 text-accent"
                          style={{ fontSize: "0.625rem" }}
                        >
                          Success
                        </span>
                      ) : row.status === "error" ? (
                        <span
                          className="text-[0.65rem] font-bold uppercase py-0.5 px-2 rounded-full bg-accent/10 text-accent"
                          style={{ fontSize: "0.625rem" }}
                        >
                          Error
                        </span>
                      ) : (
                        <span
                          className="text-[0.65rem] font-bold uppercase py-0.5 px-2 rounded-full bg-muted text-muted-foreground"
                          style={{ fontSize: "0.625rem" }}
                        >
                          {row.status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="px-4 py-3.5 text-center border-b border-r border-border"
                    style={{
                      fontFamily: "var(--font-table, var(--font-main))",
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {onSyncRow && (() => {
                        const syncInfo = getSyncDateInfo(row.date);
                        return (
                          <button
                            onClick={() => {
                              if (row.url) {
                                onSyncRow(row.id);
                              } else {
                                const l07Lower = (row.l07 || "").trim().toLowerCase();
                                if (l07Lower === "mkt local north" || l07Lower === "mkt_local_north") {
                                  const mktUrl = "https://docs.google.com/spreadsheets/d/1z7DJYJAyWqBw8IXNYbEIHhGXBMumsRA4rUHT1prBsFo/edit?gid=1119129159#gid=1119129159";
                                  onSyncRow(row.id, mktUrl);
                                } else {
                                  if (onReloadFromFolder) {
                                    onReloadFromFolder(row.id, row.l07 || "");
                                  }
                                }
                              }
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all shadow-2xs cursor-pointer ${
                              row.status === "processing" 
                                ? "bg-amber-100 text-amber-600 animate-spin" 
                                : syncInfo.isOutdated
                                  ? "bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 ring-offset-1 animate-pulse"
                                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            }`}
                            title={
                              syncInfo.isOutdated
                                ? "Cảnh báo dữ liệu cũ! Nhấn vào đây để đồng bộ và tự động đè dữ liệu mới"
                                : row.url ? "Đồng bộ lại từ Link" : "Tìm link trong Folder & Đồng bộ"
                            }
                            disabled={row.status === "processing"}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => handleFileClick(row.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs cursor-pointer"
                        title="Upload File Local"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onClearRow(row.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-rose-50 hover:border-rose-200 text-muted-foreground hover:text-rose-600 transition-all shadow-2xs cursor-pointer"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Controls matching DataTable format */}
      <div 
        className="table-footer-pagination px-4 py-2 border-t border-border flex items-center justify-between shrink-0 relative z-40 bg-muted/40"
      >
        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
          <span>
            {rows.length === 0 ? "0" : (currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, rows.length)} / {rows.length} dòng
          </span>
        </div>

        <div className="flex items-center gap-2 px-2">
          {onClearEmptyL07 && (
            <button
              onClick={onClearEmptyL07}
              className="flex items-center gap-1.5 px-3 py-1 mr-2 bg-card border border-border text-muted-foreground hover:text-foreground rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
              title="Xóa rỗng l07"
            >
              <Trash2 className="w-3.5 h-3.5" /> Dọn dòng trống L07
            </button>
          )}
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-2 font-bold text-xs text-foreground select-none flex items-center gap-1">
            <span>TRANG</span>
            <span className="font-extrabold">{currentPage}</span>
            <span>/</span>
            <span>{totalPages || 1}</span>
          </div>

          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        id="fileInput"
        name="fileInput"
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv,.gsheet"
        multiple
      />
      </div>
    </div>
  );
}
