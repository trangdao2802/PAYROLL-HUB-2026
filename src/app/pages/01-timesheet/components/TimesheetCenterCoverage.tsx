import { RefreshCw, Settings } from "lucide-react";
import type { MissingTimesheetCenters } from "../../../hooks/useMissingTimesheetCenters";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

export function TimesheetCenterCount({ coverage }: { coverage: MissingTimesheetCenters }) {
  const description = coverage.centers.length
    ? `Thiếu ${coverage.centers.length}/${coverage.expectedCount} Center có File/Link: ${coverage.centers.join(", ")}`
    : "Không có Center cần đồng bộ; bỏ qua Center đã đồng bộ thành công hoặc chỉ có dữ liệu ngoài thời gian đang lọc";
  return (
    <div className="flex flex-col items-end" title={description} aria-label={description} role="status">
      <span className="text-[9px] font-bold text-foreground/60 tracking-tighter whitespace-nowrap">Center:</span>
      <span className={`text-xs font-black tabular-nums ${coverage.centers.length ? "text-destructive" : "text-foreground"}`}>
        {coverage.centers.length.toLocaleString("vi-VN")}
      </span>
    </div>
  );
}

export function TimesheetCenterSettings({ coverage }: { coverage: MissingTimesheetCenters }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Cài đặt bảng Timesheet" title="Cài đặt bảng Timesheet"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary transition-colors hover:bg-muted active:scale-[0.98]">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[99999] w-72 bg-card border-border">
        <DropdownMenuLabel>Center thiếu: {coverage.centers.length} / {coverage.expectedCount}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {coverage.centers.length > 0 && (
          <p className="max-h-28 overflow-y-auto px-2 py-1 text-xs leading-relaxed text-muted-foreground">
            {coverage.centers.join(", ")}
          </p>
        )}
        <DropdownMenuItem disabled={coverage.isRefreshing || coverage.centers.length === 0}
          onSelect={() => { void coverage.refreshMissing(); }} className="gap-2 cursor-pointer whitespace-nowrap">
          <RefreshCw className={`h-3.5 w-3.5 ${coverage.isRefreshing ? "animate-spin" : ""}`} />
          {coverage.isRefreshing ? "Đang làm mới dữ liệu link…" : "Làm mới dữ liệu link"}
        </DropdownMenuItem>
        <p className="px-2 py-1 text-xs leading-relaxed text-muted-foreground">
          Chỉ đồng bộ khi bạn bấm nút. Bỏ qua L07 đã đồng bộ thành công nhưng không có trong bảng, hoặc chỉ có dữ liệu ngoài thời gian đang lọc.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
