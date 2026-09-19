import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Trash2,
  RefreshCw,
  Search,
  X,
  Edit3,
  UploadCloud,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Database,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  getDataChangeHistory,
  clearDataChangeHistory,
  getRelativeTime,
  type DataChangeRecord,
  type DataChangeActionType,
} from "../lib/utils/data-change-tracker";

const ACTION_CONFIGS: Record<
  DataChangeActionType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
  }
> = {
  edit: {
    label: "Chỉnh sửa",
    icon: Edit3,
    bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200/60 dark:border-blue-800/60",
  },
  import: {
    label: "Nhập file",
    icon: UploadCloud,
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/20",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200/60 dark:border-emerald-800/60",
  },
  delete: {
    label: "Xóa dòng",
    icon: Trash2,
    bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
    textClass: "text-rose-700 dark:text-rose-300",
    borderClass: "border-rose-200/60 dark:border-rose-800/60",
  },
  sync: {
    label: "Đồng bộ",
    icon: RefreshCw,
    bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200/60 dark:border-amber-800/60",
  },
  restore: {
    label: "Khôi phục",
    icon: RotateCcw,
    bgClass: "bg-cyan-500/10 dark:bg-cyan-500/20",
    textClass: "text-cyan-700 dark:text-cyan-300",
    borderClass: "border-cyan-200/60 dark:border-cyan-800/60",
  },
  config: {
    label: "Cấu hình",
    icon: Sliders,
    bgClass: "bg-purple-500/10 dark:bg-purple-500/20",
    textClass: "text-purple-700 dark:text-purple-300",
    borderClass: "border-purple-200/60 dark:border-purple-800/60",
  },
};

type FilterCategory = "all" | DataChangeActionType;

export function DataChangeHistoryToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<DataChangeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  // Sync history on mount and on storage/event trigger
  useEffect(() => {
    const refreshData = () => {
      setHistory(getDataChangeHistory());
    };

    refreshData();

    const handleDataChanged = () => {
      refreshData();
    };

    window.addEventListener("payroll-data-changes-updated", handleDataChanged);
    window.addEventListener("storage", handleDataChanged);

    // Periodic relative time update
    const interval = setInterval(refreshData, 30000);

    return () => {
      window.removeEventListener("payroll-data-changes-updated", handleDataChanged);
      window.removeEventListener("storage", handleDataChanged);
      clearInterval(interval);
    };
  }, []);

  const handleClearHistory = () => {
    clearDataChangeHistory();
    setHistory([]);
    setConfirmClear(false);
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Category filter
      if (selectedFilter !== "all" && item.actionType !== selectedFilter) {
        return false;
      }
      // Text search
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.summary.toLowerCase().includes(query) ||
        item.entity.toLowerCase().includes(query) ||
        (item.details && item.details.toLowerCase().includes(query)) ||
        item.timeString.includes(query) ||
        item.dateString.includes(query)
      );
    });
  }, [history, selectedFilter, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id="btn-nav-data-change-history"
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all outline-none active:scale-[0.98] cursor-pointer ${
            isOpen
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "border-border/80 bg-card hover:bg-muted/80 text-foreground shadow-2xs"
          }`}
          title="Lịch sử thay đổi dữ liệu gần đây"
          aria-label="Lịch sử thay đổi dữ liệu"
        >
          <History className={`w-4 h-4 ${isOpen ? "text-primary-foreground" : "text-foreground/80"}`} />
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground tabular-nums shadow-xs">
              {history.length > 99 ? "99+" : history.length}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[440px] max-w-[95vw] p-0 border border-border shadow-2xl rounded-xl z-[9999] overflow-hidden bg-card text-card-foreground"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold tracking-tight text-foreground truncate">
                  Lịch sử thay đổi gần đây
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                  {history.length} bản ghi
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                Ghi nhận các tác vụ cập nhật bảng tính và cấu hình
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {confirmClear ? (
              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2 py-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-bold transition-all shadow-xs active:scale-95"
                >
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="p-1 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground text-[10px] transition-all"
                  title="Hủy"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={history.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                title="Xóa toàn bộ lịch sử thay đổi"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[10px]">Xóa</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title="Đóng bảng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="px-3 pt-2.5 pb-2 border-b border-border/60 bg-card space-y-2">
          {/* Search box */}
          <div className="relative flex items-center w-full">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo nội dung, bảng, thời gian..."
              className="w-full h-7 pl-8 pr-7 text-xs bg-muted/40 border border-border/70 rounded-lg focus:outline-none focus:border-primary/60 focus:bg-background transition-all placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedFilter("all")}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] font-semibold transition-all cursor-pointer ${
                selectedFilter === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Tất cả ({history.length})
            </button>
            {(["edit", "import", "config", "sync", "restore"] as DataChangeActionType[]).map(
              (act) => {
                const count = history.filter((i) => i.actionType === act).length;
                const conf = ACTION_CONFIGS[act];
                const isSelected = selectedFilter === act;
                return (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setSelectedFilter(act)}
                    className={`px-2 py-0.5 rounded-full whitespace-nowrap text-[10px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {conf.label} {count > 0 ? `(${count})` : ""}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Change Entries List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 p-1">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                <Database className="w-5 h-5 opacity-50" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                {searchQuery ? "Không tìm thấy thay đổi phù hợp" : "Chưa có thay đổi nào được ghi nhận"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[260px]">
                {searchQuery
                  ? "Hãy thử tìm kiếm bằng từ khóa hoặc xóa bộ lọc"
                  : "Mọi thao tác chỉnh sửa ô, nhập file, đổi tháng hay cấu hình sẽ được lưu lại tự động tại đây"}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const conf = ACTION_CONFIGS[item.actionType] || ACTION_CONFIGS.edit;
              const ActionIcon = conf.icon;
              const relTime = getRelativeTime(item.timestamp);

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg hover:bg-muted/40 transition-colors flex items-start gap-2.5 group"
                >
                  {/* Action Icon Badge */}
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${conf.bgClass} ${conf.textClass} ${conf.borderClass}`}
                    title={conf.label}
                  >
                    <ActionIcon className="w-3 h-3" />
                  </div>

                  {/* Content Lockup */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold text-foreground uppercase tracking-wider truncate max-w-[130px]">
                          {item.entity}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-1 py-0.2 rounded border ${conf.bgClass} ${conf.textClass} ${conf.borderClass}`}
                        >
                          {conf.label}
                        </span>
                      </div>

                      {/* Timestamp lockup */}
                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                        <span
                          className="font-medium text-foreground/80 group-hover:text-primary transition-colors"
                          title={item.timestamp}
                        >
                          {relTime}
                        </span>
                        <span className="text-border">·</span>
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                          {item.timeString}
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                      {item.summary}
                    </div>

                    {/* Additional Details & Date */}
                    <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-muted-foreground/80">
                      {item.details ? (
                        <span className="truncate max-w-[280px]" title={item.details}>
                          {item.details}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="font-mono tabular-nums text-[9px] shrink-0 text-muted-foreground/60">
                        {item.dateString}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/70 bg-muted/20 text-[10px] text-muted-foreground font-medium">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Tự động đồng bộ và lưu trữ cục bộ</span>
          </div>
          <span className="font-mono tabular-nums">
            {filteredHistory.length} / {history.length} mục
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DataChangeHistoryToggle;
