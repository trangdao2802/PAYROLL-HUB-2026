/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataTable } from "../../../components/DataTable";
import { PayrollMark } from "../../../components/PayrollMark";
import { getDynamicEmployeeColumns } from "../../../constants/timesheet-columns";
import { memo, useMemo } from "react";

interface EmployeeTableProps {
  data: Record<string, unknown>[];
  calculatedRosterData: Record<string, unknown>[];
  onFilteredDataChange?: (data: any[]) => void;
  tableRef?: any;
  onColumnFiltersChange?: (hasFilters: boolean) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onDeleteRows?: (rows: any[]) => void;
}

function EmployeeTableComponent({
  data, 
  calculatedRosterData, 
  onFilteredDataChange,
  tableRef,
  onColumnFiltersChange,
  showSidebar,
  onToggleSidebar,
  onDeleteRows
}: EmployeeTableProps) {
  const columns = useMemo(() => {
    return getDynamicEmployeeColumns(calculatedRosterData as any);
  }, [calculatedRosterData]);

  const totalHours = useMemo(() => {
    return data.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0);
  }, [data]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent border-0">
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
              <PayrollMark className="w-3.5 h-3.5 text-primary" />
            </button>
          )}
          <PayrollMark className="h-3.5 w-3.5 text-primary/75" />
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold uppercase tracking-wider text-primary text-[12px] leading-snug">
              EMPLOYEE WORKING HOURS SUMMARY
            </h3>
            <p className="text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              Summary of total working hours, overtime, and task allocations per employee
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">EMPLOYEES</span>
            <span className="text-xs font-black text-foreground">{data.length}</span>
          </div>
          <div className="flex flex-col items-end border-l border-border/60 pl-4">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TOTAL HOURS</span>
            <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
              <span className="text-xs font-black text-primary tracking-tight">{totalHours.toLocaleString()}h</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <DataTable
          ref={tableRef}
          columns={columns as any}
          data={data as any}
          isEditable={true}
          showRowNumber={true}
          selectable={false}
          onDeleteRows={onDeleteRows}
          striped={false}
          stickyHeader={true}
          storageKey="timesheet_employee"
          className="border-none"
          
          footerClassName="bg-[var(--secondary)] text-foreground font-black border-t border-border"
          showFooter={true}
          onFilteredDataChange={onFilteredDataChange}
          onColumnFiltersChange={onColumnFiltersChange}
          autoHideZeroSumColumns={true}
        />
      </div>
      </div>
    </div>
  );
}

export const EmployeeTable = memo(EmployeeTableComponent);
