import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
  value: string; // Format: "MM.YYYY"
  onChange: (value: string) => void;
  align?: "start" | "center" | "end";
}

export function MonthPicker({ value, onChange, align = "end" }: MonthPickerProps) {
  const currentYear = new Date().getFullYear();
  
  // Use state initializer function to set initial picker year based on value prop
  const getInitialYear = () => {
    if (value) {
      const parts = value.split(".");
      if (parts.length === 2) {
        const y = parseInt(parts[1], 10);
        if (!isNaN(y)) return y;
      }
    }
    return currentYear;
  };

  const [pickerYear, setPickerYear] = useState<number>(getInitialYear);
  const [open, setOpen] = useState(false);
  const [prevValue, setPrevValue] = useState<string>(value);

  // Sync state with value prop during render
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const parts = value.split(".");
      if (parts.length === 2) {
        const y = parseInt(parts[1], 10);
        if (!isNaN(y)) {
          setPickerYear(y);
        }
      }
    }
  }

  // Extract month from current selection
  const selectedMonthNum = value ? value.split(".")[0] : "";
  const selectedYearNum = value ? value.split(".")[1] : "";

  const months = [
    { label: "Jan", num: "01" },
    { label: "Feb", num: "02" },
    { label: "Mar", num: "03" },
    { label: "Apr", num: "04" },
    { label: "May", num: "05" },
    { label: "Jun", num: "06" },
    { label: "Jul", num: "07" },
    { label: "Aug", num: "08" },
    { label: "Sep", num: "09" },
    { label: "Oct", num: "10" },
    { label: "Nov", num: "11" },
    { label: "Dec", num: "12" },
  ];

  const handleSelectMonth = (monthNum: string) => {
    onChange(`${monthNum}.${pickerYear}`);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    onChange(`${mm}.${now.getFullYear()}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id="customMonthPickerTrigger"
          className="flex items-center gap-2 hover:bg-white/30 p-1.5 rounded-lg transition-all text-slate-800 text-xs font-semibold cursor-pointer relative group"
          style={{ fontFamily: "var(--font-main)" }}
        >
          <CalendarIcon className="w-4 h-4" style={{ color: "#a83e66" }} />
          <span
            className="tracking-wide"
            style={{ color: "#d67295", fontFamily: "var(--font-main)" }}
          >
            {value ? `${selectedMonthNum}/${selectedYearNum}` : "Chọn tháng"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-4 bg-popover dark:bg-[var(--card)] opacity-100 rounded-2xl shadow-xl border border-slate-200/80 z-[9999]"
        align={align}
        sideOffset={6}
      >
        {/* Dynamic header - NO raw input box/input-styled year switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <button
            onClick={() => setPickerYear((y) => y - 1)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
            title="Năm trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="text-center">
            <span className="text-sm font-bold text-slate-800 tabular-nums tracking-wider">
              Năm {pickerYear}
            </span>
          </div>

          <button
            onClick={() => setPickerYear((y) => y + 1)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
            title="Năm sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3x4 layout matching elegant style */}
        <div className="grid grid-cols-4 gap-2">
          {months.map((m) => {
            const isSelected = selectedMonthNum === m.num && selectedYearNum === String(pickerYear);
            return (
              <button
                key={m.num}
                onClick={() => handleSelectMonth(m.num)}
                className={`py-2 rounded-xl text-center text-xs font-medium tracking-tight transition-all duration-300
                  ${
                    isSelected
                      ? "bg-primary text-white font-bold shadow-md shadow-primary/20 scale-105"
                      : "text-[#705850] hover:bg-primary/10 hover:text-primary hover:scale-102"
                  }
                `}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={handleClear}
            className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50"
          >
            Xóa
          </button>
          <button
            onClick={handleThisMonth}
            className="text-[11px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-700 transition-colors py-1 px-2.5 rounded-lg hover:bg-sky-50"
          >
            Tháng này
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
