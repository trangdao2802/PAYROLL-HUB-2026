/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataTable } from "../../../components/DataTable";
import { PayrollMark } from "../../../components/PayrollMark";
import { CENTER_COLUMNS } from "../../../constants/timesheet-columns";
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
  const normalizeCenter = (value: unknown) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  const { centerColumns, centerRows } = useMemo(() => {
    const types = Array.from(
      new Set(
        mktLocalNorthData
          .map((row) => String(row.taskType || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, "vi"));

    const valuesByCenter = new Map<string, Record<string, number>>();
    mktLocalNorthData.forEach((row) => {
      if (String(row.overlap_check || "").startsWith("Trùng lịch")) return;
      const type = String(row.taskType || "").trim().toUpperCase();
      if (!type) return;
      const centerKey = normalizeCenter(
        row.chargeToCenterMkt || row.charge_to_center_mkt || row.l07 || row.center,
      );
      if (!centerKey) return;
      const current = valuesByCenter.get(centerKey) || {};
      const hours = Number(row.workingHours ?? row.duration) || 0;
      current[type] = (current[type] || 0) + hours * 20_000;
      valuesByCenter.set(centerKey, current);
    });

    const dynamicColumns = types.map((type) => ({
      key: `mktLocalNorth::${type}`,
      label: type,
      group: "MKT LOCAL NORTH_TIMESHEET",
      type: "currency" as const,
      width: 140,
    }));
    const staticColumns = CENTER_COLUMNS.filter(
      (column) => column.key !== "chargeMktLocal",
    );
    const totalIndex = staticColumns.findIndex(
      (column) => column.key === "totalSalary",
    );
    const columns = [...staticColumns];
    columns.splice(
      totalIndex >= 0 ? totalIndex : columns.length,
      0,
      ...dynamicColumns,
    );

    const rows = data.map((row) => {
      const centerKey = normalizeCenter(row.l07 || row.center);
      const values = valuesByCenter.get(centerKey) || {};
      const additions = Object.fromEntries(
        types.map((type) => [`mktLocalNorth::${type}`, values[type] || 0]),
      );
      return { ...row, ...additions };
    });

    return { centerColumns: columns, centerRows: rows };
  }, [data, mktLocalNorthData]);

  const totalPayment = useMemo(() => {
    return centerRows.reduce((sum, row) => sum + (Number(row.totalSalary) || 0), 0);
  }, [centerRows]);

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
              ROSTER CENTER PAYMENT SUMMARY
            </h3>
            <p className="text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              Payroll allocation by business center and task type
            </p>
          </div>
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

export const CenterTable = memo(CenterTableComponent);
