import type { MissingTimesheetCenters } from "../../../hooks/useMissingTimesheetCenters";
import { TimesheetCenterCount, TimesheetCenterSettings } from "../components/TimesheetCenterCoverage";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useEffect } from "react";
import { DataTable } from "../../../components/DataTable";
import {
  TableInitialMark,
  TableTitleRemainder,
} from "../../../components/TableInitialMark";
import { DETAIL_COLUMNS } from "../../../constants/timesheet-columns";

interface RosterRawTableProps {
  centerCoverage: MissingTimesheetCenters;
  data: Record<string, unknown>[];
  calculatedRosterData?: Record<string, unknown>[];
  employeeSummary?: Record<string, unknown>[];
  employeeTotalHours?: number;
  onFilteredDataChange?: (data: any[]) => void;
  onCellChange?: (row: any, colKey: string, value: any) => void;
  tableRef?: any;
  onColumnFiltersChange?: (hasFilters: boolean) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onDeleteRows?: (rows: any[]) => void;
}

function RosterRawTableComponent({
  centerCoverage,
  data, 
  employeeSummary,
  employeeTotalHours,
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
      const { ma_nv, ngay, full_name } = e.detail || {};
      if (tableRef?.current) {
        if (tableRef.current.setIndividualOverlapFilter) {
          tableRef.current.setIndividualOverlapFilter({ ma_nv, ngay, full_name });
        } else if (tableRef.current.setMultipleColumnFilters) {
          tableRef.current.setMultipleColumnFilters({
            ma_nv: new Set([String(ma_nv)]),
            ngay: new Set([ngay])
          });
        }
      }
    };
    window.addEventListener("overlap-filter-requested", handleOverlapFilter);
    return () => window.removeEventListener("overlap-filter-requested", handleOverlapFilter);
  }, [tableRef]);

  const sanitizedData = data;

  const columns = useMemo(() => {
    return DETAIL_COLUMNS.filter(
      (c) => c.key !== "check_class" && c.key !== "check_sms"
    );
  }, []);

  const totalHours = useMemo(() => {
    if (typeof employeeTotalHours === "number") return employeeTotalHours;
    if (employeeSummary && employeeSummary.length > 0) {
      return employeeSummary.reduce(
        (sum, r) => sum + (Number((r as any).totalHours ?? (r as any).workingHours) || 0),
        0
      );
    }
    return sanitizedData.reduce((sum, r) => {
      const val = Number(r.totalHours || r.gio_lam || r.duration || r.workingHours || r.hours) || 0;
      return sum + val;
    }, 0);
  }, [employeeTotalHours, employeeSummary, sanitizedData]);

  return (
    <div 
      className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent border-0 scroll-wrapper">
        <div 
          className="unified-table-frame-header table-header flex items-center justify-between shrink-0 w-full min-h-[50px] px-3.5 py-2 border-b border-border bg-[var(--table-header-bg,#FAF3E8)]"
        >
          <div className="app-table-title-lockup min-w-0">
            <div className="app-table-title-line">
              {onToggleSidebar ? (
                <button
                  onClick={onToggleSidebar}
                  className="table-initial-toggle shrink-0 cursor-pointer transition-all active:scale-95"
                  title={showSidebar ? "Ẩn Panel Sidebar" : "Hiện Panel Sidebar"}
                  aria-label={showSidebar ? "Ẩn Panel Sidebar" : "Hiện Panel Sidebar"}
                  aria-expanded={showSidebar}
                  type="button"
                >
                  <TableInitialMark label="DATA TABLE FROM ROSTER FILES" />
                </button>
              ) : (
                <TableInitialMark label="DATA TABLE FROM ROSTER FILES" className="text-primary" />
              )}
              <h3 className="font-bold uppercase tracking-wider text-primary text-[12px] leading-snug">
                <TableTitleRemainder label="DATA TABLE FROM ROSTER FILES" />
              </h3>
            </div>
            <p className="app-table-title-meta text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              Raw rows extracted directly from uploaded Roster timesheet files
            </p>
          </div>
          <div className="flex items-center gap-4">
            <TimesheetCenterCount coverage={centerCoverage} />
            <div className="flex flex-col items-end border-l border-border/60 pl-4">
              <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TOTAL HOURS</span>
              <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
                <span className="text-xs font-black text-primary tracking-tight">{Number(totalHours.toFixed(2)).toLocaleString("vi-VN")}h</span>
              </div>
            </div>
            <TimesheetCenterSettings coverage={centerCoverage} />
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
          hideSaveStatus={true}
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

export const RosterRawTable = React.memo(RosterRawTableComponent);
