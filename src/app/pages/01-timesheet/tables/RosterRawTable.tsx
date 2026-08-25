/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect } from "react";
import { PanelLeft } from "lucide-react";
import { DataTable } from "../../../components/DataTable";
import { DETAIL_COLUMNS } from "../../../constants/timesheet-columns";

interface RosterRawTableProps {
  data: Record<string, unknown>[];
  onFilteredDataChange?: (data: any[]) => void;
  onCellChange?: (row: any, colKey: string, value: any) => void;
  tableRef?: any;
  onColumnFiltersChange?: (hasFilters: boolean) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onDeleteRows?: (rows: any[]) => void;
}

export function RosterRawTable({ 
  data, 
  onFilteredDataChange, 
  onCellChange,
  tableRef,
  onColumnFiltersChange,
  showSidebar,
  onToggleSidebar,
  onDeleteRows
}: RosterRawTableProps) {
  useEffect(() => {
    const handleOverlapFilter = (e: any) => {
      const { ma_nv, ngay } = e.detail;
      if (tableRef?.current && tableRef.current.setMultipleColumnFilters) {
        tableRef.current.setMultipleColumnFilters({
          ma_nv: new Set([String(ma_nv)]),
          ngay: new Set([ngay])
        });
      }
    };
    window.addEventListener("overlap-filter-requested", handleOverlapFilter);
    return () => window.removeEventListener("overlap-filter-requested", handleOverlapFilter);
  }, [tableRef]);

  const sanitizedData = data;

  const columns = useMemo(() => {
    return DETAIL_COLUMNS;
  }, []);

  const totalHours = useMemo(() => {
    return sanitizedData.reduce((sum, r) => {
      const val = Number(r.gio_lam || r.workingHours || r.totalHours || r.hours) || 0;
      return sum + val;
    }, 0);
  }, [sanitizedData]);

  return (
    <div 
      className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden"
    >
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent border-0 scroll-wrapper">
        <div 
          className="unified-table-frame-header table-header flex items-center justify-between shrink-0 w-full min-h-[50px] px-3.5 py-2 border-b border-border bg-[var(--table-header-bg,#FAF3E8)]"
        >
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="flex items-center justify-center rounded-full border border-border bg-card hover:bg-accent/10 text-foreground transition-all shadow-2xs cursor-pointer w-7 h-7 p-0 active:scale-95 shrink-0"
                title={showSidebar ? "Ẩn Panel Sidebar" : "Hiện Panel Sidebar"}
                type="button"
              >
                <PanelLeft className="w-3.5 h-3.5 text-primary" />
              </button>
            )}
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <div className="flex flex-col min-w-0">
              <h3 className="font-bold uppercase tracking-wider text-primary text-[12px] leading-snug">
                DATA TABLE FROM ROSTER FILES
              </h3>
              <p className="text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
                Dữ liệu thô trích xuất trực tiếp từ các tập tin bảng chấm công Roster tải lên
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">SỐ DÒNG</span>
              <span className="text-xs font-black text-foreground">{sanitizedData.length.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end border-l border-border/60 pl-4">
              <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TỔNG GIỜ LÀM</span>
              <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
                <span className="text-xs font-black text-primary tracking-tight">{totalHours.toLocaleString()}h</span>
              </div>
            </div>
          </div>
        </div>
        <DataTable
          ref={tableRef}
          columns={columns as any}
          data={sanitizedData as any}
          isEditable={true}
          showRowNumber={true}
          selectable={false}
          onDeleteRows={onDeleteRows}
          striped={false}
          stickyHeader={true}
          storageKey="timesheet_roster_raw"
          className="border-none"
          
          footerClassName="bg-[var(--secondary)] text-foreground font-black border-t border-border"
          showFooter={true}
          onFilteredDataChange={onFilteredDataChange}
          onColumnFiltersChange={onColumnFiltersChange}
          onCellChange={onCellChange}
          autoHideZeroSumColumns={true}
        />
      </div>
    </div>
  );
}
