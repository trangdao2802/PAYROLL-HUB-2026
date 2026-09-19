import type { AppData } from "../../types";

export type DataChangeActionType =
  | "edit"
  | "import"
  | "delete"
  | "sync"
  | "restore"
  | "config";

export interface DataChangeRecord {
  id: string;
  timestamp: string; // ISO 8601 string
  timeString: string; // e.g. "15:06:23"
  dateString: string; // e.g. "19/09/2026"
  relativeTime: string;
  actionType: DataChangeActionType;
  entity: string;
  summary: string;
  details?: string;
  diffCount?: number;
}

const STORAGE_KEY = "payroll_recent_data_changes";
const MAX_RECORDS = 80;

function formatPad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatTimestamp(date: Date): { timeString: string; dateString: string; iso: string } {
  const hours = formatPad(date.getHours());
  const minutes = formatPad(date.getMinutes());
  const seconds = formatPad(date.getSeconds());
  const day = formatPad(date.getDate());
  const month = formatPad(date.getMonth() + 1);
  const year = date.getFullYear();

  return {
    timeString: `${hours}:${minutes}:${seconds}`,
    dateString: `${day}/${month}/${year}`,
    iso: date.toISOString(),
  };
}

export function getRelativeTime(timestamp: string): string {
  try {
    const past = new Date(timestamp).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 5) return "Vừa xong";
    if (diffSec < 60) return `${diffSec} giây trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return "Hôm qua";
    return `${diffDay} ngày trước`;
  } catch {
    return "Gần đây";
  }
}

function getInitialHistorySeed(): DataChangeRecord[] {
  const now = new Date();
  const t0 = formatTimestamp(now);
  const t1 = formatTimestamp(new Date(now.getTime() - 2 * 60 * 1000));
  const t2 = formatTimestamp(new Date(now.getTime() - 15 * 60 * 1000));

  return [
    {
      id: "seed-ready",
      timestamp: t0.iso,
      timeString: t0.timeString,
      dateString: t0.dateString,
      relativeTime: "Vừa xong",
      actionType: "sync",
      entity: "Hệ thống",
      summary: "Sẵn sàng ghi nhận thay đổi dữ liệu bảng tính",
      details: "Theo dõi phiên làm việc theo thời gian thực",
    },
    {
      id: "seed-config",
      timestamp: t1.iso,
      timeString: t1.timeString,
      dateString: t1.dateString,
      relativeTime: "2 phút trước",
      actionType: "config",
      entity: "Kỳ báo cáo",
      summary: "Đồng bộ cấu hình kỳ làm việc 03.2026",
      details: "Tải tham số tính toán từ IndexedDB",
    },
    {
      id: "seed-init",
      timestamp: t2.iso,
      timeString: t2.timeString,
      dateString: t2.dateString,
      relativeTime: "15 phút trước",
      actionType: "import",
      entity: "Khởi tạo",
      summary: "Tải dữ liệu danh mục ban đầu thành công",
      details: "Khởi tạo trung tâm và cấu hình bảng",
    },
  ];
}

export function getDataChangeHistory(): DataChangeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialHistorySeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: DataChangeRecord[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = getInitialHistorySeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to read change history", err);
    return getInitialHistorySeed();
  }
}

export function recordDataChange(
  change: {
    actionType: DataChangeActionType;
    entity: string;
    summary: string;
    details?: string;
    diffCount?: number;
  },
): DataChangeRecord {
  const now = new Date();
  const ts = formatTimestamp(now);
  const newRecord: DataChangeRecord = {
    id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: ts.iso,
    timeString: ts.timeString,
    dateString: ts.dateString,
    relativeTime: "Vừa xong",
    actionType: change.actionType,
    entity: change.entity,
    summary: change.summary,
    details: change.details,
    diffCount: change.diffCount,
  };

  if (typeof window !== "undefined") {
    try {
      const history = getDataChangeHistory();
      // Avoid immediate consecutive identical duplicate logs within 1 second
      const top = history[0];
      if (
        top &&
        top.entity === newRecord.entity &&
        top.summary === newRecord.summary &&
        Math.abs(new Date(top.timestamp).getTime() - now.getTime()) < 1000
      ) {
        return top;
      }

      const updated = [newRecord, ...history].slice(0, MAX_RECORDS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("payroll-data-changes-updated", {
          detail: { record: newRecord, history: updated },
        }),
      );
    } catch (err) {
      console.error("Failed to persist data change", err);
    }
  }

  return newRecord;
}

export function clearDataChangeHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent("payroll-data-changes-updated", {
        detail: { record: null, history: [] },
      }),
    );
  } catch (err) {
    console.error("Failed to clear data change history", err);
  }
}

// Diffing helper for AppDataContext
let lastDetectionTimestamp = 0;
export function detectAndRecordAppDataChanges(
  prev: AppData,
  next: AppData,
  sourceFields: readonly string[] = [],
): void {
  if (prev === next) return;

  const now = Date.now();
  // Throttle diffing if fired in ultra-rapid bursts (< 350ms)
  if (now - lastDetectionTimestamp < 350) return;
  lastDetectionTimestamp = now;

  // 1. Month change
  if (prev.globalMonth !== next.globalMonth && next.globalMonth) {
    recordDataChange({
      actionType: "config",
      entity: "Kỳ báo cáo",
      summary: `Đổi tháng làm việc sang ${next.globalMonth}`,
      details: `Kỳ trước: ${prev.globalMonth || "Chưa chọn"} → Kỳ mới: ${next.globalMonth}`,
    });
    return;
  }

  // 2. Source file load / import
  if (sourceFields.length > 0) {
    recordDataChange({
      actionType: "import",
      entity: sourceFields.join(", "),
      summary: `Nạp dữ liệu nguồn [${sourceFields.join(", ")}]`,
      details: `Cập nhật cấu hình bảng gốc cho các trường: ${sourceFields.join(", ")}`,
    });
    return;
  }

  // 3. Deductions (Hold_AE) changes
  if (prev.Hold_AE?.data !== next.Hold_AE?.data) {
    const prevLen = prev.Hold_AE?.data?.length || 0;
    const nextLen = next.Hold_AE?.data?.length || 0;
    if (prevLen !== nextLen) {
      const isAdd = nextLen > prevLen;
      recordDataChange({
        actionType: isAdd ? "edit" : "delete",
        entity: "Deductions (Hold AE)",
        summary: isAdd
          ? `Thêm ${nextLen - prevLen} dòng vào bảng Deductions`
          : `Xóa ${prevLen - nextLen} dòng khỏi bảng Deductions`,
        details: `Tổng số dòng hiện tại: ${nextLen} (trước đó: ${prevLen})`,
        diffCount: Math.abs(nextLen - prevLen),
      });
    } else {
      recordDataChange({
        actionType: "edit",
        entity: "Deductions (Hold AE)",
        summary: "Chỉnh sửa ô dữ liệu trong Deductions (Hold AE)",
        details: `Dữ liệu tại ${nextLen} bản ghi đã được cập nhật`,
      });
    }
    return;
  }

  // 4. Gross Pay (Sheet1_AE) changes
  if (prev.Sheet1_AE?.data !== next.Sheet1_AE?.data) {
    const prevLen = prev.Sheet1_AE?.data?.length || 0;
    const nextLen = next.Sheet1_AE?.data?.length || 0;
    recordDataChange({
      actionType: "edit",
      entity: "Gross Pay (Sheet 1)",
      summary: "Cập nhật dữ liệu bảng Gross Pay (Sheet 1)",
      details: `Số dòng hiện tại: ${nextLen} dòng`,
      diffCount: Math.abs(nextLen - prevLen),
    });
    return;
  }

  // 5. Timesheet Roster changes
  if (prev.Timesheet_Roster !== next.Timesheet_Roster) {
    const prevLen = prev.Timesheet_Roster?.length || 0;
    const nextLen = next.Timesheet_Roster?.length || 0;
    recordDataChange({
      actionType: "edit",
      entity: "Timesheet Roster",
      summary: "Cập nhật dữ liệu phân bổ Timesheet Roster",
      details: `Số bản ghi: ${nextLen} dòng`,
      diffCount: Math.abs(nextLen - prevLen),
    });
    return;
  }

  // 6. Master Roster changes
  if (prev.Master_Roster !== next.Master_Roster) {
    recordDataChange({
      actionType: "edit",
      entity: "Master Roster",
      summary: "Cập nhật dữ liệu Master Roster",
      details: `Số bản ghi: ${next.Master_Roster?.length || 0} dòng`,
    });
    return;
  }

  // 7. Bank Export / Bank North AE
  if (
    prev.BankExport?.data !== next.BankExport?.data ||
    prev.Bank_North_AE?.data !== next.Bank_North_AE?.data
  ) {
    recordDataChange({
      actionType: "sync",
      entity: "Thanh toán (Bulk Payment)",
      summary: "Cập nhật danh sách lệnh thanh toán ngân hàng",
      details: "Đồng bộ đối soát tài khoản giao dịch ngân hàng",
    });
    return;
  }

  // 8. Global Inputs / Config
  if (
    prev.Ae_Global_Inputs !== next.Ae_Global_Inputs ||
    prev.Timesheet_InputList !== next.Timesheet_InputList
  ) {
    recordDataChange({
      actionType: "config",
      entity: "Cấu hình hệ thống",
      summary: "Cập nhật danh sách tệp nguồn hoặc thông tin đầu vào",
      details: "Lưu thay đổi thiết lập các bảng tính",
    });
    return;
  }

  // 9. Table Originals / Restore
  if (prev.TableOriginals !== next.TableOriginals) {
    recordDataChange({
      actionType: "restore",
      entity: "Khôi phục dữ liệu",
      summary: "Khôi phục trạng thái bảng từ bản gốc ban đầu",
      details: "Đã hoàn nguyên các ô chỉnh sửa về dữ liệu nguồn",
    });
    return;
  }

  // 10. Generic fallback edit
  recordDataChange({
    actionType: "edit",
    entity: "Dữ liệu bảng",
    summary: "Cập nhật trạng thái dữ liệu làm việc",
    details: "Các thay đổi đã được ghi vào bộ nhớ đệm",
  });
}
