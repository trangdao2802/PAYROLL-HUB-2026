/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Maximize2 } from "lucide-react";
import { formatMoneyVND } from "../../../lib/utils/data-utils";
import {
  TableInitialMark,
  TableTitleRemainder,
} from "../../../components/TableInitialMark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

interface MktLocalNorthPivotTableRow {
  business: string;
  center: string;
  chargeToCenterMkt: string;
  values: Record<string, number>;
  total: number;
  [key: string]: unknown;
}

interface MktLocalNorthPivotTableProps {
  rows: MktLocalNorthPivotTableRow[];
  types: string[];
  grandTotals: {
    totals: Record<string, number>;
    grandTotal: number;
    [key: string]: unknown;
  };
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  onCellChange?: (row: MktLocalNorthPivotTableRow, field: string, value: unknown) => void;
}

const MktLocalNorthPivotTableComponent: React.FC<MktLocalNorthPivotTableProps> = ({
  rows,
  types,
  grandTotals,
  showSidebar = true,
  onToggleSidebar,
  onCellChange,
}) => {
  const [itemsPerPage, setItemsPerPage] = useState<number | typeof Infinity>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingCell, setEditingCell] = useState<{
    rowKey: string;
    field: string;
    row: MktLocalNorthPivotTableRow;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [noColumnWidth, setNoColumnWidth] = useState(() => {
    if (typeof window === "undefined") return 64;
    const savedWidth = Number(window.localStorage.getItem("pivot_timesheet_no_width"));
    return Number.isFinite(savedWidth) && savedWidth >= 56 ? savedWidth : 64;
  });
  const cancelBlurRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem("pivot_timesheet_no_width", String(noColumnWidth));
  }, [noColumnWidth]);

  const autoFitNoColumn = () => {
    const digitCount = String(Math.max(rows.length, 1)).length;
    setNoColumnWidth(Math.max(64, Math.min(96, 42 + digitCount * 8)));
  };

  const startNoColumnResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = noColumnWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setNoColumnWidth(Math.max(56, Math.min(140, startWidth + moveEvent.clientX - startX)));
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const rowKeyOf = (row: MktLocalNorthPivotTableRow) =>
    `${row.business}||${row.chargeToCenterMkt}`;

  const startEditing = (
    row: MktLocalNorthPivotTableRow,
    field: string,
    value: unknown,
  ) => {
    if (!onCellChange) return;
    cancelBlurRef.current = false;
    setEditingCell({ rowKey: rowKeyOf(row), field, row });
    setEditValue(String(value ?? ""));
  };

  const commitEditing = () => {
    if (!editingCell || cancelBlurRef.current) {
      cancelBlurRef.current = false;
      return;
    }
    onCellChange?.(editingCell.row, editingCell.field, editValue);
    setEditingCell(null);
  };

  const cancelEditing = () => {
    cancelBlurRef.current = true;
    setEditingCell(null);
  };

  const isEditing = (row: MktLocalNorthPivotTableRow, field: string) =>
    editingCell?.rowKey === rowKeyOf(row) && editingCell.field === field;

  const editInputProps = {
    autoFocus: true,
    value: editValue,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setEditValue(event.target.value),
    onBlur: commitEditing,
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") cancelEditing();
    },
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, itemsPerPage]);

  const totalPages = itemsPerPage === Infinity ? 1 : Math.max(1, Math.ceil(rows.length / Number(itemsPerPage)));
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

  const paginatedRows = useMemo(() => {
    if (itemsPerPage === Infinity) return rows;
    const start = (validCurrentPage - 1) * Number(itemsPerPage);
    return rows.slice(start, start + Number(itemsPerPage));
  }, [rows, validCurrentPage, itemsPerPage]);

  const startIdx = itemsPerPage === Infinity ? 0 : (validCurrentPage - 1) * Number(itemsPerPage);
  const endIdx = itemsPerPage === Infinity ? rows.length : Math.min(startIdx + Number(itemsPerPage), rows.length);
  const totalTableWidth = noColumnWidth + 140 + 180 + types.length * 120 + 150;

  const businessSubtotals = useMemo(() => {
    const subtotals = new Map<string, { totals: Record<string, number>; grandTotal: number }>();
    rows.forEach((row) => {
      const business = row.business || "NORTH";
      const subtotal = subtotals.get(business) || { totals: {}, grandTotal: 0 };
      types.forEach((type) => {
        subtotal.totals[type] = (subtotal.totals[type] || 0) + (row.values[type] || 0);
      });
      subtotal.grandTotal += row.total || 0;
      subtotals.set(business, subtotal);
    });
    return subtotals;
  }, [rows, types]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent border-0">
      {/* Header Info - Consistent with other tables */}
      <div 
        className="unified-table-frame-header table-header flex min-h-[50px] w-full shrink-0 items-center justify-between border-b border-border bg-[var(--table-header-bg,#FAF3E8)] px-3.5 py-2"
      >
        <div className="flex min-w-0 items-center gap-0.5">
          {onToggleSidebar ? (
            <button
              onClick={onToggleSidebar}
              className="table-initial-toggle shrink-0 cursor-pointer transition-all active:scale-95"
              title={showSidebar ? "Ẩn Panel Sidebar" : "Hiện Panel Sidebar"}
              aria-label={showSidebar ? "Ẩn Panel Sidebar" : "Hiện Panel Sidebar"}
              aria-expanded={showSidebar}
              type="button"
            >
              <TableInitialMark label="PIVOT TIMESHEET" />
            </button>
          ) : (
            <TableInitialMark label="PIVOT TIMESHEET" className="shrink-0 text-primary" />
          )}
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold tracking-wider text-primary text-[12px] leading-snug">
              <TableTitleRemainder label="PIVOT TIMESHEET" />
            </h3>
            <p className="text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              MKT Local North cost allocation by task type and department
              {onCellChange ? " · Double-click an L07 or amount to edit" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">ROWS</span>
            <span className="text-xs font-black text-foreground">{rows.length}</span>
          </div>
          <div className="flex flex-col items-end border-l border-border/60 pl-4">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TOTAL FEES</span>
            <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
              <span className="text-xs font-black text-primary tracking-tight">{formatMoneyVND(grandTotals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pivot-table-container flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--table-data-bg,var(--card,#fff))]">
        <div className="table-body-region relative min-h-0 flex-1 overflow-auto custom-scrollbar">
          <table
            className="pivot-timesheet-table w-full border-separate border-spacing-0 bg-[var(--table-data-bg,var(--card,#fff))] text-left text-xs"
            style={{ width: "100%", minWidth: totalTableWidth }}
          >
          <colgroup>
            <col style={{ width: noColumnWidth }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 180 }} />
            {types.map((type) => <col key={`col-${type}`} />)}
            <col style={{ width: 150 }} />
          </colgroup>
          <thead className="sticky top-0 z-[110] bg-[var(--table-column-header-bg,#F4ECD8)] shadow-[0_1px_0_var(--table-border-color,#e7dbdc)]">
            <tr>
              <th
                className="pivot-timesheet-no-header relative border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-primary"
                style={{ width: noColumnWidth, minWidth: noColumnWidth, maxWidth: noColumnWidth }}
                data-column-type="text"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>No.</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      autoFitNoColumn();
                    }}
                    className="rounded p-0.5 text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    title="Auto-fit the No. column"
                    aria-label="Auto-fit the No. column"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Drag to resize the No. column"
                  className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize"
                  onMouseDown={startNoColumnResize}
                />
              </th>
              <th className="min-w-[140px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-primary">
                BUSINESS
              </th>
              <th className="min-w-[180px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-primary">
                L07
              </th>
              {types.map((type) => (
                <th key={type} className="min-w-[120px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-1 text-right text-[10px] font-bold uppercase tracking-wider text-primary">
                  {type}
                </th>
              ))}
              <th className="min-w-[150px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-1 text-right text-[10px] font-bold uppercase tracking-wider text-primary">
                GRAND TOTAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={4 + types.length} className="py-8 text-center text-muted-foreground text-xs bg-card">
                  No Pivot data available
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const business = row.business || "NORTH";
                const nextRow = rows[startIdx + idx + 1];
                const showBusinessSubtotal = !nextRow || (nextRow.business || "NORTH") !== business;
                const subtotal = businessSubtotals.get(business);

                return (
                <React.Fragment key={rowKeyOf(row)}>
                <tr className="group border-b border-border transition-colors">
                  <td
                    className="pivot-timesheet-no-cell whitespace-nowrap border-r border-b border-border px-2 py-1.5 text-center text-[10px] font-bold normal-nums text-muted-foreground transition-colors"
                    style={{ width: noColumnWidth, minWidth: noColumnWidth, maxWidth: noColumnWidth }}
                    data-column-type="text"
                  >
                    {String(startIdx + idx + 1)}
                  </td>
                  <td className="min-w-[140px] whitespace-nowrap border-r border-b border-border px-3.5 py-1.5 text-[11px] font-semibold uppercase text-foreground transition-colors">
                    {row.business || "NORTH"}
                  </td>
                  <td
                    className="min-w-[180px] whitespace-nowrap border-r border-b border-border px-3.5 py-1.5 text-[10.5px] font-medium uppercase text-muted-foreground transition-colors"
                    onDoubleClick={() => startEditing(row, "chargeToCenterMkt", row.chargeToCenterMkt)}
                    title={onCellChange ? "Double-click to edit L07" : undefined}
                  >
                    {isEditing(row, "chargeToCenterMkt") ? (
                      <input
                        {...editInputProps}
                        className="h-7 w-full min-w-[150px] rounded-md border border-primary/35 bg-white px-2 text-[11px] font-bold uppercase text-foreground outline-none ring-2 ring-primary/15"
                      />
                    ) : (
                      row.chargeToCenterMkt || "—"
                    )}
                  </td>
                  {types.map((type) => (
                    <td 
                      key={type} 
                      className={`min-w-[120px] whitespace-nowrap border-r border-b border-border px-3.5 py-1.5 text-right text-[11px] font-normal tabular-nums transition-colors ${row.values[type] ? "text-foreground" : "text-muted-foreground/40"}`}
                      onDoubleClick={() => startEditing(row, type, row.values[type] || 0)}
                      title={onCellChange ? `Double-click to edit ${type}` : undefined}
                    >
                      {isEditing(row, type) ? (
                        <input
                          {...editInputProps}
                          inputMode="decimal"
                          className="h-7 w-full min-w-[100px] rounded-md border border-primary/35 bg-white px-2 text-right text-[11px] font-bold text-foreground outline-none ring-2 ring-primary/15"
                        />
                      ) : row.values[type] ? (
                        formatMoneyVND(row.values[type]).replace(" ₫", "")
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                  <td className="min-w-[150px] whitespace-nowrap border-r border-b border-border px-3.5 py-1.5 text-right text-[11px] font-semibold tabular-nums text-foreground transition-colors">
                    {formatMoneyVND(row.total).replace(" ₫", "")}
                  </td>
                </tr>
                {showBusinessSubtotal && subtotal && (
                  <tr className="pivot-bu-subtotal-row total-row font-black uppercase tracking-wider text-[10.5px]">
                    <td
                      colSpan={3}
                      className="border-r border-b px-3.5 py-2 text-primary whitespace-nowrap"
                    >
                      {business} SUBTOTAL
                    </td>
                    {types.map((type) => (
                      <td
                        key={type}
                        className="border-r border-b px-3.5 py-2 text-right tabular-nums text-primary whitespace-nowrap min-w-[120px]"
                      >
                        {formatMoneyVND(subtotal.totals[type] || 0).replace(" ₫", "")}
                      </td>
                    ))}
                    <td className="border-r border-b px-3.5 py-2 text-right tabular-nums text-primary whitespace-nowrap min-w-[150px]">
                      {formatMoneyVND(subtotal.grandTotal).replace(" ₫", "")}
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-[var(--table-column-header-bg,#F4ECD8)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <tr className="total-row font-black uppercase tracking-wider text-[11px]">
              <td 
                colSpan={3} 
                className="min-w-[370px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-2 font-black text-primary"
              >
                GRAND TOTAL
              </td>
              {types.map((type) => (
                <td key={type} className="min-w-[120px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-2 text-right text-[11px] font-black tabular-nums text-primary">
                  {formatMoneyVND(grandTotals.totals[type] || 0).replace(" ₫", "")}
                </td>
              ))}
              <td className="min-w-[150px] whitespace-nowrap border-r border-b border-border bg-[var(--table-column-header-bg,#F4ECD8)] px-3.5 py-2 text-right text-[11px] font-black tabular-nums text-primary">
                {formatMoneyVND(grandTotals.grandTotal).replace(" ₫", "")}
              </td>
            </tr>
          </tfoot>
          </table>
        </div>
      </div>

      {/* FOOTER BAR WITH PAGE SIZE SELECTOR MATCHING SỐ GIỜ LÀM VIỆC (DATATABLE) */}
      <div 
        className="table-footer-pagination flex h-[52px] shrink-0 items-center justify-between gap-4 border-t border-border bg-[var(--table-footer-bg,var(--table-header-bg,#FAF3E8))] px-3 py-1.5 text-xs text-foreground"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              Show:
            </span>
            <Select
              value={itemsPerPage === Infinity ? "all" : String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(val === "all" ? Infinity : Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger 
                className="h-5 w-[90px] rounded-full border-border bg-card px-2.5 py-0 text-[10px] font-bold normal-case text-foreground shadow-2xs transition-colors hover:bg-muted/60"
              >
                <SelectValue placeholder="Chọn..." />
              </SelectTrigger>
              <SelectContent className="z-[99999] rounded-xl border-border bg-popover opacity-100 shadow-xl">
                <SelectItem value="10" className="cursor-pointer text-[11px] font-medium normal-case">10 dòng</SelectItem>
                <SelectItem value="20" className="cursor-pointer text-[11px] font-medium normal-case">20 dòng</SelectItem>
                <SelectItem value="50" className="cursor-pointer text-[11px] font-medium normal-case">50 dòng</SelectItem>
                <SelectItem value="100" className="cursor-pointer text-[11px] font-medium normal-case">100 dòng</SelectItem>
                <SelectItem value="all" className="cursor-pointer text-[11px] font-medium normal-case">Tất cả</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <span className="text-[11px] font-medium text-muted-foreground border-l border-border pl-3">
            {itemsPerPage === Infinity
              ? `Tổng ${rows.length} dòng`
              : rows.length === 0
                ? "0 dòng"
                : `Showing ${startIdx + 1} - ${endIdx} of ${rows.length} rows`}
          </span>
        </div>

        {/* Pagination Navigation Controls */}
        {itemsPerPage !== Infinity && totalPages > 1 && (
          <div className="flex h-6 items-center gap-1 border-l border-border pl-4">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-3xs transition-all hover:bg-muted/60 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-3xs transition-all hover:bg-muted/60 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="min-w-[90px] whitespace-nowrap px-3 text-center text-[10px] font-normal uppercase tracking-widest text-foreground/70">
              TRANG {validCurrentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-3xs transition-all hover:bg-muted/60 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              title="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-3xs transition-all hover:bg-muted/60 hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              title="Trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export const MktLocalNorthPivotTable = React.memo(MktLocalNorthPivotTableComponent);
