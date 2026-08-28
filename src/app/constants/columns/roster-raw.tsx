import React from "react";
import { Link2 } from "lucide-react";
import { formatTime12Hour } from "../../lib/utils/data-utils";
import { formatVNRobust } from "../../lib/utils/format-utils";

export const ROSTER_RAW_COLUMNS = [
  { key: "business", label: "Business", type: "text" as const, width: 100 },
  { key: "center", label: "Center/AE Code", type: "text" as const, width: 120, hidden: true },
  { key: "l07", label: "L07", type: "text" as const, width: 140 },
  { key: "chargeToCenterMkt", label: "Charge to Center MKT", type: "text" as const, width: 160, hidden: true },
  { key: "ma_nv", label: "ID Number", type: "text" as const, width: 120 },
  { key: "full_name", label: "Full Name", type: "text" as const, width: 180 },
  { key: "ngay", label: "Date", type: "date" as const, width: 100 },
  { 
    key: "type", 
    label: "Type", 
    type: "text" as const, 
    width: 120,
    render: (val: string) => {
      if (!val) return null;
      const isMkt = val.startsWith("LPAR") || val.startsWith("LRET") || val.startsWith("LDEM") || val.startsWith("LDEC") || val.startsWith("MOTH");
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight ${isMkt ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
          {val}
        </span>
      );
    }
  },
  { key: "class", label: "Class", type: "text" as const, width: 140, cellClassName: "tabular-nums text-[11px] text-slate-500" },
  { key: "gio_vao", label: "From", type: "text" as const, width: 90, cellClassName: "tabular-nums font-bold text-slate-700", render: (val: unknown) => formatTime12Hour(val) },
  { key: "gio_ra", label: "To", type: "text" as const, width: 90, cellClassName: "tabular-nums font-bold text-slate-700", render: (val: unknown) => formatTime12Hour(val) },
  { 
    key: "duration", 
    label: "Duration", 
    type: "number" as const, 
    width: 90, 
    cellClassName: "font-black text-slate-900",
    render: (val: unknown) => {
      if (val === undefined || val === null || val === "") return "";
      const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."));
      if (isNaN(num)) return String(val);
      return formatVNRobust(num, 2);
    }
  },
  { 
    key: "overlap_check", 
    label: "Check Overlap", 
    type: "text" as const, 
    width: 260,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (val: string, row: any) => {
      if (!val) return null;
      let badgeStyle = "bg-slate-100 text-slate-700 border border-slate-200";
      let isOverlap = false;
      let badgeLabel = val;
      let detailText = "";

      if (val.startsWith("Trùng lịch")) {
        badgeStyle = "bg-rose-600 text-white border border-rose-700 font-black cursor-pointer hover:bg-rose-700 transition-all shadow-2xs";
        isOverlap = true;
        badgeLabel = "TRÙNG LỊCH";
        detailText = val.replace(/^Trùng lịch:?\s*/i, "").trim();
        detailText = detailText.replace(/\s*\([L|l]ớp\s+(N\/A|NA|NaN|null|none|KHÔNG CÓ LỚP HỌC|KHÔNG CÓ LỚP)\)/gi, "");
      } else if (val.startsWith("Trùng dòng")) {
        badgeStyle = "bg-amber-600 text-white border border-amber-700 font-black cursor-pointer hover:bg-amber-700 transition-all shadow-2xs";
        isOverlap = true;
        badgeLabel = "TRÙNG DÒNG";
        detailText = val.replace(/^Trùng dòng:?\s*/i, "").trim();
      } else if (val === "Không trùng") {
        badgeStyle = "bg-emerald-50 text-emerald-700 border border-emerald-200/50 font-bold";
        badgeLabel = "KHÔNG TRÙNG";
      }

      const handleClick = (e: React.MouseEvent) => {
        if (isOverlap && row) {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent("overlap-filter-requested", {
            detail: {
              ma_nv: row.ma_nv,
              ngay: row.ngay
            }
          }));
        }
      };

      return (
        <div 
          onClick={handleClick}
          title={isOverlap ? (val + " (Click để lọc xem chi tiết các ca trùng)") : undefined}
          className="flex items-center gap-1.5 flex-wrap py-0.5 cursor-pointer max-w-full"
        >
          <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider shrink-0 ${badgeStyle}`}>
            {badgeLabel}
          </span>
          {isOverlap && row?.overlap_group && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-400/80 bg-white/80 px-1.5 py-0.5 text-[10px] font-black text-rose-800 shadow-2xs dark:bg-rose-950 dark:text-rose-100"
              title={`Các dòng cùng nhãn ${row.overlap_group} là những ca trùng lịch với nhau`}
            >
              <Link2 className="h-3 w-3" />
              {row.overlap_group} · CA {row.overlap_position}/{row.overlap_total}
            </span>
          )}
          {detailText && (
            <span className="text-[11px] font-bold text-rose-950 dark:text-rose-100 bg-rose-200/90 dark:bg-rose-900/90 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700 leading-tight">
              {detailText}
            </span>
          )}
        </div>
      );
    }
  },
  {
    key: "check_duration",
    label: "Check Duration",
    type: "text" as const,
    width: 130,
    render: (val: string) => {
      if (!val || val === "OK") return <span className="text-emerald-600 font-bold text-[10px]">OK</span>;
      return <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold text-[10px] border border-rose-100">{val}</span>;
    }
  },
  {
    key: "check_class",
    label: "Check Class",
    type: "text" as const,
    width: 100,
    render: (val: string) => {
      if (val === "TRUE" || val === "OK") return <span className="text-emerald-600 font-bold text-[10px]">TRUE</span>;
      if (val === "FALSE") return <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded font-bold text-[10px] border border-rose-100">FALSE</span>;
      return null;
    }
  },
  {
    key: "check_sms",
    label: "Check SMS",
    type: "text" as const,
    width: 110,
    render: (val: string) => {
      if (val === "OK") return <span className="text-emerald-600 font-bold text-[10px]">OK</span>;
      if (val === "Duplicate") return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold text-[10px] border border-amber-100">DUPLICATE</span>;
      return null;
    }
  },
  {
    key: "check_tutoring",
    label: "Check Tutoring",
    type: "text" as const,
    width: 120,
    render: (val: string) => {
      if (val === "OK") return <span className="text-emerald-600 font-bold text-[10px]">OK</span>;
      if (val === "Duplicate") return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold text-[10px] border border-amber-100">DUPLICATE</span>;
      return null;
    }
  },
  { 
    key: "loai", 
    label: "Category",
    type: "text" as const, 
    width: 80,
    render: (val: string) => {
      if (val === "KL") return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black text-[10px]">KL</span>;
      return <span className="text-slate-400 text-[10px]">{val}</span>;
    }
  },
  { key: "notes", label: "Notes", type: "text" as const, width: 250, cellClassName: "text-slate-800 whitespace-pre-wrap leading-relaxed font-medium" },
];
