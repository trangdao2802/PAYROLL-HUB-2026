/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { PanelLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil } from "lucide-react";
import { formatMoneyVND } from "../../../lib/utils/data-utils";
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

export const MktLocalNorthPivotTable: React.FC<MktLocalNorthPivotTableProps> = ({
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
  const cancelBlurRef = useRef(false);

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
        className="unified-table-frame-header table-header flex items-center justify-between shrink-0 w-full min-h-[54px] px-3.5 py-2 border-b border-border bg-[var(--table-header-bg,#FAF3E8)]"
      >
        <div className="flex items-center gap-2.5">
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
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold tracking-wider text-primary text-[12px] leading-snug">
              Pivot Timesheet
            </h3>
            <p className="text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              Bảng tổng hợp phân bổ chi phí MKT Local North theo loại công việc & bộ phận
            </p>
            {onCellChange && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-primary/65">
                <Pencil className="h-2.5 w-2.5" /> Nhấp đúp L07 hoặc số tiền để chỉnh sửa
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">SỐ DÒNG</span>
            <span className="text-xs font-black text-foreground">{rows.length}</span>
          </div>
          <div className="flex flex-col items-end border-l border-border/60 pl-4">
            <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">TỔNG PHÍ</span>
            <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
              <span className="text-xs font-black text-primary tracking-tight">{formatMoneyVND(grandTotals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative bg-card">
        <table className="w-full min-h-full border-separate border-spacing-0 font-sans text-[12px] min-w-max" style={{ borderCollapse: "separate" }}>
          <thead className="sticky top-0 z-[110] bg-muted/90 backdrop-blur-xs">
            <tr className="h-10">
              <th className="border-r border-b border-border px-2 py-2 text-center font-black uppercase tracking-wider text-foreground bg-muted/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[10px] w-12 min-w-[50px]">
                No.
              </th>
              <th className="border-r border-b border-border px-3.5 py-2 text-left font-black uppercase tracking-wider text-foreground bg-muted/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[10px] min-w-[140px] whitespace-nowrap">
                BUSINESS
              </th>
              <th className="border-r border-b border-border px-3.5 py-2 text-left font-black uppercase tracking-wider text-foreground bg-muted/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[10px] min-w-[180px] whitespace-nowrap">
                L07
              </th>
              {types.map((type) => (
                <th key={type} className="border-r border-b border-border px-3.5 py-2 text-right font-black uppercase tracking-wider text-foreground bg-muted/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[10px] min-w-[120px] whitespace-nowrap">
                  {type}
                </th>
              ))}
              <th className="border-r border-b border-border px-3.5 py-2 text-right font-black uppercase tracking-wider text-primary-foreground bg-primary shadow-[0_1px_0_rgba(0,0,0,0.05)] text-[10px] min-w-[150px] whitespace-nowrap">
                GRAND TOTAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={4 + types.length} className="py-8 text-center text-muted-foreground text-xs bg-card">
                  Chưa có dữ liệu Pivot
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
                <tr className="transition-all hover:bg-muted/40 group h-9 border-b border-border">
                  <td className="border-r border-b border-border px-2 py-1.5 text-center tabular-nums font-bold text-muted-foreground text-[10px] bg-card group-hover:bg-muted/30 transition-colors whitespace-nowrap">
                    {startIdx + idx + 1}
                  </td>
                  <td className="border-r border-b border-border px-3.5 py-1.5 font-bold text-foreground uppercase text-[11px] bg-card group-hover:bg-muted/30 transition-colors whitespace-nowrap min-w-[140px]">
                    {row.business || "NORTH"}
                  </td>
                  <td
                    className="border-r border-b border-border px-3.5 py-1.5 font-bold text-muted-foreground uppercase text-[10.5px] bg-card group-hover:bg-muted/30 transition-colors whitespace-nowrap min-w-[180px]"
                    onDoubleClick={() => startEditing(row, "chargeToCenterMkt", row.chargeToCenterMkt)}
                    title={onCellChange ? "Nhấp đúp để sửa L07" : undefined}
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
                      className={`border-r border-b border-border px-3.5 py-1.5 text-right tabular-nums text-[11px] group-hover:bg-muted/30 transition-colors whitespace-nowrap min-w-[120px] ${row.values[type] ? "text-foreground font-bold" : "text-muted-foreground/40"}`}
                      onDoubleClick={() => startEditing(row, type, row.values[type] || 0)}
                      title={onCellChange ? `Nhấp đúp để sửa ${type}` : undefined}
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
                  <td className="border-r border-b border-border px-3.5 py-1.5 text-right tabular-nums text-[11px] font-black text-foreground bg-muted/20 group-hover:bg-muted/40 transition-colors whitespace-nowrap min-w-[150px]">
                    {formatMoneyVND(row.total).replace(" ₫", "")}
                  </td>
                </tr>
                {showBusinessSubtotal && subtotal && (
                  <tr className="pivot-bu-subtotal-row h-10 font-black uppercase tracking-wider text-[10.5px]">
                    <td
                      colSpan={3}
                      className="border-r border-b px-3.5 py-2 text-primary whitespace-nowrap"
                    >
                      TỔNG BU {business}
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
          <tfoot className="sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur-xs">
            <tr className="font-black uppercase tracking-wider text-[11px] h-11">
              <td 
                colSpan={3} 
                className="border-r border-b border-border px-3.5 py-2 text-foreground font-black bg-muted/90 whitespace-nowrap min-w-[370px]"
              >
                TỔNG CỘNG (SUMMARY TOTAL)
              </td>
              {types.map((type) => (
                <td key={type} className="border-r border-b border-border px-3.5 py-2 text-right tabular-nums text-[11px] font-black text-foreground bg-muted/90 whitespace-nowrap min-w-[120px]">
                  {formatMoneyVND(grandTotals.totals[type] || 0).replace(" ₫", "")}
                </td>
              ))}
              <td className="border-r border-b border-border px-3.5 py-2 text-right tabular-nums text-[11px] font-black text-primary-foreground bg-primary whitespace-nowrap min-w-[150px]">
                {formatMoneyVND(grandTotals.grandTotal).replace(" ₫", "")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FOOTER BAR WITH PAGE SIZE SELECTOR MATCHING SỐ GIỜ LÀM VIỆC (DATATABLE) */}
      <div 
        className="px-4 py-2 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs font-sans bg-card text-foreground shrink-0"
        style={{ minHeight: "44px" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              Hiển thị:
            </span>
            <Select
              value={itemsPerPage === Infinity ? "all" : String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(val === "all" ? Infinity : Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger 
                className="rounded-[15px] px-2.5 text-[12px] font-bold text-foreground border-border bg-card hover:bg-muted/60 transition-colors shadow-2xs cursor-pointer h-7" 
                style={{ height: "28px", width: "100px" }}
              >
                <SelectValue placeholder="Chọn..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-[99999] opacity-100 shadow-xl rounded-xl">
                <SelectItem value="10" className="text-[12px] font-bold cursor-pointer">10 dòng</SelectItem>
                <SelectItem value="20" className="text-[12px] font-bold cursor-pointer">20 dòng</SelectItem>
                <SelectItem value="50" className="text-[12px] font-bold cursor-pointer">50 dòng</SelectItem>
                <SelectItem value="100" className="text-[12px] font-bold cursor-pointer">100 dòng</SelectItem>
                <SelectItem value="all" className="text-[12px] font-bold cursor-pointer">Tất cả</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <span className="text-[11px] font-medium text-muted-foreground border-l border-border pl-3">
            {itemsPerPage === Infinity
              ? `Tổng ${rows.length} dòng`
              : rows.length === 0
                ? "0 dòng"
                : `Hiển thị ${startIdx + 1} - ${endIdx} / ${rows.length} dòng`}
          </span>
        </div>

        {/* Pagination Navigation Controls */}
        {itemsPerPage !== Infinity && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-foreground"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-foreground"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-bold px-2.5 text-foreground">
              Trang {validCurrentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-foreground"
              title="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-foreground"
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
