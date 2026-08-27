import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Download,
  Settings,
  RefreshCw,
  Trash2,
  Copy,
  Plus,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  clearSupabaseRosterData,
  syncRosterToSupabase,
  SQL_SETUP_SCRIPT,
} from "../../lib/supabase-sync-utils";
import { useTimesheetCalculations } from "../../hooks/useTimesheetCalculations";
import { getDynamicEmployeeColumns, CENTER_COLUMNS } from "../../constants/timesheet-columns";
import { TimesheetInputTable } from "./components/TimesheetInputTable";
import type { TimesheetInputRow } from "./components/TimesheetInputTable";
import { AppData } from "../../types";
import {
  getL07FromFileName,
  getCenterInfoByL07,
  getBusinessFromL07,
} from "../../lib/utils/center-utils";
import {
  isFileNameStoredAsL07,
  resolveTimesheetCenterFromFileName,
  shouldSkipTimesheetSource,
} from "../../lib/utils/timesheet-input-resolver";
import {
  replaceTimesheetRosterRows,
} from "../../lib/utils/timesheet-roster-utils";
import { 
  generateUUID, 
  prepareDataForExport,
  getExcelFileBuffer,
  fetchGoogleSheetAsFile,
} from "../../lib/utils/data-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";

import ExcelWorker from "../../workers/excelParser.worker?worker";
import type {
  ExcelParseMode,
  ExcelParseResult,
} from "../../workers/excelParser.worker";

type PendingExcelRequest = {
  resolve: (result: ExcelParseResult) => void;
  reject: (error: Error) => void;
};

let excelWorker: Worker | null = null;
const pendingExcelRequests = new Map<string, PendingExcelRequest>();

function getExcelWorker() {
  if (excelWorker) return excelWorker;
  excelWorker = new ExcelWorker();
  excelWorker.onmessage = (event: MessageEvent) => {
    const requestId = String(event.data?.requestId || "");
    const pending = pendingExcelRequests.get(requestId);
    if (!pending) return;
    pendingExcelRequests.delete(requestId);
    if (event.data?.success) {
      pending.resolve(event.data.result as ExcelParseResult);
    } else {
      pending.reject(
        new Error(event.data?.error || "Không thể đọc dữ liệu Excel."),
      );
    }
  };
  excelWorker.onerror = (event) => {
    const error = new Error(event.message || "Excel Worker đã dừng bất thường.");
    pendingExcelRequests.forEach(({ reject }) => reject(error));
    pendingExcelRequests.clear();
    excelWorker?.terminate();
    excelWorker = null;
  };
  return excelWorker;
}

const parseExcelInWorker = async (
  file: File,
  options: { fileId?: string; mode?: ExcelParseMode } = {},
): Promise<ExcelParseResult> => {
  const { buffer, name } = await getExcelFileBuffer(file);
  const requestId = generateUUID();
  const worker = getExcelWorker();

  return new Promise((resolve, reject) => {
    pendingExcelRequests.set(requestId, { resolve, reject });
    worker.postMessage(
      {
        requestId,
        fileBuffer: buffer,
        fileName: name,
        fileId: options.fileId,
        mode: options.mode || "auto",
      },
      [buffer],
    );
  });
};

const DEFAULT_FOLDER_URL = "https://drive.google.com/drive/folders/1gU6Hcrv94Bx_yv1qNTqH0vQNy7ElKzXJ";
const MKT_LOCAL_NORTH_URL = "https://docs.google.com/spreadsheets/d/1z7DJYJAyWqBw8IXNYbEIHhGXBMumsRA4rUHT1prBsFo/edit?gid=1119129159#gid=1119129159";

interface TimesheetSummaryPageProps {
  onBack?: () => void;
}

export default function TimesheetSummaryPage({ onBack }: TimesheetSummaryPageProps = {}) {
  const { appData, updateAppData } = useAppData();

  const [activeTab] = useState<"files">("files");
  const [fromDate] = useState("");
  const [toDate] = useState("");
  const [debouncedFromDate, setDebouncedFromDate] = useState("");
  const [debouncedToDate, setDebouncedToDate] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalSyncRows, setTotalSyncRows] = useState(0);
  const [syncedRowsCount, setSyncedRowsCount] = useState(0);
  const [showSqlDialog, setShowSqlDialog] = useState(false);

  const [isFetchingGgSheet, setIsFetchingGgSheet] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [, setRefreshKey] = useState(0);

  const handleUrlInput = async (id: string, url: string) => {
    if (!url.trim()) return;
    if (shouldSkipTimesheetSource(url)) {
      toast.info("Hệ thống tự động bỏ qua link MKT HP.");
      return;
    }
    const isFolder = url.includes("folders/") || url.includes("drive/folders/") || url.includes("?id=");

    setIsFetchingGgSheet(true);
    try {
      if (isFolder) {
        let folderId = url.trim();
        const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
        if (match) {
          folderId = match[1];
        } else {
          try {
            const urlObj = new URL(url);
            if (urlObj.searchParams.has("id")) {
              folderId = urlObj.searchParams.get("id") || folderId;
            }
          } catch { /* ignore */ }
        }

        const response = await fetch(`/api/drive-folder-files?folderId=${encodeURIComponent(folderId)}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Không thể lấy danh sách file từ thư mục. Vui lòng kiểm tra lại link hoặc quyền chia sẻ.");
        }

        const data = await response.json();
        if (!data.success || !data.files || data.files.length === 0) {
          throw new Error("Không tìm thấy file nào trong thư mục này.");
        }

        const driveFiles = (data.files || []).filter((f: Record<string, unknown>) => {
          const name = String(f.name || "").toLowerCase();
          return !name.includes("copy") && !shouldSkipTimesheetSource(
            f.name,
            f.webViewLink,
            f.url,
          );
        });

        if (driveFiles.length === 0 && data.files.length > 0) {
          throw new Error("Tất cả các file trong thư mục đều là file 'copy' nên hệ thống tự động bỏ qua.");
        }

        toast.info(`Tìm thấy ${driveFiles.length} file hợp lệ. Đang tự động đối chiếu và nạp dữ liệu...`);

        const currentInputs = [...(appData.Timesheet_InputList || [])];
        const configuredInputs = currentInputs.filter(
          (row) => !isFileNameStoredAsL07(row),
        );
        const queuedByRowId = new Map<
          string,
          {
            id: string;
            file: File;
            url: string;
            uploadDate: string;
            modifiedAt: number;
          }
        >();
        let skipCount = 0;

        for (const f of driveFiles) {
          const fileName = String(f.name || "");
          const configuredCenter = resolveTimesheetCenterFromFileName(
            fileName,
            configuredInputs,
          );
          if (!configuredCenter) {
            skipCount++;
            continue;
          }
          const rowId = configuredCenter.id;

          const sheetUrl = `https://docs.google.com/spreadsheets/d/${f.id}`;
          const fileContent = JSON.stringify({ url: sheetUrl });
          const blob = new Blob([fileContent], { type: 'application/json' });
          let name = fileName;
          if (!name.toLowerCase().endsWith(".gsheet")) {
            name = name.replace(/\.(xlsx|xls|csv)$/i, "") + ".gsheet";
          }
          const fileObj = new File([blob], name, { type: 'application/json' });
          const modifiedAt = Date.parse(String(f.modifiedTime || f.createdTime || "")) || 0;
          const modifiedDate = modifiedAt ? new Date(modifiedAt) : new Date();
          const uploadDate = modifiedDate.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const queued = queuedByRowId.get(rowId);
          if (!queued || modifiedAt >= queued.modifiedAt) {
            if (queued) skipCount++;
            queuedByRowId.set(rowId, {
              id: rowId,
              file: fileObj,
              url: `${sheetUrl}/edit`,
              uploadDate,
              modifiedAt,
            });
          } else {
            skipCount++;
          }
        }

        const toProcess = Array.from(queuedByRowId.values());
        const successCount = toProcess.length;

        if (successCount > 0) {
          // Set matched rows to a "ready" status first, but don't start processing yet
          const readyInputs = currentInputs.map(r => {
            const match = queuedByRowId.get(r.id);
            if (match) {
              return {
                ...r,
                status: "ready" as const,
                url: match.url,
                fileName: match.file.name,
                date: match.uploadDate,
              };
            }
            return r;
          });
          
          updateAppData(prev => ({ ...prev, Timesheet_InputList: readyInputs }), false);
          
          // Sequential processing with delay
          for (let i = 0; i < toProcess.length; i++) {
            const item = toProcess[i];
            
            // 1. Set individual row to processing for UI feedback
            handleUpdateRow(item.id, "status", "processing");
            
            // 2. Process the file (this includes the fetch)
            try {
              await handleUploadFile(item.id, item.file, {
                url: item.url,
                uploadDate: item.uploadDate,
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Failed to process ${item.file.name}:`, err);
              handleUpdateRow(item.id, "status", "error");
              toast.error(`Lỗi xử lý ${item.file.name}: ${msg}`);
            }
            
            // Yield briefly between files so rendering stays responsive. The
            // fetch layer already applies retry/backoff for Google rate limits.
            if (i < toProcess.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 150));
            }
          }
          
          toast.success(`Đã nạp xong từ thư mục! Thành công: ${successCount} trung tâm${skipCount > 0 ? `, Bỏ qua: ${skipCount}` : ""}.`);
        } else {
          toast.warning(`Không tìm thấy trung tâm nào khớp với các file trong thư mục.`);
        }
      } else {
        const selectedRow = inputRows.find(r => r.id === id);
        const l07 = selectedRow?.l07 || "GoogleSheet";
        
        const file = await fetchGoogleSheetAsFile(url, `${l07}_GoogleSheet.gsheet`);
        await handleUploadFile(id, file);
        toast.success(`Đã nạp dữ liệu từ link cho trung tâm ${l07}!`);
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Lỗi xử lý link";
      toast.error(msg);
    } finally {
      setIsFetchingGgSheet(false);
    }
  };

  const lastSummaryRef = useRef("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFromDate(fromDate);
      setDebouncedToDate(toDate);
    }, 500);
    return () => clearTimeout(timer);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!debouncedFromDate || !debouncedToDate) return;

    updateAppData((prev) => {
      if (
        prev.Timesheet_Dates?.from === debouncedFromDate &&
        prev.Timesheet_Dates?.to === debouncedToDate
      ) {
        return prev;
      }

      return {
        ...prev,
        Timesheet_Dates: { from: debouncedFromDate, to: debouncedToDate },
      };
    }, false);
  }, [debouncedFromDate, debouncedToDate, updateAppData]);



  const rosterData = useMemo(
    () => appData.Timesheet_Roster || [],
    [appData.Timesheet_Roster],
  );
  const salaryScaleData = useMemo(() => appData.Q_Salary_Scale || [], [appData.Q_Salary_Scale]);
  const staffData = useMemo(() => appData.Q_Staff || [], [appData.Q_Staff]);
  const cacheData = useMemo(() => appData.Q_Cache || [], [appData.Q_Cache]);
  const inputRows = useMemo(() => appData.Timesheet_InputList || [
    { id: "1", l07: "", aeCode: "", bus: "", url: "", status: "pending" },
  ], [appData.Timesheet_InputList]);

  // The North.MKT Roster source is fixed by payroll. Repair older persisted
  // rows as well, so users never need to paste the link again.
  useEffect(() => {
    const needsRepair = inputRows.some(
      (row) => String(row.l07 || "").trim().toUpperCase() === "MKT LOCAL NORTH" && row.url !== MKT_LOCAL_NORTH_URL,
    );
    if (!needsRepair) return;
    updateAppData((prev) => ({
      ...prev,
      Timesheet_InputList: (prev.Timesheet_InputList || []).map((row) =>
        String(row.l07 || "").trim().toUpperCase() === "MKT LOCAL NORTH"
          ? { ...row, url: MKT_LOCAL_NORTH_URL }
          : row,
      ),
    }), false);
  }, [inputRows, updateAppData]);

  // Repair rows created by the previous folder-import bug. Their L07 was the
  // filename itself; move the imported file/data back onto the already
  // configured center row and remove only that generated duplicate.
  useEffect(() => {
    updateAppData((prev) => {
      const rows = prev.Timesheet_InputList || [];
      const malformedRows = rows.filter(isFileNameStoredAsL07);
      if (malformedRows.length === 0) return prev;

      const validRows = rows.filter((row) => !isFileNameStoredAsL07(row));
      const replacementByTargetId = new Map<string, (typeof rows)[number]>();
      const removableIds = new Set<string>();

      malformedRows.forEach((row) => {
        if (!row.fileName) return;
        const target = resolveTimesheetCenterFromFileName(row.fileName, validRows);
        if (!target) return;
        const currentTarget = replacementByTargetId.get(target.id) || target;
        replacementByTargetId.set(target.id, {
          ...currentTarget,
          url: row.url || target.url,
          fileName: row.fileName,
          sheetName: row.sheetName || target.sheetName,
          status: row.status,
          count: row.count,
          date: row.date,
          columnMapping: row.columnMapping || target.columnMapping,
          legacyRowIds: Array.from(
            new Set([
              ...(currentTarget.legacyRowIds || []),
              row.id,
            ]),
          ),
        });
        removableIds.add(row.id);
      });

      if (removableIds.size === 0) return prev;
      const nextInputs = rows
        .filter((row) => !removableIds.has(row.id))
        .map((row) => replacementByTargetId.get(row.id) || row);

      return {
        ...prev,
        Timesheet_InputList: nextInputs,
      };
    }, false);
  }, [updateAppData]);

  const handleAddRow = () => {
    updateAppData((prev) => ({
      ...prev,
      Timesheet_InputList: [
        ...inputRows,
        {
          id: generateUUID(),
          l07: "",
          aeCode: "",
          bus: "",
          url: "",
          status: "pending",
        },
      ],
    }));
  };
  const handleUpdateRow = (
    id: string,
    field: keyof TimesheetInputRow,
    val: string | number | boolean | Record<string, unknown> | undefined,
  ) => {
    updateAppData(
      (prev) => ({
        ...prev,
        Timesheet_InputList: (prev.Timesheet_InputList || []).map((r) => {
          if (r.id === id) {
            const updated = { ...r, [field]: val };
            if (
              (field === "l07" && val === "MKT LOCAL NORTH") ||
              (field === "aeCode" && (val === "MKT LOCAL NORTH" || val === "NTW"))
            ) {
              updated.url = MKT_LOCAL_NORTH_URL;
            }
            return updated;
          }
          return r;
        }),
      }),
      false,
    );
  };
  const handleClearRow = (id: string) => {
    updateAppData((prev) => {
      const targetRow = (prev.Timesheet_InputList || []).find((r) => r.id === id);
      const ownedRowIds = new Set([id, ...(targetRow?.legacyRowIds || [])]);
      return {
        ...prev,
        Timesheet_InputList: (prev.Timesheet_InputList || []).map((r) =>
        r.id === id
          ? {
              ...r,
              url: "",
              fileName: undefined,
              sheetName: undefined,
              status: "pending",
              count: undefined,
              date: undefined,
              columnMapping: undefined,
              legacyRowIds: [],
            }
          : r,
        ),
        Timesheet_Roster: replaceTimesheetRosterRows(
          prev.Timesheet_Roster || [],
          [],
          {
            sourceRowIds: ownedRowIds,
            targetL07: targetRow?.l07,
            targetAeCode: targetRow?.aeCode,
          },
        ),
        Q_Salary_Scale: (prev.Q_Salary_Scale || []).filter(
          (r) => !ownedRowIds.has(String(r._rowId || "")),
        ),
        Q_Staff: (prev.Q_Staff || []).filter(
          (r) => !ownedRowIds.has(String(r._rowId || "")),
        ),
        Q_Cache: (prev.Q_Cache || []).filter(
          (r) => !ownedRowIds.has(String(r._rowId || "")),
        ),
      };
    });
  };
  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "Xóa dữ liệu trang Timesheet? Dữ liệu Roster đã lưu trên Supabase cũng sẽ được xóa để không tự tải ngược trở lại. Audit, Balance và Master được giữ nguyên.",
    );
    if (!confirmed) return;

    updateAppData((prev) => ({
      ...prev,
      Timesheet_InputList: (prev.Timesheet_InputList || []).map((r) => ({
        ...r,
        url: "",
        fileName: undefined,
        sheetName: undefined,
        status: "pending",
        count: undefined,
        date: undefined,
        columnMapping: undefined,
        legacyRowIds: [],
      })),
      Timesheet_Roster: [],
      Q_Salary_Scale: [],
      Q_Staff: [],
      Q_Cache: [],
      Timesheets: [],
      TA_Employee_Summary: { headers: [], data: [] },
      TA_Center_Summary: { headers: [], data: [] },
      Timesheet_Dates: { from: "", to: "" },
      Timesheet_RosterFileName: "",
      Timesheet_RosterEditHistory: [],
      Timesheet_SkipSupabaseRestore: true,
      Timesheet_LocalClearedAt: new Date().toISOString(),
    }), false);

    if (isSupabaseConfigured()) {
      try {
        await clearSupabaseRosterData();
        toast.success("Đã xóa dữ liệu Timesheet local và Roster trên Supabase; vẫn giữ danh sách center.");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Đã xóa dữ liệu local nhưng chưa xóa được Supabase: ${message}`);
      }
    } else {
      toast.success("Đã xóa toàn bộ dữ liệu Timesheet local; vẫn giữ danh sách center.");
    }
  };

  const handleClearEmptyL07 = () => {
    updateAppData((prev) => ({
      ...prev,
      Timesheet_InputList: (prev.Timesheet_InputList || []).filter(
        (r) => r.l07 && r.l07.trim() !== "",
      ),
    }));
    toast?.success("Đã xóa các dòng chưa có mã L07.");
  };

  const handleRecalculate = () => {
    setRefreshKey((prev) => prev + 1);
    toast?.success("Đã tổng hợp lại dữ liệu.");
  };

  const handleSaveData = async () => {
    updateAppData(prev => ({
      ...prev,
      updatedAt: new Date().toISOString()
    }), true);
    
    if (isSupabaseConfigured()) {
      toast.info("Đang tự động đồng bộ dữ liệu hiện tại lên Supabase...");
      await handleSyncToSupabase();
    } else {
      toast.success("Đã lưu dữ liệu hiện tại offline thành công!");
    }
  };

  const handleSyncToSupabase = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase chưa được cấu hình! Vui lòng cài đặt URL và Anon Key trong phần cấu hình.");
      return;
    }

    if (!rosterData || rosterData.length === 0) {
      toast.warning("Không có dữ liệu Roster để đồng bộ.");
      return;
    }

    setIsSyncing(true);
    setTotalSyncRows(rosterData.length);
    setSyncedRowsCount(0);
    setSyncProgress(0);

    try {
      const dataToSync = (computedData.processedRosterData && computedData.processedRosterData.length > 0) 
        ? computedData.processedRosterData 
        : rosterData;

      const { successCount, totalRows } = await syncRosterToSupabase(
        dataToSync as Record<string, unknown>[],
        (current, total) => {
          setSyncedRowsCount(current);
          setTotalSyncRows(total);
          setSyncProgress(Math.round((current / total) * 100));
        }
      );

      toast.success(`Đồng bộ thành công ${successCount.toLocaleString()}/${totalRows.toLocaleString()} dòng lên Supabase.`);
      
      updateAppData((prev: AppData) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        lastSupabaseSyncAt: new Date().toISOString(),
        Timesheet_SkipSupabaseRestore: false,
      }), true);
      toast.success("Đã tự động lưu cứng dữ liệu trên web.");
    } catch (err: unknown) {
      console.error("Supabase Sync Error:", err);
      let errMsg = err instanceof Error ? err.message : String(err);
      
      if (errMsg.includes("Failed to fetch") || errMsg.includes("fetch")) {
        errMsg = "Không thể kết nối tới Supabase (Failed to fetch). Vui lòng kiểm tra lại URL Supabase trong phần Settings và đảm bảo Project của bạn đang hoạt động (không bị tạm dừng).";
      }

      // Detailed alert as requested for debugging RLS and column issues
      alert('Lỗi Supabase: ' + errMsg);
      toast.error(`Đồng bộ thất bại: ${errMsg}`);
      if (errMsg.includes("Bảng 'roster_cham_cong' chưa tồn tại") || errMsg.includes("Thiếu cột 'charge_to_center_mkt'")) {
        setShowSqlDialog(true);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReloadFromFolder = async (id: string, l07: string) => {
    if (!l07) {
      toast.error("Không có mã L07 để tìm kiếm.");
      return;
    }

    setIsFetchingGgSheet(true);
    try {
      let folderId = "";
      const match = DEFAULT_FOLDER_URL.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (match) {
        folderId = match[1];
      }

      if (!folderId) throw new Error("Thư mục mặc định không hợp lệ.");

      const response = await fetch(`/api/drive-folder-files?folderId=${encodeURIComponent(folderId)}`);
      if (!response.ok) {
        throw new Error("Không thể lấy danh sách file từ thư mục. Vui lòng kiểm tra lại quyền truy cập.");
      }

      const data = await response.json();
      if (!data.success || !data.files || data.files.length === 0) {
        throw new Error("Không tìm thấy file nào trong thư mục.");
      }

      const driveFiles = (data.files || []).filter((f: { name?: string; webViewLink?: string; url?: string }) =>
        !String(f.name).toLowerCase().includes("copy") &&
        !shouldSkipTimesheetSource(f.name, f.webViewLink, f.url),
      );
      
      const file = driveFiles.find((f: { name?: string }) => {
        const fileL07 = getL07FromFileName(f.name || "");
        return fileL07 && fileL07.toLowerCase() === l07.toLowerCase();
      });

      if (!file) {
        toast.error(`Không tìm thấy file nào cho trung tâm ${l07} trong thư mục GDrive.`);
        return;
      }

      const url = `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
      
      // Calculate file upload/modified date
      const fileTime = file.modifiedTime || file.createdTime;
      const fileDateObj = fileTime ? new Date(fileTime) : new Date();
      const now = new Date();

      const formattedUploadDate = fileDateObj.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const isEarlierThanNow = fileDateObj.getTime() <= now.getTime();

      handleUpdateRow(id, "url", url);
      handleUpdateRow(id, "fileName", file.name);
      handleUpdateRow(id, "date", formattedUploadDate);

      let msg = `Đã tìm thấy link cho ${l07} (Upload/Cập nhật ngày ${formattedUploadDate}).`;
      if (isEarlierThanNow) {
        msg += ` Tự động đè dữ liệu mới cho ${l07} lên dữ liệu cũ để tránh trùng lặp!`;
      }
      toast.success(msg, { duration: 6000 });

      setTimeout(() => {
        handleSyncRow(id, url, formattedUploadDate);
      }, 500);

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Có lỗi xảy ra khi tìm link.";
      toast.error(errorMsg);
    } finally {
      setIsFetchingGgSheet(false);
    }
  };

  const handleSyncRow = async (id: string, urlOverride?: string, customUploadDate?: string) => {
    const row = (appData.Timesheet_InputList || []).find(r => r.id === id);
    if (!row) {
      toast.error("Không tìm thấy dòng tương ứng.");
      return;
    }
    const finalUrl = urlOverride || row.url;
    if (!finalUrl) {
      toast.error("Vui lòng nhập URL/ID Google Sheet trước.");
      return;
    }

    handleUpdateRow(id, "status", "processing");
    if (urlOverride) {
      handleUpdateRow(id, "url", urlOverride);
    }
    try {
      const file = await fetchGoogleSheetAsFile(finalUrl, row.sheetName || "Sheet1");
      if (file) {
         const parsed = await parseExcelInWorker(file, {
           fileId: id,
           mode: "roster",
         });
         const mapped = parsed.rows;
         
         const targetL07 = (row.l07 || "").trim();
         const centerInfo = targetL07 ? getCenterInfoByL07(targetL07) : null;
         const aeCode = (row.aeCode || centerInfo?.aeCode || "").trim();
         const targetL07Lower = targetL07.toLowerCase();
         const aeCodeLower = aeCode.toLowerCase();

         updateAppData((prev) => {
            const next = { ...prev };
            const currentRow = (prev.Timesheet_InputList || []).find(
              (input) => input.id === id,
            );
            const ownedRowIds = new Set([
              id,
              ...(currentRow?.legacyRowIds || []),
            ]);
            
            // Remove existing roster rows for this rowId OR for this center/aeCode to overwrite and prevent duplicate entries
            next.Timesheet_Roster = replaceTimesheetRosterRows(
              next.Timesheet_Roster || [],
              mapped,
              {
                sourceRowIds: ownedRowIds,
                targetL07: targetL07Lower,
                targetAeCode: aeCodeLower,
              },
            );
            
            const displayDate = customUploadDate || row.date || new Date().toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            const newList = (prev.Timesheet_InputList || []).map(r => 
              r.id === id ? { 
                ...r, 
                status: "success", 
                count: mapped.length, 
                date: displayDate, 
                fileName: file.name,
                url: finalUrl,
                legacyRowIds: [],
              } : r
            );
            next.Timesheet_InputList = newList;
            return next;
         }, false);
         
         toast.success(`Đã đồng bộ ${row.l07}: ${mapped.length} dòng (Đã ghi đè dữ liệu cũ).`);
      } else {
        throw new Error("Không lấy được nội dung file.");
      }
    } catch (err: unknown) {
      console.error(err);
      handleUpdateRow(id, "status", "error");
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi: ${msg}`);
      if (msg.includes("BẠN CHƯA CẤP QUYỀN")) {
        alert(msg);
      }
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    const currentInputs = appData.Timesheet_InputList || [];
    const updatedInputs = [...currentInputs];
    const toProcess: { id: string; file: File }[] = [];
    let unmatchedCount = 0;

    const filteredFiles = files.filter(
      (file) => !file.name.toLowerCase().includes("copy") && !shouldSkipTimesheetSource(file.name),
    );
    if (filteredFiles.length === 0 && files.length > 0) {
      toast.info("Tất cả các file đã chọn đều là file copy nên hệ thống tự động bỏ qua.");
      return;
    }

    for (const file of filteredFiles) {
      const configuredCenter = resolveTimesheetCenterFromFileName(
        file.name,
        updatedInputs.filter((row) => !isFileNameStoredAsL07(row)),
      );
      if (!configuredCenter) {
        unmatchedCount++;
        continue;
      }
      const matchIndex = updatedInputs.findIndex(
        (row) => row.id === configuredCenter.id,
      );

      if (matchIndex !== -1) {
        updatedInputs[matchIndex] = {
          ...updatedInputs[matchIndex],
          status: "processing",
        };
        toProcess.push({ id: updatedInputs[matchIndex].id, file });
      }
    }

    const latestFileByRow = new Map<string, { id: string; file: File }>();
    toProcess.forEach((item) => latestFileByRow.set(item.id, item));
    const queue = Array.from(latestFileByRow.values());
    if (queue.length === 0) {
      if (unmatchedCount > 0) {
        toast.warning(
          `${unmatchedCount} file không khớp danh sách L07 đã cấu hình nên không được thêm vào bảng.`,
        );
      }
      return;
    }

    type BatchResult = {
      id: string;
      file: File;
      parsed?: ExcelParseResult;
      error?: Error;
    };
    const results: BatchResult[] = [];
    setBulkUploadProgress({ current: 0, total: queue.length });

    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      try {
        const parsed = await parseExcelInWorker(item.file, {
          fileId: item.id,
          mode: "auto",
        });
        results.push({ ...item, parsed });
      } catch (error: unknown) {
        results.push({
          ...item,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      setBulkUploadProgress({ current: index + 1, total: queue.length });
    }

    updateAppData((prev) => {
      let nextRoster = prev.Timesheet_Roster || [];
      let nextSalary = prev.Q_Salary_Scale || [];
      let nextStaff = prev.Q_Staff || [];
      let nextCache = prev.Q_Cache || [];
      const statusById = new Map(
        results.map((result) => [result.id, result] as const),
      );

      results.forEach((result) => {
        const input = updatedInputs.find((row) => row.id === result.id);
        if (!result.parsed) return;
        const ownedRowIds = new Set([
          result.id,
          ...(input?.legacyRowIds || []),
        ]);
        const targetL07 = String(input?.l07 || "").trim().toLowerCase();
        const targetAe = String(input?.aeCode || "").trim().toLowerCase();

        nextRoster = replaceTimesheetRosterRows(
          nextRoster,
          result.parsed.kind === "roster" ? result.parsed.rows : [],
          {
            sourceRowIds: ownedRowIds,
            targetL07,
            targetAeCode: targetAe,
          },
        );
        nextSalary = nextSalary.filter(
          (row: Record<string, unknown>) =>
            !ownedRowIds.has(String(row._rowId || "")),
        );
        nextStaff = nextStaff.filter(
          (row: Record<string, unknown>) =>
            !ownedRowIds.has(String(row._rowId || "")),
        );
        nextCache = nextCache.filter(
          (row: Record<string, unknown>) =>
            !ownedRowIds.has(String(row._rowId || "")),
        );

        if (result.parsed.kind === "salary") {
          nextSalary = nextSalary.concat(result.parsed.rows);
        } else if (result.parsed.kind === "staff") {
          nextStaff = nextStaff.concat(result.parsed.rows);
        } else if (result.parsed.kind === "cache") {
          nextCache = nextCache.concat(result.parsed.rows);
        }
      });

      const now = new Date();
      const dateLabel = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} ${now.getDate()}/${now.getMonth() + 1}`;
      const nextInputs = updatedInputs.map((input) => {
        const result = statusById.get(input.id);
        if (!result) return input;
        const detectedL07 = getL07FromFileName(result.file.name) || "";
        const centerInfo = detectedL07
          ? getCenterInfoByL07(detectedL07)
          : null;
        return {
          ...input,
          l07: input.l07 || detectedL07,
          aeCode: input.aeCode || centerInfo?.aeCode || "",
          bus:
            input.bus ||
            centerInfo?.bus ||
            (detectedL07 ? getBusinessFromL07(detectedL07) : ""),
          status: result.error ? ("error" as const) : ("success" as const),
          count: result.parsed?.rows.length || 0,
          fileName: result.file.name,
          date: dateLabel,
          legacyRowIds: result.parsed ? [] : input.legacyRowIds,
        };
      });

      return {
        ...prev,
        Timesheet_Roster: nextRoster,
        Q_Salary_Scale: nextSalary,
        Q_Staff: nextStaff,
        Q_Cache: nextCache,
        Timesheet_InputList: nextInputs,
      };
    }, false);

    setBulkUploadProgress(null);
    const successCount = results.filter((result) => result.parsed).length;
    const errorCount = results.length - successCount;
    if (successCount > 0) {
      toast.success(`Đã xử lý ${successCount}/${results.length} file Excel.`);
    }
    if (errorCount > 0) {
      const firstError = results.find((result) => result.error)?.error?.message;
      toast.error(`${errorCount} file bị lỗi${firstError ? `: ${firstError}` : "."}`);
    }
    if (unmatchedCount > 0) {
      toast.warning(
        `Đã bỏ qua ${unmatchedCount} file không khớp danh sách L07; không tạo thêm dòng mới.`,
      );
    }
  };

  const handleUploadFile = async (
    rowId: string,
    file: File,
    sourceMetadata?: { url?: string; uploadDate?: string },
  ) => {
    if (file.name.toLowerCase().includes("copy")) {
      toast?.info(`Hệ thống tự động bỏ qua file có tên 'copy': ${file.name}`);
      return;
    }
    if (shouldSkipTimesheetSource(file.name, sourceMetadata?.url)) {
      toast?.info(`Hệ thống tự động bỏ qua nguồn MKT HP: ${file.name}`);
      return;
    }

    handleUpdateRow(rowId, "status", "processing");
    try {
      const parsed = await parseExcelInWorker(file, {
        fileId: rowId,
        mode: "auto",
      });
      const allRows = parsed.rows;

      if (allRows.length > 0) {
        updateAppData((prev) => {
          const next = { ...prev };
          
          const targetRow = (prev.Timesheet_InputList || []).find(r => r.id === rowId);
          const ownedRowIds = new Set([
            rowId,
            ...(targetRow?.legacyRowIds || []),
          ]);
          const detectedL07 = getL07FromFileName(file.name);
          const finalL07 = targetRow?.l07 || detectedL07 || "";
          const centerInfo = finalL07 ? getCenterInfoByL07(finalL07) : null;
          const targetL07Lower = finalL07.trim().toLowerCase();
          const aeCodeLower = (targetRow?.aeCode || centerInfo?.aeCode || "").trim().toLowerCase();

          next.Timesheet_Roster = replaceTimesheetRosterRows(
            next.Timesheet_Roster || [],
            parsed.kind === "roster" ? allRows : [],
            {
              sourceRowIds: ownedRowIds,
              targetL07: targetL07Lower,
              targetAeCode: aeCodeLower,
            },
          );
          next.Q_Salary_Scale = (next.Q_Salary_Scale || []).filter(
            (r: Record<string, unknown>) =>
              !ownedRowIds.has(String(r._rowId || "")),
          );
          next.Q_Staff = (next.Q_Staff || []).filter(
            (r: Record<string, unknown>) =>
              !ownedRowIds.has(String(r._rowId || "")),
          );
          next.Q_Cache = (next.Q_Cache || []).filter(
            (r: Record<string, unknown>) =>
              !ownedRowIds.has(String(r._rowId || "")),
          );

          if (parsed.kind === "salary")
            next.Q_Salary_Scale = next.Q_Salary_Scale.concat(allRows);
          else if (parsed.kind === "staff")
            next.Q_Staff = next.Q_Staff.concat(allRows);
          else if (parsed.kind === "cache")
            next.Q_Cache = next.Q_Cache.concat(allRows);

          const d = new Date();
          const bu =
            targetRow?.bus ||
            centerInfo?.bus ||
            (detectedL07 ? getBusinessFromL07(detectedL07) : "");

          next.Timesheet_InputList = (next.Timesheet_InputList || []).map((input) =>
            input.id === rowId
              ? {
                  ...input,
                  l07: input.l07 || detectedL07 || "",
                  aeCode: input.aeCode || centerInfo?.aeCode || "",
                  bus: input.bus || bu || "",
                  status: "success",
                  fileName: file.name,
                  url: sourceMetadata?.url || input.url,
                  date:
                    sourceMetadata?.uploadDate ||
                    `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")} ${d.getDate()}/${d.getMonth() + 1}`,
                  legacyRowIds: [],
                }
              : input
          );

          return next;
        }, false);

        toast?.success(`Đọc thành công ${file.name}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      const errName = file.name;
      console.error(`[TimesheetSummary] Error reading ${errName}:`, err);
      handleUpdateRow(rowId, "status", "error");
      toast?.error(
        `Lỗi đọc ${errName}: ${errMsg}`,
      );
    }
  };

  const computedData = useTimesheetCalculations(
    rosterData,
    salaryScaleData,
    staffData,
    cacheData,
    debouncedFromDate,
    debouncedToDate
  );

  useEffect(() => {
    const signature = JSON.stringify({
      emp: computedData.employeeSummary?.length || 0,
      center: computedData.centerSummary?.length || 0,
    });

    if (lastSummaryRef.current === signature) return;
    lastSummaryRef.current = signature;

    updateAppData(
      (prev: AppData) => ({
        ...prev,
        TA_Employee_Summary: {
          headers: getDynamicEmployeeColumns(rosterData).map((c) =>
            String(c.label),
          ),
          data: computedData.employeeSummary,
        },
        TA_Center_Summary: {
          headers: CENTER_COLUMNS.map((c) => c.label),
          data: computedData.centerSummary,
        },
      }),
      false,
    );
  }, [computedData.employeeSummary, computedData.centerSummary, rosterData, updateAppData]);

  const activeData = inputRows;

  const handleUploadFileA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { rows: allRows } = await parseExcelInWorker(file, { mode: "raw" });

      console.log("Parsed File A:", allRows.slice(0, 5));
      updateAppData((prev) => ({ ...prev, Q_TeacherHours: allRows }));
      toast?.success(`Tải lên File A thành công (${allRows.length} dòng)`);
      if (e.target) e.target.value = "";
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Lỗi khi đọc File A";
      toast?.error(msg);
      if (e.target) e.target.value = "";
    }
  };

  const handleExport = () => {
    if (activeData.length === 0) {
      toast?.error("Không có dữ liệu");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(prepareDataForExport(activeData));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Timesheet_Export_${activeTab}.xlsx`);
  };

  return (
    <div 
      className="page-timesheet-summary flex-1 flex flex-col min-h-0 bg-transparent m-0 gap-4 w-full h-full overflow-hidden"
      style={{
        paddingLeft: "0px",
        paddingTop: "0px",
        paddingBottom: "0px",
        paddingRight: "0px",
        borderWidth: "0px",
      }}
    >
      <button data-action="save-data" className="hidden" onClick={handleSaveData} />
      
      <input
        type="file"
        id="fileA"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleUploadFileA}
      />

      <div 
        className="bg-card flex-1 flex flex-col min-h-0 w-full relative overflow-hidden border border-border rounded-xl shadow-sm"
        style={{ paddingLeft: "0px", paddingTop: "0px", paddingBottom: "0px", paddingRight: "0px", borderWidth: "1px" }}
      >
        <div className="absolute inset-0 bg-accent/5 opacity-[0.05] pointer-events-none hidden" />

        <div
          id="timesheet-summary-header"
          className="unified-table-frame-header relative z-10 flex min-h-[56px] w-full min-w-0 shrink-0 flex-col items-stretch justify-between gap-2 bg-[var(--table-header-bg,#FAF3E8)] px-4 py-2.5 md:flex-row md:items-center border-b border-border"
        >
          {computedData?.error && (
            <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-600 p-2 text-center text-xs font-bold z-50">
              WORKER ERROR: {computedData.error}
            </div>
          )}
          {isSyncing && (
            <div className="absolute top-0 left-0 right-0 bg-secondary text-primary-foreground border-b border-none px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-50 animate-in fade-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-wider">
                    Đang đồng bộ dữ liệu lên Supabase...
                  </p>
                  <p className="text-[10px] font-bold text-foreground uppercase mt-0.5">
                    Đã lưu thành công: {syncedRowsCount.toLocaleString()} / {totalSyncRows.toLocaleString()} dòng ({syncProgress}%)
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-64 bg-accent/20 rounded-full h-2.5 overflow-hidden relative">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-2xs transition-all hover:bg-muted active:scale-95"
                title="Quay lại"
                aria-label="Quay lại bảng Timesheet"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
              <FileSpreadsheet className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base leading-5 font-bold tracking-tight text-foreground">
                Cài đặt &amp; tải file Timesheet
              </h1>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{inputRows.length || 0}</strong>
                  trung tâm
                </span>
                <span aria-hidden="true" className="text-border">•</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{computedData?.employeeSummary?.length || 0}</strong>
                  nhân sự
                </span>
                <span aria-hidden="true" className="text-border">•</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{(computedData?.processedRosterData?.length || 0).toLocaleString()}</strong>
                  bản ghi
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-end">
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    id="summary-settings-btn"
                    className="group relative z-10 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-foreground shadow-2xs transition-all hover:bg-muted active:scale-95"
                    aria-label="Mở cài đặt Timesheet"
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 group-hover:rotate-45" />
                    <span className="hidden select-none text-[10px] font-bold uppercase tracking-wide sm:inline">
                      CÀI ĐẶT
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 border border-border shadow-xl p-2 bg-card rounded-xl z-[999999]"
                >
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5">
                    CÀI ĐẶT & TIỆN ÍCH
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/60 mx-1" />

                  <DropdownMenuItem
                    onSelect={() => window.dispatchEvent(new Event("open-ui-settings"))}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-foreground transition-colors font-medium text-xs"
                  >
                    <Settings className="w-3.5 h-3.5 text-primary" />
                    <span>Cấu hình Giao diện</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border/60 mx-1" />
                  
                  <DropdownMenuItem
                    onSelect={handleAddRow}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-foreground transition-colors font-medium text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Thêm dòng trung tâm</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border/60 mx-1" />

                  <DropdownMenuItem
                    onSelect={handleClearAll}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-rose-50 text-rose-600 transition-colors font-medium text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa dữ liệu trang Timesheet</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60 mx-1" />
                  <DropdownMenuItem
                    onSelect={() => handleUrlInput(inputRows[0].id, DEFAULT_FOLDER_URL)}
                    disabled={isFetchingGgSheet}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-foreground transition-colors font-medium text-xs disabled:opacity-50"
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 text-amber-600 ${isFetchingGgSheet ? "animate-spin" : ""}`} />
                    <span>Đồng bộ Google Sheet (Folder)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60 mx-1" />
                  <DropdownMenuItem
                    onSelect={handleSyncToSupabase}
                    disabled={isSyncing}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-primary transition-colors font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>ĐỒNG BỘ LÊN SUPABASE</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/60 mx-1" />

                  <DropdownMenuItem
                    onSelect={handleExport}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-foreground transition-colors font-medium text-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    <span>Xuất Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {/* Service Account Info Card removed as requested */}


        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden p-0">
          <TimesheetInputTable
            rows={inputRows}
            onAddRow={handleAddRow}
            onUpdateRow={handleUpdateRow}
            onClearRow={handleClearRow}
            onClearAll={handleClearAll}
            onClearEmptyL07={handleClearEmptyL07}
            onUploadFile={handleUploadFile}
            onUploadFiles={handleUploadFiles}
            onUrlInput={handleUrlInput}
            onRefresh={handleRecalculate}
            onSyncRow={handleSyncRow}
            onReloadFromFolder={handleReloadFromFolder}
            isProcessing={isFetchingGgSheet || bulkUploadProgress !== null}
          />
        </div>
      </div>

      <Dialog open={showSqlDialog} onOpenChange={setShowSqlDialog}>
        <DialogContent className="max-w-2xl bg-card rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary p-8 text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-wider">Thiết lập Bảng Supabase</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 font-medium">
                Bảng 'roster_cham_cong' chưa tồn tại hoặc thiếu cột dữ liệu. Vui lòng copy script bên dưới và chạy trong SQL Editor của Supabase để cập nhật cấu trúc bảng.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8">
            <div className="relative group">
              <pre className="bg-foreground text-secondary p-6 rounded-2xl text-[10px] tabular-nums leading-relaxed overflow-x-auto max-h-[300px] border border-primary/20 shadow-inner custom-scrollbar">
                {SQL_SETUP_SCRIPT}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 right-4 bg-card/10 hover:bg-card/20 border-white/20 text-primary-foreground gap-2 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
                onClick={() => {
                  navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
                  toast.success("Đã copy script SQL!");
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                SAO CHÉP
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-foreground/50">Các bước thực hiện:</h4>
              <ol className="text-[11px] font-bold text-foreground/80 space-y-2 list-decimal pl-4">
                <li>Truy cập vào Dashboard Supabase của bạn.</li>
                <li>Chọn dự án và vào phần <span className="text-primary">SQL Editor</span>.</li>
                <li>Bấm <span className="text-primary">New Query</span> và dán nội dung script trên vào.</li>
                <li>Bấm <span className="text-primary">Run</span> để tạo bảng và cấu hình quyền truy cập (RLS).</li>
                <li>Quay lại đây và thử Đồng bộ lại.</li>
              </ol>
            </div>
          </div>
          <DialogFooter className="p-6 bg-background border-t border-border/50">
            <Button 
              onClick={() => setShowSqlDialog(false)}
              className="bg-primary hover:opacity-90 text-primary-foreground rounded-xl px-8 font-black uppercase tracking-widest text-[10px]"
            >
              Tôi đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
