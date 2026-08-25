/* eslint-disable @typescript-eslint/no-explicit-any */
import { formatMoneyVND } from "../../../lib/utils/data-utils";
import { useMemo, useState, useEffect } from "react";

interface MktLocalNorthTableProps {
  data: any[];
  onFilteredDataChange?: (data: any[]) => void;
}

export function MktLocalNorthTable({ data, onFilteredDataChange }: MktLocalNorthTableProps) {
  const [filters, setFilters] = useState<Record<string, string>>({
    business: "",
    chargeToCenterMkt: "",
  });

  // Logic inside TimesheetHub.tsx copied here
  const { mktPivotRows, mktPivotUniqueTypes, mktPivotGrandTotals } = useMemo(() => {
    let rows = data;

    // Apply filters
    if (filters.business) {
      const lower = filters.business.toLowerCase();
      rows = rows.filter(r => r.business && String(r.business).toLowerCase().includes(lower));
    }
    if (filters.chargeToCenterMkt) {
      const lower = filters.chargeToCenterMkt.toLowerCase();
      rows = rows.filter(r => r.chargeToCenterMkt && String(r.chargeToCenterMkt).toLowerCase().includes(lower));
    }

    const types = new Set<string>();
    rows.forEach((r: any) => {
      Object.keys(r.values || {}).forEach((t) => types.add(t));
    });
    const uniqueTypes = Array.from(types).sort();

    const grandTotals = {
      totals: {} as Record<string, number>,
      grandTotal: 0,
    };
    rows.forEach((r: any) => {
      uniqueTypes.forEach((t) => {
        const val = r.values?.[t] || 0;
        grandTotals.totals[t] = (grandTotals.totals[t] || 0) + val;
      });
      grandTotals.grandTotal += r.total || 0;
    });

    return {
      mktPivotRows: rows,
      mktPivotUniqueTypes: uniqueTypes,
      mktPivotGrandTotals: grandTotals,
    };
  }, [data, filters]);

  // Notify filtered data change
  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(mktPivotRows);
    }
  }, [mktPivotRows, onFilteredDataChange]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-card border-t border-border overflow-hidden rounded-[40px]">
      {/* Summary Ribbon */}
      <div className="px-6 py-2 bg-primary/5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between font-sans text-[13px] font-bold text-primary tracking-wider uppercase shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span>Pivot Phí MKT Local North Timesheet</span>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <span>
            SỐ DÒNG: <span className="tabular-nums text-foreground">{mktPivotRows.length}</span>
          </span>
          <span>
            LOẠI CÔNG VIỆC: <span className="tabular-nums text-foreground">{mktPivotUniqueTypes.length}</span>
          </span>
          <span className="text-accent font-extrabold bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">
            TỔNG PHÍ: {formatMoneyVND(mktPivotGrandTotals.grandTotal)}
          </span>
        </div>
      </div>

      {/* Scroll Container */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table
          style={{ borderWidth: "0px", borderRadius: "0px" }}
          className="w-full text-left border-collapse min-w-max relative bg-card font-sans text-[13px]"
        >
          <thead className="sticky top-0 z-[40] shadow-[0_1px_3px_rgba(0,0,0,0.05)] bg-muted/80">
            <tr className="bg-muted/80 text-foreground h-10 border-b border-border">
              <th
                style={{ padding: "0" }}
                className="text-xs font-black uppercase tracking-wider text-foreground text-center border-r border-border align-middle bg-muted/80 w-12"
              >
                No.
              </th>
              <th
                style={{ padding: "0" }}
                className="text-[13px] font-black uppercase tracking-wider text-foreground text-left border-r border-border align-middle bg-muted/80"
              >
                <div className="resize-x overflow-hidden w-[130px] min-w-[60px] pl-5 py-2.5 flex items-center">
                  Business
                </div>
              </th>
              {mktPivotUniqueTypes.map((type) => (
                <th
                  key={type}
                  style={{ padding: "0" }}
                  className="text-xs font-black uppercase tracking-wider text-foreground text-center border-r border-border bg-muted/80 align-middle"
                >
                  <div className="resize-x overflow-hidden w-[130px] min-w-[60px] flex justify-center items-center py-2.5 mx-auto">
                    {type}
                  </div>
                </th>
              ))}
              <th
                style={{ padding: "0" }}
                className="text-xs font-black uppercase tracking-wider text-primary-foreground text-right bg-primary align-middle border-b border-border"
              >
                <div className="resize-x overflow-hidden w-[160px] min-w-[80px] pr-5 py-2.5 flex justify-end items-center mx-auto">
                  Grand Total
                </div>
              </th>
            </tr>
            {/* Column Text Filter Row */}
            <tr className="bg-muted/40 border-b border-border">
              <th className="p-1 border-r border-border bg-muted/40 text-center text-[10px] text-muted-foreground tabular-nums">#</th>
              <th className="p-1 border-r border-border bg-muted/40">
                <div className="px-1.5 py-0.5">
                  <input
                    type="text"
                    placeholder="Lọc Business..."
                    value={filters.business}
                    onChange={(e) => setFilters(prev => ({ ...prev, business: e.target.value }))}
                    className="w-full h-7 bg-card border border-border rounded px-2 text-[10px] placeholder:text-muted-foreground font-normal focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent text-foreground transition-all shadow-sm"
                  />
                </div>
              </th>
              {mktPivotUniqueTypes.map((type) => (
                <th key={`filter-${type}`} className="p-1 border-r border-border bg-muted/40" />
              ))}
              <th className="p-1 bg-muted/40" />
            </tr>
          </thead>
          <tbody>
            {mktPivotRows.map((row, idx) => (
              <tr
                key={idx}
                className="bg-card hover:bg-muted/30 h-11 border-b border-border"
              >
                <td className="px-2 py-2.5 text-xs tabular-nums font-bold text-center text-muted-foreground border-r border-border">
                  {idx + 1}
                </td>
                <td className="px-5 py-2.5 text-[11px] font-bold text-foreground border-r border-border">
                  {row.business}
                </td>
                {mktPivotUniqueTypes.map((type) => {
                  const val = row.values[type] || 0;
                  return (
                    <td
                      key={type}
                      className={`px-5 py-2.5 text-xs tabular-nums text-center border-r border-border font-semibold bg-card ${val === 0 ? "text-transparent select-none" : "text-foreground"}`}
                    >
                      {val === 0 ? "0" : formatMoneyVND(val)}
                    </td>
                  );
                })}
                <td className="px-5 py-2.5 text-xs tabular-nums font-black text-right text-foreground bg-muted/20">
                  {row.total === 0 ? "0" : formatMoneyVND(row.total)}
                </td>
              </tr>
            ))}

          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-muted/60">
            {/* Grand Total Row */}
            <tr className="bg-muted/60 font-extrabold border-t-2 border-border h-12 text-foreground shadow-[0_-2px_6px_rgba(0,0,0,0.05)]">
              <td
                className="px-5 py-3 text-xs font-black uppercase tracking-wider text-foreground border-r border-border"
                colSpan={1}
                style={{ fontSize: "11px", lineHeight: "13.5px" }}
              >
                Tổng cộng / Grand Total
              </td>
              {mktPivotUniqueTypes.map((type) => {
                const totalVal = mktPivotGrandTotals.totals[type] || 0;
                return (
                  <td
                    key={type}
                    className="px-5 py-3 text-xs tabular-nums text-center border-r border-border text-foreground bg-muted/60 font-black"
                  >
                    {totalVal === 0 ? "0" : formatMoneyVND(totalVal)}
                  </td>
                );
              })}
              <td className="px-5 py-3 text-xs tabular-nums font-black text-right text-primary-foreground bg-primary">
                {formatMoneyVND(mktPivotGrandTotals.grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
