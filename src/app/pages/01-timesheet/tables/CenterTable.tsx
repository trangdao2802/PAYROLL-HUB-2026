import { buildCenterTable } from "../../../lib/utils/center-table";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataTable } from "../../../components/DataTable";
import {
  TableInitialMark,
  TableTitleRemainder,
} from "../../../components/TableInitialMark";
import { formatMoneyVND } from "../../../lib/utils/data-utils";

import { memo, useMemo } from "react";

interface CenterTableProps {
  data: Record<string, unknown>[];
  mktLocalNorthData?: Record<string, unknown>[];
  onFilteredDataChange?: (data: any[]) => void;
  tableRef?: any;
  onColumnFiltersChange?: (hasFilters: boolean) => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onDeleteRows?: (rows: any[]) => void;
}

function CenterTableComponent({
  data, 
  mktLocalNorthData = [],
  onFilteredDataChange,
  tableRef,
  onColumnFiltersChange,
  showSidebar,
  onToggleSidebar,
  onDeleteRows
}: CenterTableProps) {
  const { centerColumns, centerRows } = useMemo(() => buildCenterTable(data, mktLocalNorthData), [data, mktLocalNorthData]);


  const totalPayment = useMemo(() => {
    return centerRows.reduce(
      (sum, row) => row._isSubtotal ? sum : sum + (Number(row.totalSalary) || 0),
      0,
    );
  }, [centerRows]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent border-0">
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
                <TableInitialMark label="ROSTER CENTER PAYMENT SUMMARY" />
              </button>
            ) : (
              <TableInitialMark label="ROSTER CENTER PAYMENT SUMMARY" className="text-primary" />
            )}
            <h3 className="font-bold uppercase tracking-wider text-primary text-[12px] leading-snug">
              <TableTitleRemainder label="ROSTER CENTER PAYMENT SUMMARY" />
            </h3>
          </div>
          <p className="app-table-title-meta text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
            Payroll allocation by business center and task type
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">CENTERS</span>
            <span className="text-xs font-black text-foreground">{data.length}</span>
          </div>
          <div className="flex flex-col items-end border-l border-border/60 pl-4">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TOTAL PAYMENT</span>
            <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
              <span className="text-xs font-black text-primary tracking-tight">{formatMoneyVND(totalPayment)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <DataTable
          ref={tableRef}
          columns={centerColumns as any}
          data={centerRows as any}
          isEditable={false}
          showRowNumber={true}
          selectable={false}
          onDeleteRows={onDeleteRows}
          striped={false}
          stickyHeader={true}
          storageKey="timesheet_center"
          className="roster-center-data-table border-none"
          
          footerClassName="bg-[var(--secondary)] text-foreground font-black border-t border-border"
          showFooter={true}
          onFilteredDataChange={(rows) =>
            onFilteredDataChange?.(rows.filter((row) => !row._isSubtotal))
          }
          onColumnFiltersChange={onColumnFiltersChange}
          autoHideZeroSumColumns={true}
        />
      </div>
      </div>
    </div>
  );
}

export const CenterTable = memo(CenterTableComponent);
