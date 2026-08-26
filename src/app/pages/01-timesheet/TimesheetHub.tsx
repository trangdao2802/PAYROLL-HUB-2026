/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useMemo, useRef, useState, useEffect, useTransition, useCallback } from "react";
import { useLocation } from "react-router";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { useTimesheetCalculations } from "../../hooks/useTimesheetCalculations";
import { normalizeDateFilterValue, parseMoneyToNumber, prepareDataForExport } from "../../lib/utils/data-utils";
import { getBusinessFromL07, getCenterInfoByL07, mapL07 } from "../../lib/utils/center-utils";
import { useUiSettings } from "../../lib/ui-settings";
import { INITIAL_APP_DATA } from "../../constants/initial-data";
import {
  FileText,
  Users,
  Building2,
  Search,
  ChevronDown,
  XCircle,
  RefreshCw,
  SlidersHorizontal,
  Save,
  Plus,
  Check,
  Settings,
  Download,
  Cloud,
  Eye,
  Menu,
  ArrowLeft,
  RotateCcw,
  FileSpreadsheet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Copy, Clock } from "lucide-react";
import { RosterRawTable } from "./tables/RosterRawTable";
import { EmployeeTable } from "./tables/EmployeeTable";
import { CenterTable } from "./tables/CenterTable";
import { MktLocalNorthPivotTable } from "./tables/MktLocalNorthPivotTable";
import TimesheetSummaryPage from "./TimesheetSummary";
import { useNavigate } from "react-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { 
  syncRosterToSupabase, 
  syncEmployeesToSupabase, 
  syncSalaryScalesToSupabase, 
  clearSupabaseData, 
  SQL_SETUP_SCRIPT 
} from "../../lib/supabase-sync-utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { ROSTER_RAW_COLUMNS } from "../../constants/columns/roster-raw";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

function getRosterSourceKey(row: any): string {
  return String(
    row?._sourceKey ||
      row?._uuid ||
      row?._recordId ||
      row?._rowId ||
      row?.id ||
      "",
  );
}

function DebouncedSearchInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      className={className}
    />
  );
}

function parseFlexibleDateString(str: string): string | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // 1. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Check YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. Check 8-digit continuous DDMMYYYY
  if (/^\d{8}$/.test(trimmed)) {
    const day = parseInt(trimmed.slice(0, 2), 10);
    const month = parseInt(trimmed.slice(2, 4), 10);
    const year = parseInt(trimmed.slice(4, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 4. Fallback Date constructor
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return format(d, "yyyy-MM-dd");
  }

  return null;
}

interface EditableDateSelectorProps {
  label: string;
  value: string;
  onChange: (newDateStr: string) => void;
  placeholder?: string;
}

function EditableDateSelector({
  label,
  value,
  onChange,
  placeholder = "Chá»n ngÃ y",
}: EditableDateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formattedDisplay = useMemo(() => {
    if (!value) return placeholder;
    try {
      const parsed = new Date(`${value}T00:00:00`);
      if (isNaN(parsed.getTime())) return value;
      return format(parsed, "dd/MM/yyyy");
    } catch {
      return value;
    }
  }, [value, placeholder]);

  const handleStartEditing = () => {
    setIsOpen(false);
    setInputText(formattedDisplay === placeholder ? "" : formattedDisplay);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommitEdit = () => {
    if (!isEditing) return;
    setIsEditing(false);
    if (!inputText.trim()) return;

    const parsed = parseFlexibleDateString(inputText);
    if (parsed) {
      onChange(parsed);
      toast.success(`ÄÃ£ cáº­p nháº­t ${label}: ${format(new Date(`${parsed}T00:00:00`), "dd/MM/yyyy")}`);
    } else {
      toast.error(`NgÃ y "${inputText}" khÃ´ng há»£p lá»‡. Vui lÃ²ng nháº­p dáº¡ng dd/mm/yyyy (vÃ­ dá»¥: 21/06/2026)`);
    }
  };

  return (
    <div className="flex flex-col gap-1 relative">
      <div className="flex items-center justify-between">
        <span 
          className="tabular-nums text-[8px] tracking-[0.2em] uppercase text-foreground/50 leading-none"
          style={{ fontWeight: 'bold', fontSize: '10px', lineHeight: '10px' }}
        >
          {label}
        </span>
        <span className="text-[9px] text-muted-foreground/60 italic font-medium">
          (Nháº¥p Ä‘Ãºp gÃµ)
        </span>
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommitEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
          onBlur={handleCommitEdit}
          placeholder="dd/mm/yyyy"
          className="bg-card rounded-lg px-3 py-1.5 border-2 border-primary focus:outline-none w-full text-[11px] font-bold text-foreground tabular-nums shadow-xs"
        />
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStartEditing();
              }}
              title="Click 1 láº§n chá»n lá»‹ch, Nháº¥p Ä‘Ãºp 2 láº§n Ä‘á»ƒ tá»± gÃµ ngÃ y trá»±c tiáº¿p"
              className="bg-card rounded-lg border border-[rgba(61,57,53,0.08)] hover:border-accent focus:outline-none transition-all w-full flex items-center justify-between cursor-pointer select-none text-[11px] font-bold text-foreground group"
              style={{ paddingLeft: "6px", paddingRight: "6px", paddingTop: "6px", paddingBottom: "6px", height: "37.87px" }}
            >
              <span>{formattedDisplay}</span>
              <span className="text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">
                ðŸ“…
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent 
            align="start" 
            side="bottom" 
            sideOffset={6} 
            collisionPadding={12}
            className="w-auto p-1.5 z-[99999] bg-[var(--card)] opacity-100 border border-border shadow-2xl rounded-2xl"
          >
            <Calendar
              mode="single"
              selected={value ? new Date(`${value}T00:00:00`) : undefined}
              defaultMonth={value ? new Date(`${value}T00:00:00`) : undefined}
              onSelect={(d) => {
                const newDate = d ? format(d, "yyyy-MM-dd") : "";
                onChange(newDate);
                setIsOpen(false);
              }}
              className="p-1 pointer-events-auto bg-card"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

const timesheetSearchCache = new WeakMap<any, string>();

const normalizeFilterText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/Ä‘/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

let hasFetchedSupabase = false;
const pendingSupabaseTableFetches = new Map<string, Promise<any[]>>();

async function fetchAllFromSupabaseTable(tableName: string) {
  const pending = pendingSupabaseTableFetches.get(tableName);
  if (pending) return pending;

  const request = (async () => {
    const pageSize = 1000;
    const maxRows = 200000;
    const fetchPage = async (from: number, includeCount = false) => {
      const query = includeCount
        ? supabase.from(tableName).select("*", { count: "exact" })
        : supabase.from(tableName).select("*");
      const { data, error, count } = await query.range(
        from,
        from + pageSize - 1,
      );

      if (error) {
        if (
          (error as any).status === 416 ||
          error.code === "PGRST103" ||
          error.message?.includes("Range Not Satisfiable")
        ) {
          return { rows: [] as any[], count: count ?? null };
        }
        throw error;
      }
      return { rows: data || [], count: count ?? null };
    };

    const firstPage = await fetchPage(0, true);
    const allRows = [...firstPage.rows];
    if (firstPage.rows.length < pageSize) return allRows;

    const cappedTotal = Math.min(firstPage.count ?? maxRows, maxRows);
    if (firstPage.count !== null) {
      const offsets: number[] = [];
      for (let from = pageSize; from < cappedTotal; from += pageSize) {
        offsets.push(from);
      }
      // A small amount of parallelism removes one network round-trip per page
      // without flooding Supabase when the roster is exceptionally large.
      for (let index = 0; index < offsets.length; index += 6) {
        const pages = await Promise.all(
          offsets.slice(index, index + 6).map((from) => fetchPage(from)),
        );
        pages.forEach((page) => allRows.push(...page.rows));
      }
      return allRows;
    }

    // Fallback for projects where exact row counts are disabled.
    for (let from = pageSize; from < maxRows; from += pageSize) {
      const page = await fetchPage(from);
      allRows.push(...page.rows);
      if (page.rows.length < pageSize) break;
    }
    return allRows;
  })();

  pendingSupabaseTableFetches.set(tableName, request);
  try {
    return await request;
  } finally {
    pendingSupabaseTableFetches.delete(tableName);
  }
}

export function TimesheetHub() {
  const { appData, updateAppData, isHydrating } = useAppData();
  const location = useLocation();
  const uiSettings = useUiSettings();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "roster_raw" | "employee" | "center" | "mkt_local_north"
  >("employee");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const [view, setView] = useState<"final" | "upload">("final");
  const [fromDate, setFromDate] = useState(appData.Timesheet_Dates?.from || "");
  const [toDate, setToDate] = useState(appData.Timesheet_Dates?.to || "");
  const [debouncedFromDate, setDebouncedFromDate] = useState(appData.Timesheet_Dates?.from || "");
  const [debouncedToDate, setDebouncedToDate] = useState(appData.Timesheet_Dates?.to || "");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRosterCard, setShowRosterCard] = useState(true);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [showControlBar, setShowControlBar] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [totalSyncRows, setTotalSyncRows] = useState(0);
  const [syncedRowsCount, setSyncedRowsCount] = useState(0);
  const [showSqlDialog, setShowSqlDialog] = useState(false);
  

  useEffect(() => {
    if (isHydrating) return;

    const fetchRealtimeData = async () => {
      if (!isSupabaseConfigured()) {
        console.log("Supabase is not configured yet. Using local state.");
        return;
      }
      if (appData.Timesheet_SkipSupabaseRestore) {
        hasFetchedSupabase = true;
        console.log("Timesheet was explicitly cleared. Skipping automatic Supabase restore.");
        return;
      }
      if (hasFetchedSupabase) {
        console.log("Supabase data already loaded in this session. Skipping auto-fetch on tab switch.");
        return;
      }
      if (
        (appData.Timesheet_Roster && appData.Timesheet_Roster.length > 0) ||
        (appData.Q_Staff && appData.Q_Staff.length > 0)
      ) {
        console.log("Local data already exists. Skipping auto-fetch from Supabase to prevent overwriting unsynced local data.");
        hasFetchedSupabase = true;
        return;
      }
      try {
        // Fetch all data from tables
        const [dbRoster, dbStaff, dbSalary] = await Promise.all([
          fetchAllFromSupabaseTable("roster_cham_cong"),
          fetchAllFromSupabaseTable("nhan_vien"),
          fetchAllFromSupabaseTable("thang_luong"),
        ]);

        if ((dbRoster || []).length === 0 && (dbStaff || []).length === 0 && (dbSalary || []).length === 0) {
          console.log("Supabase tables are empty. Keeping initial local data so user can sync.");
          hasFetchedSupabase = true;
          return;
        }

        // Map Roster rows
        const mappedRoster = (dbRoster || []).map((row: any) => ({
          ...(row.raw_data || {}),
          _rowId: row.unique_id || `supa-r-${row.id}`,
          _uuid: row.unique_id || `supa-u-${row.id}`,
          _sourceFile: row.raw_data?._sourceFile || "Supabase_Live",
          center: row.center || row.l07 || "",
          l07: row.l07 || "",
          business: row.business || "",
          ma_nv: row.ma_nv || "",
          full_name: row.full_name || "",
          ngay: row.ngay || "",
          type: row.type || "",
          class: row.class || "",
          gio_vao: row.gio_vao || "",
          gio_ra: row.gio_ra || "",
          duration: Number(row.duration) || 0,
          notes: row.notes || "",
          employeeId: row.ma_nv || "",
          fullName: row.full_name || "",
          maAE: row.center || row.l07 || "",
          date: row.ngay || "",
          taskType: row.type || "",
          classCode: row.class || "",
          from: row.gio_vao || "",
          to: row.gio_ra || "",
          chargeToCenterMkt: row.charge_to_center_mkt || ""
        }));

        // Map Staff rows
        const mappedStaff = (dbStaff || []).map((row: any) => ({
          ...(row.raw_data || {}),
          _rowId: row.unique_id,
          employeeId: row.employee_id,
          fullName: row.full_name,
          bankAccountNumber: row.bank_account_number,
          salaryScale: row.salary_scale,
          business: row.business,
          center: row.center,
          from: row.from,
          to: row.to,
          className: row.class_name,
          noteDays: row.note_days
        }));

        // Map Salary scale rows
        const mappedSalary = (dbSalary || []).map((row: any) => ({
          ...(row.raw_data || {}),
          _rowId: row.unique_id,
          sCode: row.s_code,
          academicPrice: Number(row.academic_price) || 0,
          baseSalary: Number(row.base_salary) || 0,
          totalSalary: Number(row.total_salary) || 0,
          deductionHours: Number(row.deduction_hours) || 0
        }));

        hasFetchedSupabase = true;

        updateAppData((prev) => ({
          ...prev,
          Timesheet_Roster: mappedRoster,
          Q_Staff: mappedStaff,
          Q_Salary_Scale: mappedSalary
        }), false);

        console.log("Successfully loaded real-time data from Supabase:", {
          roster: mappedRoster.length,
          staff: mappedStaff.length,
          salary: mappedSalary.length
        });
      } catch (err) {
        console.error("Error fetching realtime Supabase data:", err);
      }
    };

    fetchRealtimeData();
  }, [isHydrating, updateAppData]);



  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleRequestTabChange = (e: any) => {
      if (e.detail && e.detail.tab) {
        if (e.detail.tab === "upload") {
          setView("upload");
        } else {
          setView("final");
          setActiveTab(e.detail.tab as any);
        }
      }
    };
    window.addEventListener("timesheet-request-tab-change", handleRequestTabChange);
    return () => window.removeEventListener("timesheet-request-tab-change", handleRequestTabChange);
  }, []);

  const [targetDate, setTargetDate] = useState("");
  const [targetCenter, setTargetCenter] = useState("");
  const [auditCascadeFilters, setAuditCascadeFilters] = useState<Record<string, string>>({});

  const activeAuditFilterEntries = useMemo(() => {
    const navigationState = location.state as any;
    const isAuditNavigation =
      navigationState?.from === "audit" ||
      navigationState?.from === "audit_applied" ||
      String(navigationState?.from || "").includes("audit");
    if (!isAuditNavigation) return [];

    const labels: Record<string, string> = {
      l07: "L07",
      center: "Center",
      class: "Class",
      ngay: "Date",
      date: "Date",
      ma_nv: "TA ID",
      full_name: "TA Name",
    };
    const entries: { key: string; label: string; value: string }[] = [];
    const seenValues = new Set<string>();
    const addEntry = (key: string, value: unknown, label?: string) => {
      const displayValue = String(value || "").trim();
      const normalizedValue = normalizeFilterText(displayValue);
      if (!displayValue || seenValues.has(normalizedValue)) return;
      seenValues.add(normalizedValue);
      entries.push({ key, label: label || labels[key] || key, value: displayValue });
    };

    Object.entries(auditCascadeFilters).forEach(([key, value]) => addEntry(key, value));
    addEntry("center", targetCenter, "Center");
    addEntry("date", targetDate, "Date");
    addEntry("keyword", searchTerm, navigationState?.filterLabel || "Keyword");
    return entries;
  }, [auditCascadeFilters, location.state, searchTerm, targetCenter, targetDate]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setTargetDate("");
    setTargetCenter("");
    setAuditCascadeFilters({});
    setFromDate("");
    setToDate("");
    setDebouncedFromDate("");
    setDebouncedToDate("");
    updateAppData((prev) => ({
      ...prev,
      Timesheet_Dates: { from: "", to: "" },
    }), false);
    navigate(location.pathname, {
      replace: true,
      state: { from: "cleared" },
    });
    if (tableRef.current) {
      tableRef.current.clearAllFilters();
    }
  }, [navigate, location.pathname, updateAppData]);

  const handleResetDateFilter = useCallback(() => {
    startTransition(() => {
      setFromDate("");
      setToDate("");
      setDebouncedFromDate("");
      setDebouncedToDate("");
      setTargetDate("");
      setTargetCenter("");
      setAuditCascadeFilters({});
    });
    updateAppData((prev) => ({
      ...prev,
      Timesheet_Dates: { from: "", to: "" },
    }), false);
    toast.success("ÄÃ£ há»§y lá»c thá»i gian (Äang hiá»ƒn thá»‹ toÃ n bá»™ dá»¯ liá»‡u)");
  }, [updateAppData]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Remove effect syncing globalMonth down to local selectedMonth
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFromDate(fromDate);
      setDebouncedToDate(toDate);
    }, 180);
    return () => clearTimeout(timer);
  }, [fromDate, toDate]);

  useEffect(() => {
    const handleResetAllFiltersEvent = () => {
      handleClearFilters();
    };
    window.addEventListener("reset-all-filters", handleResetAllFiltersEvent);
    return () => {
      window.removeEventListener("reset-all-filters", handleResetAllFiltersEvent);
    };
  }, [handleClearFilters]);

  useEffect(() => {
    updateAppData((prev) => {
      if (
        prev.Timesheet_Dates?.from === debouncedFromDate &&
        prev.Timesheet_Dates?.to === debouncedToDate
      ) {
        return prev;
      }

      return {
        ...prev,
        Timesheet_Dates: { from: debouncedFromDate, to: debouncedToDate },
      };
    }, false);
  }, [debouncedFromDate, debouncedToDate, updateAppData]);

  const calculatedRosterData = useMemo(
    () => (isHydrating ? [] : appData.Timesheet_Roster || []),
    [appData.Timesheet_Roster, isHydrating],
  );
  const calculatedSalaryScaleData = useMemo(() => (isHydrating ? [] : appData.Q_Salary_Scale || []), [appData.Q_Salary_Scale, isHydrating]);
  const calculatedStaffData = useMemo(() => (isHydrating ? [] : appData.Q_Staff || []), [appData.Q_Staff, isHydrating]);
  const calculatedCacheData = useMemo(() => (isHydrating ? [] : appData.Q_Cache || []), [appData.Q_Cache, isHydrating]);

  const { processedRosterData, employeeSummary, centerSummary, isCalculating } =
    useTimesheetCalculations(
      calculatedRosterData,
      calculatedSalaryScaleData,
      calculatedStaffData,
      calculatedCacheData,
      debouncedFromDate,
      debouncedToDate,
    );

  const tabs = useMemo(
    () =>
      [
        { id: "employee", label: "Total Paid Hours", icon: Users },
        { id: "center", label: "Roster Center", icon: Building2 },
        { id: "mkt_local_north", label: "Pivot Timesheet", icon: FileText },
        { id: "roster_raw", label: "Raw Data", icon: FileText },
      ] as const,
    [],
  );

  useEffect(() => {
    const tabId = view === "upload" ? "upload" : activeTab;
    const label = tabId === "upload" ? "Settings & Upload (Timesheet)" : (tabs.find((t) => t.id === activeTab)?.label || "Timesheet Overview");
    const event = new CustomEvent("timesheet-tab-changed", { detail: { label, tab: tabId } });
    window.dispatchEvent(event);
  }, [activeTab, view, tabs]);

  const mktLocalNorthData = useMemo(() => {
    if (activeTab !== "center" && activeTab !== "mkt_local_north") return [];
    return processedRosterData.filter((r: any) => {
      const cUpper = String(r.center || "").toUpperCase();
      const l07Upper = String(r.l07 || "").toUpperCase();
      const bankUpper = String(r.bank || r.bankName || "").toUpperCase();
      const chargeMktUpper = String(r.chargeToCenterMkt || r.charge_to_center_mkt || "").toUpperCase();
      const srcUpper = String(r._sourceFile || "").toUpperCase();
      const isMktNorth = cUpper === "MKT LOCAL NORTH" || cUpper.startsWith("MKT LOCAL NORTH_") ||
                         l07Upper === "MKT LOCAL NORTH" || l07Upper.startsWith("MKT LOCAL NORTH_") ||
                         bankUpper === "MKT LOCAL NORTH" || bankUpper.startsWith("MKT LOCAL NORTH_") ||
                         chargeMktUpper === "MKT LOCAL NORTH" || chargeMktUpper.startsWith("MKT LOCAL NORTH_") ||
                         srcUpper.includes("MKT LOCAL NORTH") || srcUpper.includes("MKT_LOCAL_NORTH");
      // Pháº£i loáº¡i bá» cÃ¡c ca trÃ¹ng lá»‹ch (overlap) khá»i báº£ng Pivot
      return isMktNorth && !String(r.overlap_check || "").startsWith("TrÃ¹ng lá»‹ch");
    });
  }, [activeTab, processedRosterData]);

  const currentData = useMemo(() => {
    if (activeTab === "roster_raw") return processedRosterData;
    if (activeTab === "employee") return employeeSummary;
    if (activeTab === "center") return centerSummary;
    if (activeTab === "mkt_local_north") return mktLocalNorthData;
    return [];
  }, [activeTab, processedRosterData, employeeSummary, centerSummary, mktLocalNorthData]);

  const rosterMetrics = useMemo(() => {
    let unpaidRows = 0;
    let totalDuration = 0;
    for (const row of calculatedRosterData) {
      if (row.loai === "KL") unpaidRows += 1;
      totalDuration += Number(row.duration) || 0;
    }
    return { unpaidRows, totalDuration };
  }, [calculatedRosterData]);

  const searchData = useMemo(() => {
    let data = currentData;

    const cascadeEntries = Object.entries(auditCascadeFilters).filter(([, value]) => value);
    if (targetDate || targetCenter || cascadeEntries.length > 0) {
      const normalizedTargetDate = normalizeDateFilterValue(targetDate);
      const normalizedTargetCenter = normalizeFilterText(targetCenter);

      data = data.filter((row: any) => {
        const rowDate = normalizeDateFilterValue(row.ngay ?? row.date);
        const rowL07 = normalizeFilterText(row.l07);
        const rowCenterCode = normalizeFilterText(row.center);

        if (normalizedTargetDate && rowDate !== normalizedTargetDate) return false;
        if (normalizedTargetCenter && rowL07 !== normalizedTargetCenter && rowCenterCode !== normalizedTargetCenter) return false;

        for (const [key, expected] of cascadeEntries) {
          if (key === "ngay" || key === "date") {
            if (rowDate !== normalizeDateFilterValue(expected)) return false;
            continue;
          }
          if (key === "l07" || key === "center") {
            const normalizedExpected = normalizeFilterText(expected);
            if (rowL07 !== normalizedExpected && rowCenterCode !== normalizedExpected) return false;
            continue;
          }
          if (key === "class") {
            if (normalizeFilterText(row.class ?? row.classCode) !== normalizeFilterText(expected)) return false;
            continue;
          }
          if (key === "ma_nv") {
            const actualId = normalizeFilterText(row.ma_nv ?? row.employeeId).replace(/^0+/, "");
            const expectedId = normalizeFilterText(expected).replace(/^0+/, "");
            if (actualId !== expectedId) return false;
            continue;
          }
          if (key === "full_name") {
            if (normalizeFilterText(row.full_name ?? row.fullName) !== normalizeFilterText(expected)) return false;
            continue;
          }
          if (normalizeFilterText(row[key]) !== normalizeFilterText(expected)) return false;
        }
        return true;
      });
    }

    if (debouncedSearchTerm) {
      const lowerSearch = normalizeFilterText(debouncedSearchTerm);
      const lowerSearchTrimmedZero = lowerSearch.replace(/^0+/, "");

      // Check if this search term is already strictly satisfied by cascadeFilters
      const isSearchInCascade = cascadeEntries.some(([, val]) => {
        const normVal = normalizeFilterText(val);
        return normVal && (normVal === lowerSearch || normVal.replace(/^0+/, "") === lowerSearchTrimmedZero);
      });

      if (!isSearchInCascade) {
        const searchCache = timesheetSearchCache;

        data = data.filter((row: any) => {
          // Use precomputed _searchStr if available
          let rowSearchStr = typeof row._searchStr === "string"
            ? row._searchStr
            : searchCache.get(row);
          
          if (rowSearchStr !== undefined) {
            if (rowSearchStr.includes(lowerSearch)) return true;
            if (lowerSearchTrimmedZero && rowSearchStr.includes(lowerSearchTrimmedZero)) return true;
            return false;
          }

          rowSearchStr = "";
          
          // Optimize search to only search in keys that might be displayed
          for (const [key, value] of Object.entries(row)) {
            if (value == null) continue;
            if (typeof value === "string" || typeof value === "number") {
              rowSearchStr += `|${normalizeFilterText(value)}`;
            }
          }
          
          // Cache it for future filtering
          searchCache.set(row, rowSearchStr);

          return rowSearchStr.includes(lowerSearch) || (lowerSearchTrimmedZero ? rowSearchStr.includes(lowerSearchTrimmedZero) : false);
        });
      }
    }

    return data;
  }, [currentData, debouncedSearchTerm, targetDate, targetCenter, auditCascadeFilters]);

  // Handle deep linking and navigation resets
  useEffect(() => {
    const state = location.state as any;
    if (state && state.from === "audit") {
      // Apply filters
      if (state.activeTab) setActiveTab(state.activeTab);

      const cascade = state.cascadeFilters as Record<string, string> | undefined;

      if (cascade && Object.keys(cascade).length > 0) {
        setAuditCascadeFilters(cascade);
        // Set top bar control values
        if (cascade["l07"]) {
          setTargetCenter(cascade["l07"]);
        } else if (state.filterCenter) {
          setTargetCenter(state.filterCenter);
        } else {
          setTargetCenter("");
        }

        if (cascade["ngay"]) {
          setTargetDate(cascade["ngay"]);
        } else if (state.filterDate) {
          setTargetDate(state.filterDate);
        } else {
          setTargetDate("");
        }

        // Set KEYWORD input search term in top card
        const keywordVal =
          state.filterValue ||
          state.searchTerm ||
          cascade["class"] ||
          cascade["ma_nv"] ||
          cascade["full_name"] ||
          "";
        setSearchTerm(keywordVal);
        setDebouncedSearchTerm(keywordVal);

      } else {
        setAuditCascadeFilters({});
        const filterCol = state.filterColumn;
        const filterVal = state.filterValue;

        if (filterCol && filterVal) {
          if (filterCol === "ngay") {
            setTargetDate(filterVal);
            setTargetCenter("");
            setSearchTerm("");
            setDebouncedSearchTerm("");
          } else if (filterCol === "l07" || filterCol === "center") {
            setTargetCenter(filterVal);
            setTargetDate("");
            setSearchTerm("");
            setDebouncedSearchTerm("");
          } else {
            setTargetDate("");
            setTargetCenter("");
            setSearchTerm(filterVal);
            setDebouncedSearchTerm(filterVal);
          }
        } else {
          if (state.searchTerm) {
            setSearchTerm(state.searchTerm);
            setDebouncedSearchTerm(state.searchTerm);
          } else {
            setSearchTerm("");
            setDebouncedSearchTerm("");
          }
          if (state.filterDate) setTargetDate(state.filterDate);
          else setTargetDate("");
          if (state.filterCenter) setTargetCenter(state.filterCenter);
          else setTargetCenter("");
        }

      }

      // Scroll to the table after a brief delay to ensure rendering
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      // Clear location state but DO NOT trigger cleanup
      navigate(location.pathname, {
        replace: true,
        state: { ...state, from: "audit_applied" },
      });
    }
  }, [location.state, navigate, location.pathname]);

  // Separate effect for clearing filters when navigating NOT from audit
  useEffect(() => {
    const state = location.state as any;
    // Only clear if the user manually changed the URL, not because we cleared the state internally
    if (
      !state ||
      (state.from !== "audit" &&
        state.from !== "audit_applied" &&
        state.from !== "cleared" &&
        !state.activeTab)
    ) {
      handleClearFilters();
      setActiveTab("roster_raw");
      setView("final");
    }
  }, [location.state, handleClearFilters]);

  // 1. Get unique non-empty type values for Pivot Table columns (excluding empty key values as requested)
  const mktPivotUniqueTypes = useMemo(() => {
    if (activeTab !== "mkt_local_north") return [];
    const typesSet = new Set<string>();
    searchData.forEach((r: any) => {
      const type = String(r.taskType || r.type || r.sourceType || "").trim().toUpperCase();
      if (type) {
        typesSet.add(type);
      }
    });
    return Array.from(typesSet).sort();
  }, [activeTab, searchData]);

  // 2. Aggregate row data by business -> center -> chargeToCenterMkt
  const mktPivotRows = useMemo(() => {
    if (activeTab !== "mkt_local_north") return [];
    
    const map = new Map<string, {
      business: string;
      center: string;
      chargeToCenterMkt: string;
      values: Record<string, number>;
      total: number;
      sourceRowKeys: string[];
      sourceRowKeysByType: Record<string, string[]>;
    }>();

    searchData.forEach((r: any) => {
      const type = String(r.taskType || r.type || r.sourceType || "").trim().toUpperCase();
      if (!type) return; // skip empty data as requested

      const chargeMkt = String(r.chargeToCenterMkt || r.charge_to_center_mkt || r.center || r.l07 || "").trim();
      // Pivot allocation follows the destination L07, not the generic MKT
      // source BU. This makes TN0001.LNQ -> ATN and TH0001.TPU -> ATH
      // authoritative even for rows imported with a stale AHN value.
      const canonicalChargeMkt = mapL07(chargeMkt);
      const knownAllocation = getCenterInfoByL07(canonicalChargeMkt);
      const bus = knownAllocation?.bus
        || String(r.business || "").trim()
        || getBusinessFromL07(chargeMkt || String(r.l07 || ""));
      const key = `${bus}||${chargeMkt}`;

      if (!map.has(key)) {
        map.set(key, {
          business: bus,
          center: "",
          chargeToCenterMkt: chargeMkt,
          values: {},
          total: 0,
          sourceRowKeys: [],
          sourceRowKeysByType: {},
        });
      }

      const item = map.get(key)!;
      const sourceRowKey = getRosterSourceKey(r);
      if (sourceRowKey && !item.sourceRowKeys.includes(sourceRowKey)) {
        item.sourceRowKeys.push(sourceRowKey);
      }
      if (!item.sourceRowKeysByType[type]) item.sourceRowKeysByType[type] = [];
      if (sourceRowKey && !item.sourceRowKeysByType[type].includes(sourceRowKey)) {
        item.sourceRowKeysByType[type].push(sourceRowKey);
      }
      const hours = Number(r.workingHours ?? r.duration) || 0;
      // Value: working hours * 20,000 as requested
      const rawOverride = r._mktPivotValueOverride;
      const hasOverride =
        rawOverride !== undefined &&
        rawOverride !== null &&
        rawOverride !== "" &&
        Number.isFinite(Number(rawOverride));
      const value = hasOverride ? Number(rawOverride) : hours * 20000;

      item.values[type] = (item.values[type] || 0) + value;
      item.total += value;
    });

    return Array.from(map.values()).sort((a, b) => {
      const comp1 = a.business.localeCompare(b.business);
      if (comp1 !== 0) return comp1;
      return a.chargeToCenterMkt.localeCompare(b.chargeToCenterMkt);
    });
  }, [activeTab, searchData]);

  // 3. Compute column and grand totals for the Pivot Grid
  const mktPivotGrandTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    
    mktPivotRows.forEach((row) => {
      mktPivotUniqueTypes.forEach((type) => {
        totals[type] = (totals[type] || 0) + (row.values[type] || 0);
      });
      grandTotal += row.total;
    });

    return { totals, grandTotal };
  }, [mktPivotRows, mktPivotUniqueTypes]);

  const handleMktPivotCellChange = useCallback((row: any, field: string, value: unknown) => {
    const sourceKeys = new Set<string>(
      field === "chargeToCenterMkt"
        ? row.sourceRowKeys || []
        : row.sourceRowKeysByType?.[field] || [],
    );
    if (sourceKeys.size === 0) {
      toast.error("KhÃ´ng tÃ¬m tháº¥y dÃ²ng dá»¯ liá»‡u nguá»“n Ä‘á»ƒ cáº­p nháº­t.");
      return;
    }

    if (field === "chargeToCenterMkt") {
      const rawL07 = String(value || "").trim();
      if (!rawL07) {
        toast.error("L07 khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
        return;
      }
      const canonicalL07 = mapL07(rawL07) || rawL07;
      const canonicalBusiness = getBusinessFromL07(canonicalL07);
      updateAppData((prev) => ({
        ...prev,
        Timesheet_Roster: (prev.Timesheet_Roster || []).map((sourceRow: any) =>
          sourceKeys.has(getRosterSourceKey(sourceRow))
            ? {
                ...sourceRow,
                chargeToCenterMkt: canonicalL07,
                charge_to_center_mkt: canonicalL07,
                business: canonicalBusiness,
              }
            : sourceRow,
        ),
        updatedAt: new Date().toISOString(),
      }), true);
      toast.success(`ÄÃ£ cáº­p nháº­t L07 ${canonicalL07} Â· BU ${canonicalBusiness}`);
      return;
    }

    const nextAmount = Math.max(0, parseMoneyToNumber(value));
    let overrideApplied = false;
    updateAppData((prev) => ({
      ...prev,
      Timesheet_Roster: (prev.Timesheet_Roster || []).map((sourceRow: any) => {
        if (!sourceKeys.has(getRosterSourceKey(sourceRow))) return sourceRow;
        if (!overrideApplied) {
          overrideApplied = true;
          return { ...sourceRow, _mktPivotValueOverride: nextAmount };
        }
        return { ...sourceRow, _mktPivotValueOverride: 0 };
      }),
      updatedAt: new Date().toISOString(),
    }), true);
    toast.success("ÄÃ£ cáº­p nháº­t giÃ¡ trá»‹ Pivot Timesheet.");
  }, [updateAppData]);

  const handleExportExcel = () => {
    if (currentData.length === 0) return;

    if (activeTab === "mkt_local_north") {
      const rows = mktPivotRows.map((row) => {
        const item: any = {
          "Business": row.business,
          "Charge To Center MKT": row.chargeToCenterMkt,
        };
        mktPivotUniqueTypes.forEach((type) => {
          item[type] = row.values[type] || 0;
        });
        item["Grand Total"] = row.total;
        return item;
      });

      // Add Grand Totals Row
      const totalsRow: any = {
        "Business": "Tá»”NG Cá»˜NG",
        "L07 (Region)": "",
        "Charge To Center MKT": "",
      };
      mktPivotUniqueTypes.forEach((type) => {
        totalsRow[type] = mktPivotGrandTotals.totals[type] || 0;
      });
      totalsRow["Grand Total"] = mktPivotGrandTotals.grandTotal;
      rows.push(totalsRow);

      const ws = XLSX.utils.json_to_sheet(prepareDataForExport(rows));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PhÃ­ MKT Local North (Pivot)");
      XLSX.writeFile(wb, `Pivot_Phi_MKT_Local_North.xlsx`);
      return;
    }

    let exportRows = currentData;
    
    if (activeTab === "roster_raw") {
      exportRows = currentData.map((row: any) => {
        const mappedRow: any = {};
        ROSTER_RAW_COLUMNS.forEach(col => {
          if (!col.hidden) {
            mappedRow[col.label] = row[col.key];
          }
        });
        return mappedRow;
      });
    }

    const ws = XLSX.utils.json_to_sheet(prepareDataForExport(exportRows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Timesheet_Hub_${activeTab}.xlsx`);
  };

  const handleSyncToSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh! Vui lÃ²ng cÃ i Ä‘áº·t URL vÃ  Anon Key trong pháº§n cáº¥u hÃ¬nh.");
      return;
    }

    const rosterData = appData.Timesheet_Roster || [];
    const staffData = appData.Q_Staff || [];
    const salaryData = appData.Q_Salary_Scale || [];

    if (rosterData.length === 0 && staffData.length === 0 && salaryData.length === 0) {
      toast.warning("KhÃ´ng cÃ³ dá»¯ liá»‡u Ä‘á»ƒ Ä‘á»“ng bá»™.");
      return;
    }

    setIsSyncing(true);
    setTotalSyncRows(rosterData.length + staffData.length + salaryData.length);
    setSyncedRowsCount(0);
    setSyncProgress(0);

    try {
      let overallSuccessCount = 0;
      const totalToSync = rosterData.length + staffData.length + salaryData.length;

      // 1. Sync Staff
      if (staffData.length > 0) {
        const { successCount } = await syncEmployeesToSupabase(
          staffData,
          (current) => {
            setSyncedRowsCount(current);
            setSyncProgress(Math.round((current / totalToSync) * 100));
          }
        );
        overallSuccessCount += successCount;
      }

      // 2. Sync Salary Scale
      if (salaryData.length > 0) {
        const { successCount } = await syncSalaryScalesToSupabase(
          salaryData,
          (current) => {
            const currentTotal = staffData.length + current;
            setSyncedRowsCount(currentTotal);
            setSyncProgress(Math.round((currentTotal / totalToSync) * 100));
          }
        );
        overallSuccessCount += successCount;
      }

      // 3. Sync Roster
      if (rosterData.length > 0) {
        const { successCount } = await syncRosterToSupabase(
          rosterData,
          (current) => {
            const currentTotal = staffData.length + salaryData.length + current;
            setSyncedRowsCount(currentTotal);
            setSyncProgress(Math.round((currentTotal / totalToSync) * 100));
          }
        );
        overallSuccessCount += successCount;
      }

      toast.success(`Äá»“ng bá»™ thÃ nh cÃ´ng ${overallSuccessCount.toLocaleString()}/${totalToSync.toLocaleString()} dÃ²ng lÃªn Supabase.`);
      
      updateAppData((prev: any) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        lastSupabaseSyncAt: new Date().toISOString(),
        Timesheet_SkipSupabaseRestore: false,
      }), true);
      toast.success("ÄÃ£ tá»± Ä‘á»™ng lÆ°u cá»©ng dá»¯ liá»‡u trÃªn web.");
    } catch (err: unknown) {
      console.error("Supabase Sync Error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Äá»“ng bá»™ tháº¥t báº¡i: ${errMsg}`);
      if (
        errMsg.includes("chÆ°a tá»“n táº¡i") || 
        errMsg.includes("relation") || 
        errMsg.includes("does not exist") ||
        errMsg.includes("Thiáº¿u cá»™t") ||
        errMsg.includes("unique_nv_ngay") ||
        errMsg.includes("rÃ ng buá»™c") ||
        errMsg.includes("trÃ¹ng láº·p")
      ) {
        setShowSqlDialog(true);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [appData.Timesheet_Roster, appData.Q_Staff, appData.Q_Salary_Scale, updateAppData]);

  const tableRef = useRef<any>(null);

  const handleFetchFromSupabase = useCallback(async (isSilent = false) => {
    if (!isSupabaseConfigured()) {
      if (!isSilent) {
        toast.error("Supabase chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh! Vui lÃ²ng cÃ i Ä‘áº·t URL vÃ  Anon Key trong pháº§n cáº¥u hÃ¬nh.");
      }
      return;
    }

    const loadToastId = !isSilent ? toast.loading("Äang táº£i dá»¯ liá»‡u tá»« Supabase...") : null;

    try {
      // Fetch all data from tables
      const [dbRoster, dbStaff, dbSalary] = await Promise.all([
        fetchAllFromSupabaseTable("roster_cham_cong"),
        fetchAllFromSupabaseTable("nhan_vien"),
        fetchAllFromSupabaseTable("thang_luong"),
      ]);

      if ((dbRoster || []).length === 0 && (dbStaff || []).length === 0 && (dbSalary || []).length === 0) {
        if (!isSilent) {
          toast.warning("Dá»¯ liá»‡u trÃªn Supabase hiá»‡n Ä‘ang trá»‘ng. HÃ£y báº¥m 'Äá»“ng bá»™ Supabase' trÆ°á»›c Ä‘á»ƒ Ä‘áº©y dá»¯ liá»‡u lÃªn.");
        }
        if (loadToastId) toast.dismiss(loadToastId);
        return;
      }

      // Map Roster rows
      const mappedRoster = (dbRoster || []).map((row: any) => ({
        ...(row.raw_data || {}),
        _rowId: row.unique_id || `supa-r-${row.id}`,
        _uuid: row.unique_id || `supa-u-${row.id}`,
        _sourceFile: row.raw_data?._sourceFile || "Supabase_Live",
        center: row.center || row.l07 || "",
        l07: row.l07 || "",
        business: row.business || "",
        ma_nv: row.ma_nv || "",
        full_name: row.full_name || "",
        ngay: row.ngay || "",
        type: row.type || "",
        class: row.class || "",
        gio_vao: row.gio_vao || "",
        gio_ra: row.gio_ra || "",
        duration: Number(row.duration) || 0,
        notes: row.notes || "",
        employeeId: row.ma_nv || "",
        fullName: row.full_name || "",
        maAE: row.center || row.l07 || "",
        date: row.ngay || "",
        taskType: row.type || "",
        classCode: row.class || "",
        from: row.gio_vao || "",
        to: row.gio_ra || "",
        chargeToCenterMkt: row.charge_to_center_mkt || ""
      }));

      // Map Staff rows
      const mappedStaff = (dbStaff || []).map((row: any) => ({
        ...(row.raw_data || {}),
        _rowId: row.unique_id,
        employeeId: row.employee_id,
        fullName: row.full_name,
        bankAccountNumber: row.bank_account_number,
        salaryScale: row.salary_scale,
        business: row.business,
        center: row.center,
        from: row.from,
        to: row.to,
        className: row.class_name,
        noteDays: row.note_days
      }));

      // Map Salary scale rows
      const mappedSalary = (dbSalary || []).map((row: any) => ({
        ...(row.raw_data || {}),
        _rowId: row.unique_id,
        sCode: row.s_code,
        academicPrice: Number(row.academic_price) || 0,
        baseSalary: Number(row.base_salary) || 0,
        totalSalary: Number(row.total_salary) || 0,
        deductionHours: Number(row.deduction_hours) || 0
      }));

      hasFetchedSupabase = true;

      updateAppData((prev) => ({
        ...prev,
        Timesheet_Roster: mappedRoster,
        Q_Staff: mappedStaff,
        Q_Salary_Scale: mappedSalary,
        updatedAt: new Date().toISOString(),
        Timesheet_SkipSupabaseRestore: false,
      }), true);

      if (loadToastId) {
        toast.dismiss(loadToastId);
        toast.success(`ÄÃ£ láº¥y dá»¯ liá»‡u tá»« Supabase vá» á»©ng dá»¥ng thÃ nh cÃ´ng (${mappedRoster.length} dÃ²ng Roster, ${mappedStaff.length} NhÃ¢n viÃªn)!`);
      }
    } catch (err: any) {
      console.error("Error fetching Supabase data:", err);
      if (loadToastId) {
        toast.dismiss(loadToastId);
        toast.error(`KhÃ´ng thá»ƒ láº¥y dá»¯ liá»‡u tá»« Supabase: ${err.message}`);
      }
    }
  }, [updateAppData]);

  const handleS{×ž9¶‰žËkºwµçb6WD6öÇVÖåv–GF‡2‚‡&Wb’Óâ‡°¢ââç&WbÀ¢¶¶W•Ó¢æWuv–GF‚À¢Ò’“°¢Ó° ¢6öç7B†æFÆTÖ÷W6UWÒ‚’Óâ°¢–b‡&W6—¦–æt6öÂ’°¢6öç7B²¶W’ÒÒ&W6—¦–æt6öÃ°¢6WD6öÇVÖåv–GF‡2‚‡&Wb’Óâ°¢6fT6öÇVÖåv–GF‡2‡&Wb“°¢&WGW&â&Wc°¢Ò“°¢6WE&W6—¦–æt6öÂ†çVÆÂ“°¢Fö7VÖVçBæ&öG’ç7G–ÆRæ7W'6÷"Ò"#°¢Fö7VÖVçBæ&öG’ç7G–ÆRçW6W%6VÆV7BÒ"#°¢Ð¢Ó° ¢–b‡&W6—¦–æt6öÂ’°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&Ö÷W6VÖ÷fR"Â†æFÆTÖ÷W6TÖ÷fR“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&Ö÷W6WW"Â†æFÆTÖ÷W6UW“°¢Ð¢&WGW&â‚’Óâ°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&Ö÷W6VÖ÷fR"Â†æFÆTÖ÷W6TÖ÷fR“°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&Ö÷W6WW"Â†æFÆTÖ÷W6UW“°¢Ó°¢ÒÂ·&W6—¦–æt6öÅÒ“° ¢6öç7B†æFÆU&W6—¦U7F'BÒ†S¢&V7BäÖ÷W6TWfVçBÂ6öÄ¶W“¢7G&–ær’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢Rç7F÷&÷vF–öâ‚“°¢6öç7BF‚Ò†RçF&vWB2…DÔÄVÆVÖVçB’æ6Æ÷6W7B‚'F‚"“°¢–b‚F‚’&WGW&ã° ¢6WE&W6—¦–æt6öÂ‡°¢¶W“¢6öÄ¶W’À¢7F'Eƒ¢Ræ6Æ–VçE‚À¢7F'Ev–GFƒ¢F‚æöfg6WEv–GF‚À¢7W'&VçEƒ¢Ræ6Æ–VçE‚À¢Ò“° ¢Fö7VÖVçBæ&öG’ç7G–ÆRæ7W'6÷"Ò&6öÂ×&W6—¦R#°¢Fö7VÖVçBæ&öG’ç7G–ÆRçW6W%6VÆV7BÒ&æöæR#°¢Ó° ¢6öç7B†æFÆU&W6—¦TF÷V&ÆT6Æ–6²Ò†6öÄ¶W“¢7G&–ær’Óâ°¢ÆWB—4ÆÅ6VÆV7FVBÒ6VÆV7FVE&÷t–G2ç6—¦Râbb6VÆV7FVE&÷t–G2ç6—¦RÓÓÒf–ÇFW&VDæE6÷'FVDFFæÆVæwFƒ°¢–b‚—4ÆÅ6VÆV7FVBbb6VÆV7F–öå&ævR’°¢6öç7B²7F'E"ÂVæE"Â7F'D2ÂVæD2ÒÒ6VÆV7F–öå&ævS°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡7F'E"ÂVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡7F'E"ÂVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡7F'D2ÂVæD2“°¢6öç7BÖ„2ÒÖF‚æÖ‚‡7F'D2ÂVæD2“° ¢–b†Ö–å"ÓÓÒbbÖ…"ÓÓÒf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÒbbÖ–ä2ÓÓÒbbÖ„2ÓÓÒf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò’°¢—4ÆÅ6VÆV7FVBÒG'VS°¢Ð¢Ð ¢–b†—4ÆÅ6VÆV7FVB’°¢6öç7B6çf2ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&6çf2"“°¢6öç7B6öçFW‡BÒ6çf2ævWD6öçFW‡B‚#&B"“°¢–b‚6öçFW‡B’&WGW&ã° ¢6öç7BæW‡Ev–GF‡2Ò²ââæ6öÇVÖåv–GF‡2Ó° ¢6öÇVÖç2æf÷$V6‚‚†6öÂ’Óâ°¢–b†VffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’’&WGW&ã° ¢6öçFW‡BæföçBÒ#sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#²òòÖF6†W2F&ÆR6VÆÂföç@¢ÆWBÖ…v–GF‚Ò6öçFW‡BæÖV7W&UFW‡B†6öÂæÆ&VÂÇÂ""’çv–GF‚²ƒ° ¢6öçFW‡BæföçBÒ#Sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#°¢f–ÇFW&VDæE6÷'FVDFFæf÷$V6‚‚‡&÷r’Óâ°¢6öç7BbÒ7G&–ær†f÷&ÖEfÇVR‡&÷u¶6öÂæ¶W•ÒÂ6öÂçG—RÂ6öÂæ¶W’’“°¢6öç7BrÒ6öçFW‡BæÖV7W&UFW‡B‡b’çv–GF‚²c°¢–b‡râÖ…v–GF‚’Ö…v–GF‚Òs°¢Ò“° ¢6öç7Bf–æÅv–GF‚ÒÖF‚æÖ–âƒcÂÖF‚æÖ‚ƒƒÂÖ…v–GF‚’“°¢æW‡Ev–GF‡5¶6öÂæ¶W•ÒÒf–æÅv–GFƒ°¢Ò“° ¢6WD6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢6fT6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢Fö7Bç7V66W72‚,I:2N»I¹–ær<H6â6Ž¸–æ‚¼:Ö6‚FŒk¹¶26†òNªWB>ª2>¹—B"“°¢&WGW&ã°¢Ð ¢6öç7BfÇVW2Òf–ÇFW&VDæE6÷'FVDFFæÖ‚‡&÷r’Óà¢7G&–ær†f÷&ÖEfÇVR‡&÷u¶6öÄ¶W•ÒÂ'FW‡B"Â6öÄ¶W’’’À¢“° ¢òòÖV7W&RFW‡BFööÀ¢6öç7B6çf2ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&6çf2"“°¢6öç7B6öçFW‡BÒ6çf2ævWD6öçFW‡B‚#&B"“°¢–b‚6öçFW‡B’&WGW&ã°¢6öçFW‡BæföçBÒ#sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#²òòÖF6†W2F&ÆR6VÆÂföç@ ¢òòÖV7W&R†VFW ¢6öç7B6öÂÒ6öÇVÖç2æf–æB‚†2’Óâ2æ¶W’ÓÓÒ6öÄ¶W’“°¢ÆWBÖ…v–GF‚Ò6öçFW‡BæÖV7W&UFW‡B†6öÃòæÆ&VÂÇÂ""’çv–GF‚²ƒ²òòFF–ær²f–ÇFW"–6öà ¢6öçFW‡BæföçBÒ#Sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#²òòÖF6†W2&÷r6VÆÂföç@¢fÇVW2æf÷$V6‚‚‡b’Óâ°¢6öç7BrÒ6öçFW‡BæÖV7W&UFW‡B‡b’çv–GF‚²c²òò6VÆÂFF–æp¢–b‡râÖ…v–GF‚’Ö…v–GF‚Òs°¢Ò“° ¢6öç7Bf–æÅv–GF‚ÒÖF‚æÖ–âƒcÂÖF‚æÖ‚ƒƒÂÖ…v–GF‚’“°¢6WD6öÇVÖåv–GF‡2‚‡&Wb’Óâ°¢6öç7BæW‡BÒ²ââç&WbÂ¶6öÄ¶W•Ó¢f–æÅv–GF‚Ó°¢6fT6öÇVÖåv–GF‡2†æW‡B“°¢&WGW&âæW‡C°¢Ò“°¢Fö7Bç7V66W72†I:2N»I¹–ær<H6â6Ž¸–æ‚>¹—BG¶6öÃòæÆ&VÇÖ“°¢Ó° ¢6öç7BF&ÆU&VbÒW6U&VcÄ…DÔÄF—dVÆVÖVçCâ†çVÆÂ“°¢6öç7B–çWE&VbÒW6U&VcÄ…DÔÄ–çWDVÆVÖVçBÂ…DÔÅFW‡D&VVÆVÖVçCâ†çVÆÂ“° ¢W6TVffV7B‚‚’Óâ°¢6öç7B†æFÆTvÆö&ÄÖ÷W6UWÒ‚’Óâ°¢6WD—56VÆV7F–ær†fÇ6R“°¢Ó°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&Ö÷W6WW"Â†æFÆTvÆö&ÄÖ÷W6UW“°¢&WGW&â‚’Óâv–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&Ö÷W6WW"Â†æFÆTvÆö&ÄÖ÷W6UW“°¢ÒÂµÒ“° ¢6öç7B†æFÆU6÷'BÒ†¶W“¢7G&–ærÂF—&V7F–öãó¢&62"Â&FW62"ÂçVÆÂ’Óâ°¢–b†F—&V7F–öâÓÓÒçVÆÂ’°¢6WE6÷'D6öæf–r†çVÆÂ“°¢Fö7Bç7V66W72‚,I:2Œ;6>ª÷Ž«÷>¹—B"“°¢&WGW&ã°¢Ð¢6WE6÷'D6öæf–r‚‡&Wb’Óâ°¢–b†F—&V7F–öâ’&WGW&â²¶W’ÂF—&V7F–öâÓ°¢–b‡&Wcòæ¶W’ÓÓÒ¶W’’°¢–b‡&WbæF—&V7F–öâÓÓÒ&62"’°¢&WGW&â²¶W’ÂF—&V7F–öã¢&FW62"Ó°¢Ð¢Fö7Bç7V66W72‚,I:2Œ;6>ª÷Ž«÷>¹—B"“°¢&WGW&âçVÆÃ°¢Ð¢&WGW&â²¶W’ÂF—&V7F–öã¢&62"Ó°¢Ò“°¢Ó° ¢6öç7B†æFÆTf–ÇFW$6†ævRÒ†¶W“¢7G&–ærÂfÇVW3¢6WCÆç“âÂVæFVf–æVB’Óâ°¢6WD6öÇVÖäf–ÇFW'2‚‡&Wb’Óâ‡²ââç&WbÂ¶¶W•Ó¢fÇVW2Ò’“°¢Ó° ¢6öç7B6ÆV$ÆÄf–ÇFW'2Ò‚’Óâ°¢6WD6öÇVÖäf–ÇFW'2‡·Ò“°¢6WD–çFW&æÅ6V&6…FW&Ò‚""“°¢–b†öäW‡FW&æÅ6V&6„6†ævR’öäW‡FW&æÅ6V&6„6†ævR‚""“°¢Fö7Bç7V66W72‚,I:2Œ;6NªWB>ª2.¹’Î¸Ö2"“°¢Ó° ¢6öç7B&W6WEF&ÆT6öæf–rÒ‚’Óâ°¢–b‡7F÷&vT¶W’’°¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ†GEö†–FFVåòG·7F÷&vT¶W—Ö“°¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ†GE÷v–GF‡5òG·7F÷&vT¶W—Ö“°¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ†GE÷6÷'EòG·7F÷&vT¶W—Ö“°¢Æö6Å7F÷&vRç&VÖ÷fT—FVÒ†GEö—òG·7F÷&vT¶W—Ö“°¢6WD†–FFVä6öÇVÖç2†æWr6WB‚’“°¢6WE6†÷väWFô†–FFVä6öÇVÖç2†æWr6WB‚’“°¢6WD6öÇVÖåv–GF‡2‡·Ò“°¢6WE6÷'D6öæf–r†çVÆÂ“°¢6WD—FV×5W%vRƒS“°¢6WD7W'&VçEvRƒ“°¢Fö7Bç7V66W72‚,I:2¶Œ;F’ŽºV2>ªWRŒ:Ææ‚.ª6ærÞ«v2I¸¶æ‚"“°¢Ð¢Ó° ¢6öç7BFövvÆT6öÇVÖâÒ†¶W“¢7G&–ær’Óâ°¢6öç7B—47W'&VçFÇ”†–FFVâÒVffV7F—fT†–FFVä6öÇVÖç2æ†2†¶W’“° ¢–b†—47W'&VçFÇ”†–FFVâ’°¢6WD†–FFVä6öÇVÖç2‚‡&Wb’Óâ°¢–b‚&Wbæ†2†¶W’’’&WGW&â&Wc°¢6öç7BæW‡BÒæWr6WB‡&Wb“°¢æW‡BæFVÆWFR†¶W’“°¢&WGW&âæW‡C°¢Ò“°¢–b†WFô†–FFVä6öÇVÖç2æ†2†¶W’’’°¢6WE6†÷väWFô†–FFVä6öÇVÖç2‚‡&Wb’ÓâæWr6WB‡&Wb’æFB†¶W’’“°¢Ð¢&WGW&ã°¢Ð ¢–b†WFô†–FFVä6öÇVÖç2æ†2†¶W’’’°¢6WE6†÷väWFô†–FFVä6öÇVÖç2‚‡&Wb’Óâ°¢6öç7BæW‡BÒæWr6WB‡&Wb“°¢æW‡BæFVÆWFR†¶W’“°¢&WGW&âæW‡C°¢Ò“°¢&WGW&ã°¢Ð ¢6WD†–FFVä6öÇVÖç2‚‡&Wb’ÓâæWr6WB‡&Wb’æFB†¶W’’“°¢Ó° ¢6öç7BWFFTÆ–væÖVçBÒ€¢6öÄ¶W“¢7G&–ærÀ¢Æ–væÖVçC¢&ÆVgB"Â&6VçFW""Â'&–v‡B"À¢’Óâ°¢6WD6öÇVÖäf÷&ÖG2‚‡&Wb’Óâ‡°¢ââç&WbÀ¢¶6öÄ¶W•Ó¢²ââç&We¶6öÄ¶W•ÒÂÆ–væÖVçBÒÀ¢Ò’“°¢Ó° ¢6öç7BWFFT6öÇVÖåG—RÒ†¶W“¢7G&–ærÂG—S¢7G&–ær’Óâ°¢6WD6öÇVÖåG—W2‚‡&Wb’Óâ°¢6öç7BæW‡BÒ²ââç&WbÂ¶¶W•Ó¢G—RÓ°¢–b‡7F÷&vT¶W’¢Æö6Å7F÷&vRç6WD—FVÒ†GE÷G—W5òG·7F÷&vT¶W—ÖÂ¥4ôâç7G&–æv–g’†æW‡B’“°¢&WGW&âæW‡C°¢Ò“°¢Fö7Bç7V66W72†I:2I¹V’I¸¶æ‚Nªær>¹—B6ærG·G—WÖ“°¢Ó° ¢&V7BçW6T–×W&F—fT†æFÆR‡&VbÂ‚’Óâ‡°¢6öÇVÖç2À¢†–FFVä6öÇVÖç3¢VffV7F—fT†–FFVä6öÇVÖç2À¢FövvÆT6öÇVÖâÀ¢&W6WEF&ÆT6öæf–rÀ¢6ÆV$ÆÄf–ÇFW'2À¢vWD7W'&VçEvTFF¢‚’Óâv–æFVDFFÀ¢vWD7F—fT6VÆÃ¢‚’Óâ7F—fT6VÆÂÀ¢vWDf–ÇFW&VDæE6÷'FVDFF¢‚’Óâf–ÇFW&VDæE6÷'FVDFFÀ¢Ò’“° ¢6öç7Bf÷&ÖEfÇVRÒ‡fÇVS¢ç’ÂG—Só¢7G&–ærÂ6öÄ¶W“ó¢7G&–ær’Óâ°¢6öç7BVffV7F—fUG—RÒ†6öÄ¶W’bb6öÇVÖåG—W5¶6öÄ¶W•Ò’ÇÂG—RÇÂ'FW‡B#° ¢òò)H)HwV&C¢FFRö&¦V7G26ææ÷B&R&VæFW&VB2&V7B6†–ÆG&Vâ)H)H)H)H)H)H)H)H)H)H)H)H ¢–b‡fÇVR–ç7Fæ6VöbFFR’°¢–b†—4æâ‡fÇVRævWEF–ÖR‚’’’&WGW&â"#²òò–çfÆ–BFFP¢–b†VffV7F—fUG—RÓÓÒ&FFR"’°¢&WGW&âfÇVRçFôÆö6ÆTFFU7G&–ær‚'f’Õdâ"Â°¢F“¢#"ÖF–v—B"À¢ÖöçFƒ¢#"ÖF–v—B"À¢–V#¢&çVÖW&–2"À¢Ò“°¢Ð¢&WGW&âfÇVRçFôÆö6ÆTFFU7G&–ær‚'f’Õdâ"“°¢Ð ¢–b†VffV7F—fUG—RÓÓÒ&7W'&Væ7’"ÇÂVffV7F—fUG—RÓÓÒ&ÖöæW’"’°¢6öç7BçVÒÒ'6TÖöæW•FôçVÖ&W"‡fÇVR“°¢&WGW&âf÷&ÖEdå&ö'W7B†çVÒÂ“°¢Ð¢–b†VffV7F—fUG—RÓÓÒ&çVÖ&W""’°¢6öç7BçVÒÒ'6TÖöæW•FôçVÖ&W"‡fÇVR“°¢&WGW&âf÷&ÖEdå&ö'W7B†çVÒÂ"“°¢Ð¢–b†VffV7F—fUG—RÓÓÒ&FFR"’°¢&WGW&âf÷&ÖDçVÖ&W"‡fÇVRÂ&FFR"“°¢Ð¢–b†VffV7F—fUG—RÓÓÒ&Æ&VÂ"’°¢6öç7BÆ&VÂÒ7G&–ær‡fÇVRÇÂ""’çFôÆ÷vW$66R‚“°¢6öç7B6öæf–rÒt•D…T%ôÄ$TÅ5¶Æ&VÅÓ°¢–b†6öæf–r’°¢&WGW&â€¢Ç7à¢6Æ74æÖSÒ'‚Ó"’ÓãR&÷VæFVBÖgVÆÂFW‡BÕ³ãSW&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"6†F÷r×6Ò&÷&FW"&÷&FW"Ö&Æ6²óR ¢7G–ÆS×·²&6¶w&÷VæD6öÆ÷#¢6öæf–ræ6öÆ÷"Â6öÆ÷#¢6öæf–rçFW‡D6öÆ÷"×Ð¢à¢¶Æ&VÇÐ¢Â÷7ãà¢“°¢Ð¢Ð¢–b…&V7Bæ—5fÆ–DVÆVÖVçB‡fÇVR’’°¢&WGW&âfÇVS°¢Ð¢òòwV&C¢&WfVçBç’&VÖ–æ–ærÆ–âö&¦V7G2g&öÒ7&6†–ær&V7B&VæFW ¢–b‡fÇVRÓÒçVÆÂbbG—VöbfÇVRÓÓÒ&ö&¦V7B"’°¢&WGW&â7G&–ær‡fÇVR“°¢Ð¢&WGW&âfÇVRÓÒçVÆÂò""¢7G&–ær‡fÇVR“°¢Ó° ¢òòWFöÖF–6ÆÇ’WFò×6—¦R6öÇVÖç2Wöâf—'7BÖ÷VçBöFFÆöB–bæòv–GF‡2&RFVf–æVB–âÆö6Â7F÷&vP¢W6TVffV7B‚‚’Óâ°¢–b‡7F÷&vT¶W’bbf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚âbb6öÇVÖç2æÆVæwF‚â’°¢6öç7B†56fVEv–GF‡2ÒÆö6Å7F÷&vRævWD—FVÒ†GE÷v–GF‡5òG·7F÷&vT¶W—Ö“°¢–b‚†56fVEv–GF‡2’°¢6öç7B6çf2ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&6çf2"“°¢6öç7B6öçFW‡BÒ6çf2ævWD6öçFW‡B‚#&B"“°¢–b†6öçFW‡B’°¢6öç7BæW‡Ev–GF‡3¢&V6÷&CÇ7G&–ærÂçVÖ&W#âÒ·Ó°¢6öÇVÖç2æf÷$V6‚‚†6öÂ’Óâ°¢–b†VffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’’&WGW&ã° ¢6öçFW‡BæföçBÒ#sãw&VÒ–çFW"Â6ç2×6W&–b#°¢ÆWBÖ…v–GF‚Ò6öçFW‡BæÖV7W&UFW‡B†6öÂæÆ&VÂÇÂ""’çv–GF‚²CS° ¢6öçFW‡BæföçBÒ#Sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#°¢f–ÇFW&VDæE6÷'FVDFFæf÷$V6‚‚‡&÷r’Óâ°¢6öç7BfÂÒ&÷u¶6öÂæ¶W•Ó°¢6öç7Bf÷&ÖGFVBÒfÂÓÒVæFVf–æVBbbfÂÓÒçVÆÂòf÷&ÖEfÇVR‡fÂÂ6öÂçG—RÂ6öÂæ¶W’’¢"#°¢6öç7B7G&–æufÂÒ‡G—Vöbf÷&ÖGFVBÓÓÒ'7G&–ær"ÇÂG—Vöbf÷&ÖGFVBÓÓÒ&çVÖ&W""’ò7G&–ær†f÷&ÖGFVB’¢7G&–ær‡fÂóò""“°¢6öç7BrÒ6öçFW‡BæÖV7W&UFW‡B‡7G&–æufÂ’çv–GF‚²3#°¢–b‡râÖ…v–GF‚’Ö…v–GF‚Òs°¢Ò“° ¢6öç7B6öÄFVfVÇEv–GF‚Ò6öÂçv–GF‚ò‡G—Vöb6öÂçv–GF‚ÓÓÒ&çVÖ&W""ò6öÂçv–GF‚¢'6T–çB…7G&–ær†6öÂçv–GF‚’’ÇÂS’¢S°¢6öç7Bf–æÅv–GF‚ÒÖF‚æÖ–âƒcÂÖF‚æÖ‚†6öÄFVfVÇEv–GF‚ÂÖ…v–GF‚’“°¢æW‡Ev–GF‡5¶6öÂæ¶W•ÒÒf–æÅv–GFƒ°¢Ò“°¢6WD6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢6fT6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢Ð¢Ð¢Ð¢ÒÂ¶f–ÇFW&VDæE6÷'FVDFFÂ6öÇVÖç2Â7F÷&vT¶W’ÂVffV7F—fT†–FFVä6öÇVÖç5Ò“° ¢6öç7BWFôf—DÆÄ6öÇVÖç2ÒW6T6ÆÆ&6²‚‚’Óâ°¢6öç7B6çf2ÒFö7VÖVçBæ7&VFTVÆVÖVçB‚&6çf2"“°¢6öç7B6öçFW‡BÒ6çf2ævWD6öçFW‡B‚#&B"“°¢–b‚6öçFW‡B’&WGW&ã° ¢6öç7BæW‡Ev–GF‡3¢&V6÷&CÇ7G&–ærÂçVÖ&W#âÒ·Ó°¢6öÇVÖç2æf÷$V6‚‚†6öÂ’Óâ°¢–b†VffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’’&WGW&ã° ¢6öçFW‡BæföçBÒ#sãw&VÒ–çFW"Â6ç2×6W&–b#°¢ÆWBÖ…v–GF‚Ò6öçFW‡BæÖV7W&UFW‡B†6öÂæÆ&VÂÇÂ""’çv–GF‚²CS° ¢6öçFW‡BæföçBÒ#Sãƒ#W&VÒ–çFW"Â6ç2×6W&–b#°¢f–ÇFW&VDæE6÷'FVDFFæf÷$V6‚‚‡&÷r’Óâ°¢6öç7BfÂÒ&÷u¶6öÂæ¶W•Ó°¢6öç7Bf÷&ÖGFVBÒfÂÓÒVæFVf–æVBbbfÂÓÒçVÆÂòf÷&ÖEfÇVR‡fÂÂ6öÂçG—RÂ6öÂæ¶W’’¢"#°¢6öç7B7G&–æufÂÒ‡G—Vöbf÷&ÖGFVBÓÓÒ'7G&–ær"ÇÂG—Vöbf÷&ÖGFVBÓÓÒ&çVÖ&W""’ò7G&–ær†f÷&ÖGFVB’¢7G&–ær‡fÂóò""“°¢6öç7BrÒ6öçFW‡BæÖV7W&UFW‡B‡7G&–æufÂ’çv–GF‚²3#°¢–b‡râÖ…v–GF‚’Ö…v–GF‚Òs°¢Ò“° ¢6öç7B6öÄFVfVÇEv–GF‚Ò6öÂçv–GF‚ò‡G—Vöb6öÂçv–GF‚ÓÓÒ&çVÖ&W""ò6öÂçv–GF‚¢'6T–çB…7G&–ær†6öÂçv–GF‚’’ÇÂS’¢S°¢6öç7Bf–æÅv–GF‚ÒÖF‚æÖ–âƒcÂÖF‚æÖ‚†6öÄFVfVÇEv–GF‚ÂÖ…v–GF‚’“°¢æW‡Ev–GF‡5¶6öÂæ¶W•ÒÒf–æÅv–GFƒ°¢Ò“° ¢6WD6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢6fT6öÇVÖåv–GF‡2†æW‡Ev–GF‡2“°¢Fö7Bç7V66W72‚%N»I¹–ær<H6â6Ž¸–æ‚NªWB>ª2>¹—B"“°¢ÒÂ¶6öÇVÖç2ÂVffV7F—fT†–FFVä6öÇVÖç2Âf–ÇFW&VDæE6÷'FVDFFÂ6fT6öÇVÖåv–GF‡5Ò“° ¢6öç7BvWDÆ–væÖVçBÒ†6öÃ¢6öÇVÖâ’Óâ°¢6öç7BG—RÒ6öÂçG—S°¢6öç7B¶W’Ò6öÂæ¶W“°¢–b†6öÂæÆ–vâ’°¢&WGW&âFW‡BÒG¶6öÂæÆ–vçÖ°¢Ð¢–b†¶W’bb6öÇVÖäf÷&ÖG5¶¶W•ÓòæÆ–væÖVçB’°¢&WGW&âFW‡BÒG¶6öÇVÖäf÷&ÖG5¶¶W•ÒæÆ–væÖVçGÖ°¢Ð¢6öç7B²Ò¶W“òçFôÆ÷vW$66R‚’ÇÂ"#°¢–b†²æ–æ6ÇVFW2‚'6Æ'—66ÆR"’’°¢&WGW&â'FW‡BÖ6VçFW"#°¢Ð¢–b†²ÓÓÒ&æò"ÇÂ²ÓÓÒ'7GB"ÇÂ²ÓÓÒ&–B"’°¢&WGW&â'FW‡BÖ6VçFW"#°¢Ð¢òò7V6–f–26öÇVÖç2<H6âG,:’2&WVW7FV@¢–b†²æ–æ6ÇVFW2‚&Ãr"’ÇÂ²æ–æ6ÇVFW2‚&R"’ÇÂ²æ–æ6ÇVFW2‚&'W6–æW72"’’°¢&WGW&â'FW‡BÖÆVgB#°¢Ð ¢7v—F6‚‡G—R’°¢66R&çVÖ&W"# ¢66R&7W'&Væ7’# ¢66R&ÖöæW’# ¢&WGW&â'FW‡B×&–v‡B#°¢66R'FW‡B# ¢FVfVÇC ¢&WGW&â'FW‡BÖÆVgB#°¢Ð¢Ó° ¢6öç7BFövvÆTÆÂÒ‚’Óâ°¢6WE6VÆV7FVE&÷t–G2‚‡&Wb’Óâ°¢–b‡&Wbç6—¦RÓÓÒf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚’°¢&WGW&âæWr6WB‚“°¢ÒVÇ6R°¢&WGW&âæWr6WB€¢f–ÇFW&VDæE6÷'FVDFFæÖ‚‡&÷rÂ–G‚’Óâ&÷ræ–BÇÂ–G‚’À¢“°¢Ð¢Ò“°¢Ó° ¢6öç7BFövvÆU&÷rÒW6T6ÆÆ&6²‚†–C¢7G&–ærÂçVÖ&W"’Óâ°¢6WE6VÆV7FVE&÷t–G2‚‡&Wb’Óâ°¢6öç7BæW‡BÒæWr6WB‡&Wb“°¢–b†æW‡Bæ†2†–B’’°¢æW‡BæFVÆWFR†–B“°¢ÒVÇ6R°¢æW‡BæFB†–B“°¢Ð¢&WGW&âæW‡C°¢Ò“°¢ÒÂµÒ“° ¢6öç7B7F'DVF—F–ærÒW6T6ÆÆ&6²€¢‡#¢çVÖ&W"Â3¢çVÖ&W"Â6ÆV#¢&ööÆVâÒfÇ6R’Óâ°¢–b‚—4VF—F&ÆR’&WGW&ã°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶5Ó°¢–b†6öÂbb6öÂç&VDöæÇ’’&WGW&ã°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF·%Ó°¢6WDVF—F–æt6VÆÂ‡²"Â2Ò“°¢6WDVF—EfÇVR†6ÆV"ò""¢7G&–ær‡&÷u¶6öÂæ¶W•ÒÇÂ""’“° ¢6WEF–ÖV÷WB‚‚’Óâ°¢–b†–çWE&Vbæ7W'&VçB’°¢–çWE&Vbæ7W'&VçBæfö7W2‚“°¢–b‚6ÆV"’°¢–b€¢–çWE&Vbæ7W'&VçB–ç7Fæ6Vöb…DÔÄ–çWDVÆVÖVçBÇÀ¢–çWE&Vbæ7W'&VçB–ç7Fæ6Vöb…DÔÅFW‡D&VVÆVÖVç@¢’°¢–çWE&Vbæ7W'&VçBç6VÆV7B‚“°¢Ð¢Ð¢Ð¢ÒÂ“°¢ÒÀ¢¶—4VF—F&ÆRÂf—6–&ÆT6öÇVÖç2Âf–ÇFW&VDæE6÷'FVDFFÒÀ¢“° ¢6öç7B6öÖÖ—DVF—BÒW6T6ÆÆ&6²‚‚’Óâ°¢–b†VF—F–æt6VÆÂbböä6VÆÄ6†ævR’°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶VF—F–æt6VÆÂæ5Ó°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶VF—F–æt6VÆÂç%Ó°¢öä6VÆÄ6†ævR‡&÷rÂ6öÂæ¶W’ÂVF—EfÇVR“°¢Ð¢6WDVF—F–æt6VÆÂ†çVÆÂ“°¢ÒÂ°¢VF—F–æt6VÆÂÀ¢öä6VÆÄ6†ævRÀ¢f—6–&ÆT6öÇVÖç2À¢f–ÇFW&VDæE6÷'FVDFFÀ¢VF—EfÇVRÀ¢Ò“° ¢6öç7B6æ6VÄVF—BÒ‚’Óâ°¢6WDVF—F–æt6VÆÂ†çVÆÂ“°¢Ó° ¢6öç7B†æFÆT6öçFW‡DÖVçRÒW6T6ÆÆ&6²€¢†S¢&V7BäÖ÷W6TWfVçBÂ#¢çVÖ&W"Â3¢çVÖ&W"’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢–b‡"ÓÒÓ’°¢òò–bF†W&Rw26VÆV7F–öâ&ævRæBF†R&–v‡BÖ6Æ–6²—2–ç6–FR—BÂFöâwB6†ævRF†R7F—fR6VÆÀ¢ÆWB—4–ç6–FU&ævRÒfÇ6S°¢–b‡6VÆV7F–öå&ævR’°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢6öç7BÖ„2ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢–b‡"ãÒÖ–å"bb"ÃÒÖ…"bb2ãÒÖ–ä2bb2ÃÒÖ„2’°¢—4–ç6–FU&ævRÒG'VS°¢Ð¢Ð¢–b‚—4–ç6–FU&ævR’°¢6WD7F—fT6VÆÂ‡²"Â2Ò“°¢6WE6VÆV7F–öå&ævR†çVÆÂ“²òò6ÆV"&ævR–b&–v‡B6Æ–6²÷WG6–FP¢Ð¢Ð¢6WD6öçFW‡DÖVçR‡²ƒ¢Ræ6Æ–VçE‚Â“¢Ræ6Æ–VçE’Â"Â2Ò“°¢ÒÀ¢·6VÆV7F–öå&ævUÒÀ¢“° ¢6öç7B6Æ÷6T6öçFW‡DÖVçRÒ‚’Óâ6WD6öçFW‡DÖVçR†çVÆÂ“° ¢W6TVffV7B‚‚’Óâ°¢6öç7B†æFÆTvÆö&Ä6Æ–6²Ò‚’Óâ6Æ÷6T6öçFW‡DÖVçR‚“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â†æFÆTvÆö&Ä6Æ–6²“°¢&WGW&â‚’Óâv–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&6Æ–6²"Â†æFÆTvÆö&Ä6Æ–6²“°¢ÒÂµÒ“° ¢6öç7B†æFÆT†VFW$Ö÷W6TF÷vâÒ†S¢&V7BäÖ÷W6TWfVçBÂ4–Gƒ¢çVÖ&W"’Óâ°¢–b†Ræ'WGFöâÓÒ’&WGW&ã°¢–b†f–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÓÓÒ’&WGW&ã°¢6WD—56VÆV7F–ær‡G'VR“°¢6WD7F—fT6VÆÂ‡²#¢Â3¢4–G‚Ò“°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢À¢VæE#¢f–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÒÀ¢7F'D3¢4–G‚À¢VæD3¢4–G‚À¢Ò“°¢Ó° ¢6öç7B†æFÆT†VFW$Ö÷W6TVçFW"Ò†S¢&V7BäÖ÷W6TWfVçBÂ4–Gƒ¢çVÖ&W"’Óâ°¢–b€¢Ræ'WGFöç2ÓÓÒb`¢6VÆV7F–öå&ævRb`¢6VÆV7F–öå&ævRç7F'E"ÓÓÒb`¢6VÆV7F–öå&ævRæVæE"ÓÓÒf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚Ò¢’°¢6WE6VÆV7F–öå&ævR‚‡&Wb’Óâ‡&Wbò²ââç&WbÂVæD3¢4–G‚Ò¢çVÆÂ’“°¢Ð¢Ó° ¢6öç7B6÷”6öÇVÖâÒ†4–Gƒ¢çVÖ&W"’Óâ°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶4–G…Ó°¢6öç7BfÇVW2Òf–ÇFW&VDæE6÷'FVDFFæÖ‚‡&÷r’Óâ°¢6öç7BfÂÒ&÷u¶6öÂæ¶W•Ó°¢–b‡fÂÓÓÒçVÆÂÇÂfÂÓÓÒVæFVf–æVB’&WGW&â"#°¢–b†6öÂçG—RÓÓÒ&7W'&Væ7’"ÇÂ6öÂçG—RÓÓÒ&ÖöæW’"ÇÂ6öÂçG—RÓÓÒ&çVÖ&W""’°¢6öç7BçVÒÒ'6TÖöæW•FôçVÖ&W"‡fÂ“°¢&WGW&â—4æâ†çVÒ’ò""¢7G&–ær†çVÒ“°¢Ð¢&WGW&âf÷&ÖEfÇVR‡fÂÂ6öÂçG—R“°¢Ò“°¢G'’°¢æf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡fÇVW2æ¦ö–â‚%Æâ"’“°¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFò6÷’"ÂW'"“°¢Fö7BæW'&÷"€¢$¶Œ;FærFŽ¸26ò6Œ:—l:ò6Æ—&ö&BâgV’Ì;&ær¶ž¸6ÒG&Wž¸âG'W’>ª×â"À¢“°¢Ð¢Ó° ¢6öç7B6÷•6VÆV7F–öâÒ‚’Óâ°¢6öç7BvWD6VÆÅfÇVT57G&–ærÒ‡&÷s¢ç’Â6öÃ¢ç’’Óâ°¢–b‚&÷rÇÂ6öÂ’&WGW&â"#°¢6öç7BfÂÒ&÷u¶6öÂæ¶W•Ó°¢–b‡fÂÓÓÒçVÆÂÇÂfÂÓÓÒVæFVf–æVB’&WGW&â"#°¢–b‡fÂ–ç7Fæ6VöbFFR’°¢&WGW&â—4æâ‡fÂævWEF–ÖR‚’’ò""¢fÂçFôÆö6ÆTFFU7G&–ær‚'f’Õdâ"Â°¢F“¢#"ÖF–v—B"À¢ÖöçFƒ¢#"ÖF–v—B"À¢–V#¢&çVÖW&–2"À¢Ò“°¢Ð¢–b†6öÂçG—RÓÓÒ&Æ&VÂ"’°¢&WGW&â7G&–ær‡fÂ“°¢Ð¢–b†6öÂçG—RÓÓÒ&7W'&Væ7’"ÇÂ6öÂçG—RÓÓÒ&ÖöæW’"ÇÂ6öÂçG—RÓÓÒ&çVÖ&W""’°¢6öç7BçVÒÒ'6TÖöæW•FôçVÖ&W"‡fÂ“°¢&WGW&â—4æâ†çVÒ’ò""¢7G&–ær†çVÒ“°¢Ð¢&WGW&â7G&–ær‡fÂ“°¢Ó° ¢–b‡6VÆV7F–öå&ævR’°¢6öç7B²7F'E"ÂVæE"Â7F'D2ÂVæD2ÒÒ6VÆV7F–öå&ævS°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡7F'E"ÂVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡7F'E"ÂVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡7F'D2ÂVæD2“°¢6öç7BÖ„2ÒÖF‚æÖ‚‡7F'D2ÂVæD2“° ¢G'’°¢–b†Ö–å"ÓÓÒÖ…"bbÖ–ä2ÓÓÒÖ„2’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶Ö–å%Ó°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶Ö–ä5Ó°¢6öç7BfÅ7G"ÒvWD6VÆÅfÇVT57G&–ær‡&÷rÂ6öÂ“°¢æf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡fÅ7G"“°¢ÒVÇ6R°¢6öç7B&÷w2ÒµÓ°¢f÷"†ÆWB’ÒÖ–å#²’ÃÒÖ…#²’²²’°¢6öç7B&÷ufÇ2ÒµÓ°¢f÷"†ÆWB¢ÒÖ–ä3²¢ÃÒÖ„3²¢²²’°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶¥Ó°¢&÷ufÇ2çW6‚†vWD6VÆÅfÇVT57G&–ær†f–ÇFW&VDæE6÷'FVDFF¶•ÒÂ6öÂ’“°¢Ð¢&÷w2çW6‚‡&÷ufÇ2æ¦ö–â‚%ÇB"’“°¢Ð¢æf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡&÷w2æ¦ö–â‚%Æâ"’“°¢Ð¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFò6÷’"ÂW'"“°¢Fö7BæW'&÷"€¢$¶Œ;FærFŽ¸26ò6Œ:—l:ò6Æ—&ö&BâgV’Ì;&ær¶ž¸6ÒG&Wž¸âG'W’>ª×â"À¢“°¢Ð¢ÒVÇ6R–b†7F—fT6VÆÂ’°¢G'’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶7F—fT6VÆÂç%Ó°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶7F—fT6VÆÂæ5Ó°¢6öç7BfÅ7G"ÒvWD6VÆÅfÇVT57G&–ær‡&÷rÂ6öÂ“°¢æf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡fÅ7G"“°¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"‚$f–ÆVBFò6÷’"ÂW'"“°¢Fö7BæW'&÷"€¢$¶Œ;FærFŽ¸26ò6Œ:—l:ò6Æ—&ö&BâgV’Ì;&ær¶ž¸6ÒG&Wž¸âG'W’>ª×â"À¢“°¢Ð¢Ð¢Ó° ¢6öç7B†æFÆT6VÆÄÖ÷W6TF÷vâÒW6T6ÆÆ&6²€¢†S¢&V7BäÖ÷W6TWfVçBÂ#¢çVÖ&W"Â3¢çVÖ&W"’Óâ°¢–b†Ræ'WGFöâÓÒ’&WGW&ã°¢6WD—56VÆV7F–ær‡G'VR“°¢ ¢òòfö7W2F†R67&öÆÂ6öçF–æW"FòÖ¶R7W&R'&÷r¶W—2æB7FRWfVçG2gVæ7F–öâ6÷'&V7FÇ¢–b‡67&öÆÄ6öçF–æW%&Vbæ7W'&VçB’°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçBæfö7W2‚“°¢Ð ¢–b†Rç6†–gD¶W’bb7F—fT6VÆÂ’°¢6öç7Bæ6†÷%"Òæ6†÷$6VÆÅ&Vbæ7W'&VçBòæ6†÷$6VÆÅ&Vbæ7W'&VçBç"¢‡6VÆV7F–öå&ævRò6VÆV7F–öå&ævRç7F'E"¢7F—fT6VÆÂç"“°¢6öç7Bæ6†÷$2Òæ6†÷$6VÆÅ&Vbæ7W'&VçBòæ6†÷$6VÆÅ&Vbæ7W'&VçBæ2¢‡6VÆV7F–öå&ævRò6VÆV7F–öå&ævRç7F'D2¢7F—fT6VÆÂæ2“°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æ6†÷%"À¢VæE#¢"À¢7F'D3¢æ6†÷$2À¢VæD3¢2À¢Ò“°¢6WD7F—fT6VÆÂ‡²"Â2Ò“°¢ÒVÇ6R°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²"Â2Ó°¢6WD7F—fT6VÆÂ‡²"Â2Ò“°¢6WE6VÆV7F–öå&ævR‡²7F'E#¢"ÂVæE#¢"Â7F'D3¢2ÂVæD3¢2Ò“°¢Ð¢ÒÀ¢¶7F—fT6VÆÂÂ6VÆV7F–öå&ævRÂ67&öÆÄ6öçF–æW%&VeÒÀ¢“° ¢6öç7B†æFÆT6VÆÄÖ÷W6TVçFW"ÒW6T6ÆÆ&6²€¢†S¢&V7BäÖ÷W6TWfVçBÂ#¢çVÖ&W"Â3¢çVÖ&W"’Óâ°¢–b†Ræ'WGFöç2ÓÓÒbb6VÆV7F–öå&ævR’°¢6WE6VÆV7F–öå&ævR‚‡&Wb’Óâ°¢–b‚&Wb’&WGW&âçVÆÃ°¢–b‡&WbæVæE"ÓÓÒ"bb&WbæVæD2ÓÓÒ2’&WGW&â&Wc°¢&WGW&â²ââç&WbÂVæE#¢"ÂVæD3¢2Ó°¢Ò“°¢6WD7F—fT6VÆÂ‡²"Â2Ò“°¢Ð¢ÒÀ¢·6VÆV7F–öå&ævUÒÀ¢“° ¢6öç7B†æFÆUF&ÆTÖ÷W6TÖ÷fRÒW6T6ÆÆ&6²€¢†S¢&V7BäÖ÷W6TWfVçCÄ…DÔÄF—dVÆVÖVçCâ’Óâ°¢–b‚—56VÆV7F–ærÇÂRæ'WGFöç2ÓÒ’&WGW&ã° ¢6öç7BVÂÒ67&öÆÄ6öçF–æW%&Vbæ7W'&VçC°¢–b‚VÂ’&WGW&ã° ¢6öç7B&V7BÒVÂævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢6öç7B†VFW$†V–v‡BÒVÂçVW'•6VÆV7F÷"‚'F†VB"“òæöfg6WD†V–v‡BÇÂC#°¢6öç7Bfö÷FW$†V–v‡BÒ‡6†÷tfö÷FW"òVÂçVW'•6VÆV7F÷"‚'Ffö÷B"“òæöfg6WD†V–v‡B¢’ÇÂ°¢6öç7B7F–6·”fö÷FW$VÂÒVÂçVW'•6VÆV7F÷"‚"ç7F–6·’æ&÷GFöÒÓ"’2…DÔÄVÆVÖVçC°¢6öç7BW‡G&fö÷FW"Ò7F–6·”fö÷FW$VÂò7F–6·”fö÷FW$VÂæöfg6WD†V–v‡B¢°¢6öç7B&÷GFöÕ6fWG’ÒÖF‚æÖ‚†fö÷FW$†V–v‡BÂW‡G&fö÷FW"Â3b’²c°¢6öç7BF÷6fWG’Ò†VFW$†V–v‡B²ƒ° ¢6öç7BÖ…7FWÒ3#°¢ÆWBFVÇF’Ò° ¢–b†Ræ6Æ–VçE’â&V7Bæ&÷GFöÒÒ&÷GFöÕ6fWG’’°¢FVÇF’ÒÖF‚æÖ‚ƒÂÖF‚æ6V–Â‚‚†Ræ6Æ–VçE’Ò‡&V7Bæ&÷GFöÒÒ&÷GFöÕ6fWG’’’ò3’¢Ö…7FW’“°¢ÒVÇ6R–b†Ræ6Æ–VçE’Â&V7BçF÷²F÷6fWG’’°¢FVÇF’ÒÔÖF‚æÖ‚ƒÂÖF‚æ6V–Â‚‚‚‡&V7BçF÷²F÷6fWG’’ÒRæ6Æ–VçE’’ò3’¢Ö…7FW’“°¢Ð ¢ÆWBFVÇF‚Ò°¢6öç7B&–v‡DVFvRÒ&V7Bç&–v‡BÒ3°¢6öç7BÆVgDVFvRÒ&V7BæÆVgB²3°¢–b†Ræ6Æ–VçE‚â&–v‡DVFvR’°¢FVÇF‚ÒÖF‚æÖ‚ƒÂÖF‚æ6V–Â‚‚†Ræ6Æ–VçE‚Ò&–v‡DVFvR’ò3’¢Ö…7FW’“°¢ÒVÇ6R–b†Ræ6Æ–VçE‚ÂÆVgDVFvR’°¢FVÇF‚ÒÔÖF‚æÖ‚ƒÂÖF‚æ6V–Â‚‚†ÆVgDVFvRÒRæ6Æ–VçE‚’ò3’¢Ö…7FW’“°¢Ð ¢–b†FVÇF‚ÓÒ’VÂç67&öÆÄÆVgB³ÒFVÇFƒ°¢–b†FVÇF’ÓÒ’VÂç67&öÆÅF÷³ÒFVÇF“°¢ÒÀ¢¶—56VÆV7F–ærÂ6†÷tfö÷FW%ÒÀ¢“° ¢òò¶W–&ö&B6†÷'F7WG0¢W6TVffV7B‚‚’Óâ°¢6öç7B†æFÆT¶W”F÷vâÒ†S¢¶W–&ö&DWfVçB’Óâ°¢–b†VF—F–æt6VÆÂ’°¢–b†Ræ¶W’ÓÓÒ$VçFW""bbRæÇD¶W’’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7B²"Â2ÒÒVF—F–æt6VÆÃ°¢6öÖÖ—DVF—B‚“°¢6öç7BæW‡E"ÒÖF‚æÖ–â‡"²Âf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚Ò“°¢6WD7F—fT6VÆÂ‡²#¢æW‡E"Â2Ò“°¢–b†æW‡E"ÓÒ"’6WEF–ÖV÷WB‚‚’Óâ7F'DVF—F–ær†æW‡E"Â2’Â“°¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ%F""’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7B²"Â2ÒÒVF—F–æt6VÆÃ°¢6öÖÖ—DVF—B‚“°¢ÆWBæW‡E"Ò"À¢æW‡D2Ò3°¢–b†Rç6†–gD¶W’’°¢–b†2â’æW‡D2Ò2Ò°¢VÇ6R–b‡"â’°¢æW‡E"Ò"Ò°¢æW‡D2Òf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò°¢Ð¢ÒVÇ6R°¢–b†2Âf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò’æW‡D2Ò2²°¢VÇ6R–b‡"Âf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚Ò’°¢æW‡E"Ò"²°¢æW‡D2Ò°¢Ð¢Ð¢6WD7F—fT6VÆÂ‡²#¢æW‡E"Â3¢æW‡D2Ò“°¢–b†æW‡E"ÓÒ"ÇÂæW‡D2ÓÒ2¢6WEF–ÖV÷WB‚‚’Óâ7F'DVF—F–ær†æW‡E"ÂæW‡D2’Â“°¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$W66R"’°¢Rç&WfVçDFVfVÇB‚“°¢6æ6VÄVF—B‚“°¢Ð¢&WGW&ã°¢Ð ¢–b€¢F&ÆU&Vbæ7W'&VçCòæ6öçF–ç2†Fö7VÖVçBæ7F—fTVÆVÖVçB’b`¢Fö7VÖVçBæ7F—fTVÆVÖVçBÓÒFö7VÖVçBæ&öG¢¢&WGW&ã°¢–b‚7F—fT6VÆÂ’&WGW&ã°¢6öç7B²"Â2ÒÒ7F—fT6VÆÃ° ¢6öç7Bæ6†÷%"Òæ6†÷$6VÆÅ&Vbæ7W'&VçBòæ6†÷$6VÆÅ&Vbæ7W'&VçBç"¢‡6VÆV7F–öå&ævRò6VÆV7F–öå&ævRç7F'E"¢"“°¢6öç7Bæ6†÷$2Òæ6†÷$6VÆÅ&Vbæ7W'&VçBòæ6†÷$6VÆÅ&Vbæ7W'&VçBæ2¢‡6VÆV7F–öå&ævRò6VÆV7F–öå&ævRç7F'D2¢2“° ¢–b†Ræ¶W’ÓÓÒ$'&÷tF÷vâ"’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BæW‡E"ÒRæ7G&Ä¶W’ÇÂRæÖWF¶W’ ¢òf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚Ò ¢¢ÖF‚æÖ–â‡"²Âf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚Ò“°¢6WD7F—fT6VÆÂ‡²#¢æW‡E"Â2Ò“°¢–b†Rç6†–gD¶W’’°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æ6†÷%"À¢7F'D3¢æ6†÷$2À¢VæE#¢æW‡E"À¢VæD3¢2À¢Ò“°¢ÒVÇ6R°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²#¢æW‡E"Â2Ó°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æW‡E"À¢VæE#¢æW‡E"À¢7F'D3¢2À¢VæD3¢2À¢Ò“°¢Ð¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$'&÷uW"’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BæW‡E"ÒRæ7G&Ä¶W’ÇÂRæÖWF¶W’ò¢ÖF‚æÖ‚‡"ÒÂ“°¢6WD7F—fT6VÆÂ‡²#¢æW‡E"Â2Ò“°¢–b†Rç6†–gD¶W’’°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æ6†÷%"À¢7F'D3¢æ6†÷$2À¢VæE#¢æW‡E"À¢VæD3¢2À¢Ò“°¢ÒVÇ6R°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²#¢æW‡E"Â2Ó°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æW‡E"À¢VæE#¢æW‡E"À¢7F'D3¢2À¢VæD3¢2À¢Ò“°¢Ð¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$'&÷u&–v‡B"’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BæW‡D2ÒRæ7G&Ä¶W’ÇÂRæÖWF¶W’ ¢òf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò ¢¢ÖF‚æÖ–â†2²Âf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò“°¢6WD7F—fT6VÆÂ‡²"Â3¢æW‡D2Ò“°¢–b†Rç6†–gD¶W’’°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æ6†÷%"À¢7F'D3¢æ6†÷$2À¢VæE#¢"À¢VæD3¢æW‡D2À¢Ò“°¢ÒVÇ6R°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²"Â3¢æW‡D2Ó°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢"À¢VæE#¢"À¢7F'D3¢æW‡D2À¢VæD3¢æW‡D2À¢Ò“°¢Ð¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$'&÷tÆVgB"’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BæW‡D2ÒRæ7G&Ä¶W’ÇÂRæÖWF¶W’ò¢ÖF‚æÖ‚†2ÒÂ“°¢6WD7F—fT6VÆÂ‡²"Â3¢æW‡D2Ò“°¢–b†Rç6†–gD¶W’’°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢æ6†÷%"À¢7F'D3¢æ6†÷$2À¢VæE#¢"À¢VæD3¢æW‡D2À¢Ò“°¢ÒVÇ6R°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²"Â3¢æW‡D2Ó°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢"À¢VæE#¢"À¢7F'D3¢æW‡D2À¢VæD3¢æW‡D2À¢Ò“°¢Ð¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ%F""’°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BæW‡D2ÒRç6†–gD¶W¢òÖF‚æÖ‚†2ÒÂ¢¢ÖF‚æÖ–â†2²Âf—6–&ÆT6öÇVÖç2æÆVæwF‚Ò“°¢æ6†÷$6VÆÅ&Vbæ7W'&VçBÒ²"Â3¢æW‡D2Ó°¢6WD7F—fT6VÆÂ‡²"Â3¢æW‡D2Ò“°¢6WE6VÆV7F–öå&ævR‡²7F'E#¢"ÂVæE#¢"Â7F'D3¢æW‡D2ÂVæD3¢æW‡D2Ò“°¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$VçFW""ÇÂRæ¶W’ÓÓÒ$c""’°¢Rç&WfVçDFVfVÇB‚“°¢7F'DVF—F–ær‡"Â2“°¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ&"bb†Ræ7G&Ä¶W’ÇÂRæÖWF¶W’’’°¢Rç&WfVçDFVfVÇB‚“°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢À¢VæE#¢f–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÒÀ¢7F'D3¢À¢VæD3¢f—6–&ÆT6öÇVÖç2æÆVæwF‚ÒÀ¢Ò“°¢6öç7BÆÄ–G2ÒæWr6WB†f–ÇFW&VDæE6÷'FVDFFæÖ‡"Óâ"æ–B’“°¢6WE6VÆV7FVE&÷t–G2†ÆÄ–G2“°¢–b†öå6VÆV7F–öä6†ævR’°¢öå6VÆV7F–öä6†ævR†f–ÇFW&VDæE6÷'FVDFFæf–ÇFW"‡"ÓâÆÄ–G2æ†2‡"æ–B’’“°¢Ð¢ÒVÇ6R–b†Ræ¶W’ÓÓÒ$FVÆWFR"ÇÂRæ¶W’ÓÓÒ$&6·76R"’°¢–b†öä6VÆÄ6†ævR’°¢–b‡6VÆV7F–öå&ævR’°¢6öç7B²7F'E"ÂVæE"Â7F'D2ÂVæD2ÒÒ6VÆV7F–öå&ævS°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡7F'E"ÂVæE"’À¢Ö…"ÒÖF‚æÖ‚‡7F'E"ÂVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡7F'D2ÂVæD2’À¢Ö„2ÒÖF‚æÖ‚‡7F'D2ÂVæD2“°¢f÷"†ÆWB’ÒÖ–å#²’ÃÒÖ…#²’²²’°¢f÷"†ÆWB¢ÒÖ–ä3²¢ÃÒÖ„3²¢²²’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶•Ó°¢öä6VÆÄ6†ævR‡&÷rÂf—6–&ÆT6öÇVÖç5¶¥Òæ¶W’Â""“°¢Ð¢Ð¢Fö7Bç7V66W72€¢I:2Œ;6NºòÆž¸wRG&öærG²†Ö…"ÒÖ–å"²’¢†Ö„2ÒÖ–ä2²—Ò;FÀ¢“°¢ÒVÇ6R°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF·%Ó°¢öä6VÆÄ6†ævR‡&÷rÂf—6–&ÆT6öÇVÖç5¶5Òæ¶W’Â""“°¢Ð¢Ð¢ÒVÇ6R–b‚†Ræ7G&Ä¶W’ÇÂRæÖWF¶W’’bbRæ¶W’çFôÆ÷vW$66R‚’ÓÓÒ&"’°¢Rç&WfVçDFVfVÇB‚“°¢–b‡6VÆV7F&ÆR’°¢FövvÆTÆÂ‚“°¢ÒVÇ6R°¢6WE6VÆV7F–öå&ævR‡°¢7F'E#¢À¢VæE#¢f–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÒÀ¢7F'D3¢À¢VæD3¢f—6–&ÆT6öÇVÖç2æÆVæwF‚ÒÀ¢Ò“°¢Ð¢ÒVÇ6R–b‚†Ræ7G&Ä¶W’ÇÂRæÖWF¶W’’bbRæ¶W’çFôÆ÷vW$66R‚’ÓÓÒ&2"’°¢Rç&WfVçDFVfVÇB‚“°¢6÷•6VÆV7F–öâ‚“°¢ÒVÇ6R–b€¢õå¶×¤Õ£Ó•ÒBòçFW7B†Ræ¶W’’b`¢Ræ7G&Ä¶W’b`¢RæÖWF¶W’b`¢RæÇD¶W¢’°¢Rç&WfVçDFVfVÇB‚“°¢7F'DVF—F–ær‡"Â2ÂG'VR“°¢6WDVF—EfÇVR†Ræ¶W’“°¢Ð¢Ó° ¢6öç7B†æFÆU7FRÒ†S¢6Æ—&ö&DWfVçB’Óâ°¢–b†VF—F–æt6VÆÂ’&WGW&ã°¢–b€¢Fö7VÖVçBæ7F—fTVÆVÖVçCòçFtæÖRÓÓÒ$”åUB"ÇÀ¢Fö7VÖVçBæ7F—fTVÆVÖVçCòçFtæÖRÓÓÒ%DU…D$T ¢’°¢&WGW&ã°¢Ð¢–b€¢F&ÆU&Vbæ7W'&VçCòæ6öçF–ç2†Fö7VÖVçBæ7F—fTVÆVÖVçB’b`¢Fö7VÖVçBæ7F—fTVÆVÖVçBÓÒFö7VÖVçBæ&öG¢’°¢&WGW&ã°¢Ð¢–b‚7F—fT6VÆÂÇÂöä6VÆÄ6†ævR’&WGW&ã° ¢6öç7BFW‡BÒRæ6Æ—&ö&DFFòævWDFF‚'FW‡B"’ÇÂ"#°¢–b‚FW‡B’&WGW&ã° ¢Rç&WfVçDFVfVÇB‚“° ¢6öç7B²"Â2ÒÒ7F—fT6VÆÃ°¢6öç7B&÷w2ÒFW‡Bç7Æ—B‚õÇ#õÆâò“°¢–b‡&÷w2æÆVæwF‚âbb&÷w5·&÷w2æÆVæwF‚ÒÒçG&–Ò‚’ÓÓÒ""’°¢&÷w2ç÷‚“°¢Ð ¢6öç7B'6VDw&–BÒ&÷w2æÖ‚‡&÷uFW‡B’Óâ&÷uFW‡Bç7Æ—B‚%ÇB"’“°¢6öç7B6Æ—&÷w2Ò'6VDw&–BæÆVæwFƒ°¢6öç7B6Æ—6öÇ2Ò'6VDw&–E³ÓòæÆVæwF‚ÇÂ° ¢–b‡6VÆV7F–öå&ævR’°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢6öç7BÖ„2ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢6öç7B&ævU&÷w2ÒÖ…"ÒÖ–å"²°¢6öç7B&ævT6öÇ2ÒÖ„2ÒÖ–ä2²° ¢–b‡&ævU&÷w2âÇÂ&ævT6öÇ2â’°¢f÷"†ÆWB’ÒÖ–å#²’ÃÒÖ…#²’²²’°¢6öç7B$–G„–ä6Æ—Ò†’ÒÖ–å"’R6Æ—&÷w3°¢f÷"†ÆWB¢ÒÖ–ä3²¢ÃÒÖ„3²¢²²’°¢6öç7B4–G„–ä6Æ—Ò†¢ÒÖ–ä2’R6Æ—6öÇ3°¢6öç7B6VÆÅfÂÐ¢'6VDw&–E·$–G„–ä6Æ—Òb`¢'6VDw&–E·$–G„–ä6Æ—Õ¶4–G„–ä6Æ—ÒÓÒVæFVf–æV@¢ò'6VDw&–E·$–G„–ä6Æ—Õ¶4–G„–ä6Æ—ÒçG&–Ò‚¢¢"#°¢6öç7BF&vWE&÷rÒf–ÇFW&VDæE6÷'FVDFF¶•Ó°¢–b‡F&vWE&÷rbbf—6–&ÆT6öÇVÖç5¶¥Ò’°¢öä6VÆÄ6†ævR‡F&vWE&÷rÂf—6–&ÆT6öÇVÖç5¶¥Òæ¶W’Â6VÆÅfÂ“°¢Ð¢Ð¢Ð¢Fö7Bç7V66W72†I:2L:âNºòÆž¸wRl:òl;–ær6Ž¸Öâ‚G·&ævU&÷w7×‚G·&ævT6öÇ7Ò;B–“°¢&WGW&ã°¢Ð¢Ð ¢'6VDw&–Bæf÷$V6‚‚‡&÷t6VÆÇ2Â$öfg6WB’Óâ°¢&÷t6VÆÇ2æf÷$V6‚‚†6VÆÅFW‡BÂ4öfg6WB’Óâ°¢6öç7BF&vWE"Ò"²$öfg6WC°¢6öç7BF&vWD2Ò2²4öfg6WC°¢–b€¢F&vWE"Âf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚b`¢F&vWD2Âf—6–&ÆT6öÇVÖç2æÆVæwF€¢’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF·F&vWE%Ó°¢öä6VÆÄ6†ævR€¢&÷rÀ¢f—6–&ÆT6öÇVÖç5·F&vWD5Òæ¶W’À¢6VÆÅFW‡BçG&–Ò‚’À¢“°¢Ð¢Ò“°¢Ò“°¢Fö7Bç7V66W72‚,I:2L:âNºòÆž¸wR"“°¢Ó° ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Â†æFÆT¶W”F÷vâ“°¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'7FR"Â†æFÆU7FR“°¢&WGW&â‚’Óâ°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Â†æFÆT¶W”F÷vâ“°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚'7FR"Â†æFÆU7FR“°¢Ó°¢ÒÂ°¢f–ÇFW&VDæE6÷'FVDFFÀ¢7F—fT6VÆÂÀ¢VF—F–æt6VÆÂÀ¢VF—EfÇVRÀ¢f—6–&ÆT6öÇVÖç2À¢—4VF—F&ÆRÀ¢öä6VÆÄ6†ævRÀ¢6VÆV7F–öå&ævRÀ¢Ò“° ¢6öç7BF÷FÅF&ÆUv–GF‚Ð¢‡6VÆV7F&ÆRòSb¢’°¢‡6†÷u&÷tçVÖ&W"òS¢’°¢f—6–&ÆT6öÇVÖç2ç&VGV6R‚‡7VÒÂ6öÂ’Óâ°¢6öç7BrÒ6öÇVÖåv–GF‡5¶6öÂæ¶W•ÒÇÂ6öÂçv–GF‚ÇÂS°¢&WGW&â7VÒ²‡G—VöbrÓÓÒ&çVÖ&W""òr¢'6T–çB…7G&–ær‡r’’ÇÂS“°¢ÒÂ“° ¢6öç7BFVç6—G•7G–ÆW2Ò°¢6ö×7C¢°¢FF–æs¢#'‚G‚"À¢föçE6—¦S¢#ãw&VÒ"À¢†VFW$föçE6—¦S¢#ãc#W&VÒ"À¢ÒÀ¢æ÷&ÖÃ¢°¢FF–æs¢#2ãW‚w‚"À¢föçE6—¦S¢#ãsW&VÒ"À¢†VFW$föçE6—¦S¢#ãcƒsW&VÒ"À¢ÒÀ¢&VÆ†VC¢°¢FF–æs¢#g‚'‚"À¢föçE6—¦S¢#ã‡&VÒ"À¢†VFW$föçE6—¦S¢#ãsW&VÒ"À¢ÒÀ¢Ó° ¢6öç7B&VæFW$†VFW$6VÆÂÒ†6öÃ¢6öÇVÖâÂ4–Gƒ¢çVÖ&W"Â&÷u7ã¢çVÖ&W"ÒÂF÷¢7G&–ærÒ'F÷Ó"’Óâ°¢6öç7B—46öÄ7F—fRÐ¢7F—fT6VÆÃòæ2ÓÓÒ4–G‚ÇÀ¢‡6VÆV7F–öå&ævRb`¢4–G‚ãÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2’b`¢4–G‚ÃÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2’“°¢6öç7B6öÅv–GF‚Ò6öÇVÖåv–GF‡5¶6öÂæ¶W•ÒÇÂ6öÂçv–GFƒ°¢6öç7Bv–GF…7G–ÆRÒ6öÅv–GF€¢òG—Vöb6öÅv–GF‚ÓÓÒ&çVÖ&W" ¢òG¶6öÅv–GF‡×† ¢¢6öÅv–GF€¢¢VæFVf–æVC° ¢6öç7B—46öÄf–ÇFW&VBÒ6öÇVÖäf–ÇFW'5¶6öÂæ¶W•Ò–ç7Fæ6Vöb6WBbb6öÇVÖäf–ÇFW'5¶6öÂæ¶W•Òç6—¦Râ°¢6öç7Bw&÷W†VFW$6Æ72Ð¢6öÂæw&÷WÓÓÒ%DŒ9DärD”â4…Tär ¢ò‡&÷u7âÓÓÒ"ò&VF—BÖw&÷WÖ6öÖÖöâÖ†VFW""¢&VF—BÖw&÷WÖ6öÖÖöâ×7V"Ö†VFW""¢¢6öÂæw&÷WÓÓÒ$4„’Dž«åBtž¹ÂÌ8ÒD ¢ò‡&÷u7âÓÓÒ"ò&VF—BÖw&÷WÖ†÷W'2Ö†VFW""¢&VF—BÖw&÷WÖ†÷W'2×7V"Ö†VFW""¢¢"#°¢6öç7BFVfVÇD†VFW$&rÒ&&rÕ²4c„dd5ÒF&³¦&r×6ÆFRÓƒFW‡B×6ÆFRÓƒF&³§FW‡B×6ÆFRÓ##°¢6öç7Bf–ÇFW&VD†VFW$6Æ72Ò—46öÄf–ÇFW&V@¢ò&&rÕ²4dTc43uÒF&³¦&rÖÖ&W"Ó“SóC&÷&FW"ÖÖ&W"Ó3FW‡BÖÖ&W"Ó“föçBÖW‡G&&öÆB ¢¢†w&÷W†VFW$6Æ72ÇÂ†VFW$6Æ74æÖRÇÂFVfVÇD†VFW$&r“° ¢&WGW&â€¢ÇF€¢¶W“×¶6öÂæ¶W—Ð¢&÷u7ã×·&÷u7çÐ¢öäÖ÷W6TF÷vã×²†R’Óâ†æFÆT†VFW$Ö÷W6TF÷vâ†RÂ4–G‚—Ð¢öäÖ÷W6TVçFW#×²†R’Óâ†æFÆT†VFW$Ö÷W6TVçFW"†RÂ4–G‚—Ð¢öä6öçFW‡DÖVçS×²†R’Óâ†æFÆT6öçFW‡DÖVçR†RÂÓÂ4–G‚—Ð¢6Æ74æÖS×¶&VÆF—fR7F–6·’G·F÷Ò¢Õ³cÒv†—FW76RÖæ÷&ÖÂ7W'6÷"×ö–çFW"6VÆV7BÖæöæRw&÷W&÷&FW"Ö"&÷&FW"×"&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â44$CTS•ÒFW‡BÖ6VçFW"G¶f–ÇFW&VD†VFW$6Æ77ÒG¶6öÂæ†VFW$6Æ74æÖRÇÂ"'ÒFW‡BÕ·f"‚ÒÖ†VFW"ÖföçB×6—¦RÃãcƒsW&VÒ•ÒföçBÖ&öÆBWW&66VÐ¢7G–ÆS×·°¢FF–æs¢'f"‚Ò×F&ÆR×FF–ærÂã#W&VÒãG&VÒ’"À¢v–GFƒ¢v–GF…7G–ÆRÀ¢Ö–åv–GFƒ¢v–GF…7G–ÆRÀ¢Ö…v–GFƒ¢v–GF…7G–ÆRÀ¢÷fW&fÆ÷s¢'f—6–&ÆR"À¢fW'F–6ÄÆ–vã¢&Ö–FFÆR"À¢×Ð¢à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"§W7F–g’Ö6VçFW"‚ÖgVÆÂ‚Ó"&VÆF—fR¢Ó#à¢Ç7à¢6Æ74æÖS×¶G&ç6—F–öâÖ6öÆ÷'2fÆW‚ÓfÆW‚fÆW‚Ö6öÂÖC¦fÆW‚×&÷r—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓG¶6öÂç6÷'F&ÆRÓÒfÇ6Rò&†÷fW#§FW‡BÖ66VçBóƒ7F—fS§66ÆRÕ³ã“…Ò7W'6÷"×ö–çFW""¢"'ÒG¶6öÂæ†VFW%7ä6Æ74æÖRÇÂ"'ÖÐ¢öä6Æ–6³×²†R’Óâ°¢–b†6öÂç6÷'F&ÆRÓÒfÇ6R’°¢Rç7F÷&÷vF–öâ‚“°¢†æFÆU6÷'B†6öÂæ¶W’“°¢Ð¢×Ð¢F—FÆS×¶6öÂç6÷'F&ÆRÓÒfÇ6Rò$æŽªWI¸2>ª÷Ž«÷…LH6ærNªvâ(i"vžª6ÒNªvâ(i"Žºw’>ª÷Ž«÷’"¢VæFVf–æVGÐ¢à¢Ç7ãç¶6öÂæÆ&VÇÓÂ÷7ãà¢¶6öÂç6÷'F&ÆRÓÒfÇ6Rbb6÷'D6öæf–sòæ¶W’ÓÓÒ6öÂæ¶W’bb€¢ÆF—b6Æ74æÖSÒ&–æÆ–æRÖfÆW‚—FV×2Ö6VçFW"vÓãRÖÂÓãR6‡&–æ²Ó#à¢Ç7â6Æ74æÖSÒ'FW‡BÖ66VçBfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"föçBÖ&öÆB#à¢·6÷'D6öæf–ræF—&V7F–öâÓÓÒ&62"ò€¢Ä6†Wg&öåW6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR7G&ö¶RÕ³"ãUÒ"óà¢’¢€¢Ä6†Wg&öäF÷vâ6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR7G&ö¶RÕ³"ãUÒ"óà¢—Ð¢Â÷7ãà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢öä6Æ–6³×²†R’Óâ°¢Rç7F÷&÷vF–öâ‚“°¢Rç&WfVçDFVfVÇB‚“°¢†æFÆU6÷'B†6öÂæ¶W’ÂçVÆÂ“°¢×Ð¢6Æ74æÖSÒ'ÓãR&÷VæFVB†÷fW#¦&r×&÷6RÓF&³¦†÷fW#¦&r×&÷6RÓ“óCFW‡BÖ×WFVBÖf÷&Vw&÷VæB†÷fW#§FW‡B×&÷6RÓcG&ç6—F–öâÖ6öÆ÷'27W'6÷"×ö–çFW" ¢F—FÆSÒ%Œ;6>ª÷Ž«÷>¹—Bì:’ ¢&–ÖÆ&VÃÒ%Œ;6>ª÷Ž«÷>¹—Bì:’ ¢à¢Å‚6Æ74æÖSÒ'rÓ2‚Ó27G&ö¶RÕ³"ãUÒ"óà¢Âö'WGFöãà¢ÂöF—cà¢—Ð¢Â÷7ãà¢¶6öÂæf–ÇFW&&ÆRÓÒfÇ6Rbb€¢Ä6öÇVÖäf–ÇFW ¢6öÇVÖã×¶6öÇÐ¢ÆÄFF×¶FFÐ¢f–ÇFW%7FFS×¶6öÇVÖäf–ÇFW'7Ð¢öäf–ÇFW$6†ævS×¶†æFÆTf–ÇFW$6†ævWÐ¢öå6÷'C×¶†æFÆU6÷'GÐ¢6÷'D6öæf–s×·6÷'D6öæf–wÐ¢6V&6…FW&Ó×¶FV&÷Væ6VE6V&6…FW&×Ð¢óà¢—Ð¢ÂöF—cà¢·&W6—¦&ÆT6öÇVÖç2bb€¢ÆF—`¢öäÖ÷W6TF÷vã×²†R’Óâ†æFÆU&W6—¦U7F'B†RÂ6öÂæ¶W’—Ð¢öäF÷V&ÆT6Æ–6³×²‚’Óâ†æFÆU&W6—¦TF÷V&ÆT6Æ–6²†6öÂæ¶W’—Ð¢6Æ74æÖS×¶'6öÇWFR×&–v‡BÕ³‡…ÒF÷Ó&÷GFöÒÓrÕ³g…Ò7W'6÷"Ö6öÂ×&W6—¦Rw&÷W÷&W6—¦W"¢Õ³sÒfÆW‚§W7F–g’Ö6VçFW&Ð¢à¢ÆF—`¢6Æ74æÖS×¶rÕ³…Ò‚ÖgVÆÂG&ç6—F–öâÖ6öÆ÷'2&r×G&ç7&VçBw&÷WÖ†÷fW"÷&W6—¦W#¦&rÖ66VçBóCG·&W6—¦–æt6öÃòæ¶W’ÓÓÒ6öÂæ¶W’ò&&rÖ66VçB"¢"'ÖÐ¢óà¢ÂöF—cà¢—Ð¢Â÷Fƒà¢“°¢Ó° ¢&WGW&â€¢Ãà¢²††47F—fTf–ÇFW'2ÇÂ6÷'D6öæf–r’bb€¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâ‚ÓR’Ó"ãR&rÕ²4dTc43uÒF&³¦&rÖÖ&W"Ó“Só#&÷&FW"Ö"Ó"&÷&FW"ÖÖ&W"Ó3F&³¦&÷&FW"ÖÖ&W"Óƒ6‡&–æ²ÓFW‡BÖÖ&W"Ó“F&³§FW‡BÖÖ&W"Ó6†F÷r×6Ò&VÆF—fR¢ÓSfÆW‚×w&vÓ"#à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ2FW‡B×‡2föçBÖW‡G&&öÆBWW&66RG&6¶–ær×v–FW"fÆW‚×w&#à¢¶†47F—fTf–ÇFW'2bb€¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓãR#à¢Ç7â6Æ74æÖSÒ&fÆW‚‚Ó"ãRrÓ"ãR&÷VæFVBÖgVÆÂ&rÖÖ&W"ÓSæ–ÖFR×VÇ6R6‡&–æ²Ó"óà¢Ç7ãäÎ¸Ä3¢Nª’>¹—B¶7F—fTf–ÇFW'2æÖ†bÓâ"G¶bæÆ&VÂçFõWW$66R‚—Ò&’æ¦ö–â‚"Â"—ÓÂ÷7ãà¢ÂöF—cà¢—Ð¢·6÷'D6öæf–rbb€¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓãR&rÖÖ&W"Ó#óƒF&³¦&rÖÖ&W"Ó“óS‚Ó"ãR’Ó&÷VæFVBFW‡BÖÖ&W"Ó“SF&³§FW‡BÖÖ&W"Ó&÷&FW"&÷&FW"ÖÖ&W"Ó3#à¢Ä'&÷uWF÷vâ6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡BÖ66VçB"óà¢Ç7ãà¢>ªåŽ«å¢'¶6öÇVÖç2æf–æB†2Óâ2æ¶W’ÓÓÒ6÷'D6öæf–ræ¶W’“òæÆ&VÃòçFõWW$66R‚’ÇÂ6÷'D6öæf–ræ¶W—Ò"‡·6÷'D6öæf–ræF—&V7F–öâÓÓÒ&62"ò%LH$ärNªdâ(i"¢$tžª$ÒNªdâ(i2'Ò¢Â÷7ãà¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"#à¢·6÷'D6öæf–rbb€¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6WE6÷'D6öæf–r†çVÆÂ“°¢Fö7Bç7V66W72‚,I:2Œ;6>ª÷Ž«÷>¹—B"“°¢×Ð¢6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"&r×&÷6RÓ†÷fW#¦&r×&÷6RÓ#FW‡B×&÷6RÓsF&³¦&r×&÷6RÓ“SócF&³¦†÷fW#¦&r×&÷6RÓ“ósF&³§FW‡B×&÷6RÓ#‚Ó2’ÓãR&÷VæFVBÖÆrG&ç6—F–öâÖÆÂ7W'6÷"×ö–çFW"6†F÷r×6Ò7F—fS§66ÆRÓ“R&÷&FW"&÷&FW"×&÷6RÓ3fÆW‚—FV×2Ö6VçFW"vÓ ¢à¢Å‚6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR7G&ö¶RÕ³"ãUÒ"óà¢Œ;6>ª÷Ž«÷ ¢Âö'WGFöãà¢—Ð¢¶†47F—fTf–ÇFW'2bb€¢Æ'WGFöà¢öä6Æ–6³×¶6ÆV$ÆÄf–ÇFW'7Ð¢6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"&rÖÖ&W"Ó#óc†÷fW#¦&rÖÖ&W"Ó#F&³¦&rÖÖ&W"Ó“ó3F&³¦†÷fW#¦&rÖÖ&W"Ó“óS‚Ó2’ÓãR&÷VæFVBÖÆrG&ç6—F–öâÖÆÂ7W'6÷"×ö–çFW"6†F÷r×6Ò7F—fS§66ÆRÓ“R&÷&FW"&÷&FW"ÖÖ&W"Ó3óSfÆW‚—FV×2Ö6VçFW"vÓ ¢à¢Å‚6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Œ;6NªWB>ª2.¹’Î¸Ö0¢Âö'WGFöãà¢—Ð¢ÂöF—cà¢ÂöF—cà¢—Ð¢ÆF—`¢&Vc×·F&ÆU&VgÐ¢6Æ74æÖS×¶fÆW‚fÆW‚Ö6öÂfÆW‚ÓÖ–âÖ‚ÓrÖgVÆÂÖ‚×rÖgVÆÂ÷WFÆ–æRÖæöæR÷fW&fÆ÷rÖ†–FFVâ&VÆF—fRÂÓG¶6Æ74æÖRÇÂ"'ÒG¶†47F—fTf–ÇFW'2ò&&rÖÖ&W"ÓSõ³ãUÒ"¢"'ÒFF×F&ÆR×w&W"VF—BÖFF×F&ÆR×w&W&Ð¢7G–ÆS×°¢°¢"Ò×F&ÆR×FF–ær#¢FVç6—G•7G–ÆW5·&÷tFVç6—G•ÒçFF–ærÀ¢"ÒÖföçB×6—¦R#¢FVç6—G•7G–ÆW5·&÷tFVç6—G•ÒæföçE6—¦RÀ¢"ÒÖ†VFW"ÖföçB×6—¦R#¢FVç6—G•7G–ÆW5·&÷tFVç6—G•Òæ†VFW$föçE6—¦RÀ¢&÷&FW%v–GFƒ¢†47F—fTf–ÇFW'2ò#'‚"¢#ãW‚"À¢&÷&FW$6öÆ÷#¢†47F—fTf–ÇFW'2ò"6f&&c#B"¢VæFVf–æVBÀ¢&÷&FW%&F—W3¢#‚"À¢ââæ7W7FöÕ7G–ÆRÀ¢Ò2ç¢Ð¢à¢²ò¢F&ÆR67&öÆÂ6öçF–æW"(	Bf—'GVÂ67&öÆÆ–ær†÷7B¢÷Ð¢ÆF—`¢&Vc×·67&öÆÄ6öçF–æW%&VgÐ¢F$–æFWƒ×³Ð¢6Æ74æÖSÒ'F&ÆRÖ&öG’×&Vv–öâ&VÆF—fRÖ"ÓÖ–âÖ‚ÓrÖgVÆÂÖ‚×rÖgVÆÂfÆW‚Ó÷fW&fÆ÷r×‚ÖWFò÷fW&fÆ÷r×’×67&öÆÂ&÷VæFVBÖæöæR&÷&FW"Ó&r×G&ç7&VçB÷6—G’Ó÷WFÆ–æRÖæöæR7W7FöÒ×67&öÆÆ&" ¢öäfö7W3×²‚’Óâ7F—fT6VÆÂbb6WD7F—fT6VÆÂ‡²#¢Â3¢Ò—Ð¢ ¢öäÖ÷W6TÖ÷fS×¶†æFÆUF&ÆTÖ÷W6TÖ÷fWÐ¢7G–ÆS×·²÷fW'67&öÆÄ&V†f–÷#¢&6öçF–â"ÂÖ&v–ä&÷GFöÓ¢#‚"Â÷fW&fÆ÷tæ6†÷#¢&æöæR"×Ð¢à¢·&W6—¦–ætÆ–æTÆVgBÓÒçVÆÂbb€¢ÆF—`¢6Æ74æÖSÒ&'6öÇWFRF÷Ó&÷GFöÒÓrÕ³'…Ò&rÖ66VçB¢Õ³Òö–çFW"ÖWfVçG2ÖæöæR ¢7G–ÆS×·°¢ÆVgC¢&W6—¦–ætÆ–æTÆVgBÀ¢×Ð¢óà¢—Ð ¢ÇF&ÆP¢6Æ74æÖS×¶&÷&FW"×6W&FR&÷&FW"×76–ærÓF&ÆRÖf—†VB&÷&FW"ÖÂ&÷&FW"×B&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â4S$S„c•Ò&r×v†—FRG¶—56VÆV7F–ærò'6VÆV7BÖæöæR"¢"'ÖÐ¢7G–ÆS×·°¢v–GFƒ¢F÷FÅF&ÆUv–GF‚À¢Ö–åv–GFƒ¢F÷FÅF&ÆUv–GF‚À¢Ö–ä†V–v‡C¢v–æFVDFFæÆVæwF‚ÓÓÒòC¢À¢&÷&FW%v–GFƒ¢#‚"À¢×Ð¢à¢Æ6öÆw&÷Wà¢²ò¢·6VÆV7F&ÆRbbÆ6öÂ7G–ÆS×·²v–GFƒ¢Sb×ÒóçÒ¢÷Ð¢·6†÷u&÷tçVÖ&W"bbÆ6öÂ7G–ÆS×·²v–GFƒ¢S×ÒóçÐ¢·f—6–&ÆT6öÇVÖç2æÖ‚†6öÂ’Óâ°¢6öç7B6öÅv–GF‚Ò6öÇVÖåv–GF‡5¶6öÂæ¶W•ÒÇÂ6öÂçv–GF‚ÇÂS°¢6öç7Bv–GF…7G–ÆRÒ6öÅv–GF€¢òG—Vöb6öÅv–GF‚ÓÓÒ&çVÖ&W" ¢òG¶6öÅv–GF‡×† ¢¢6öÅv–GF€¢¢#S‚#°¢&WGW&â€¢Æ6öÂ¶W“×¶6öÂÒG¶6öÂæ¶W—ÖÒ7G–ÆS×·²v–GFƒ¢v–GF…7G–ÆR×Òóà¢“°¢Ò—Ð¢Âö6öÆw&÷Wà¢ÇF†VB6Æ74æÖSÒ'7F–6·’F÷Ó¢Õ³cÒ&r×v†—FR#à¢²ò¢w&÷WVB†VFW'2&÷r–bç’6öÇVÖâ†2w&÷WFVf–æVB¢÷Ð¢¶6öÇVÖç2ç6öÖR†2Óâ2æw&÷W’bb€¢ÇG"6Æ74æÖSÒ&‚Õ³3…Ò#à¢·6†÷u&÷tçVÖ&W"bb€¢ÇF‚ ¢&÷u7ã×³'Ò ¢6Æ74æÖS×¶7F–6·’F÷Ó¢Õ³sÒrÕ³S…ÒÖ–â×rÕ³S…ÒFW‡BÖ6VçFW"&rÕ²4c„dd5ÒF&³¦&r×6ÆFRÓƒ&÷&FW"Ö"&÷&FW"×"&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â44$CTS•Ò’ÓFW‡BÕ·f"‚ÒÖ†VFW"ÖföçB×6—¦RÃãcƒsW&VÒ•ÒföçBÖ&öÆBWW&66RFW‡B×6ÆFRÓƒF&³§FW‡B×6ÆFRÓ#w&÷WöæöÐ¢7G–ÆS×·²fW'F–6ÄÆ–vã¢&Ö–FFÆR"×Ð¢à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ#à¢Ç7ãäæòãÂ÷7ãà¢Æ'WGFöâ ¢G—SÒ&'WGFöâ ¢öä6Æ–6³×²†R’Óâ²Rç7F÷&÷vF–öâ‚“²WFôf—DÆÄ6öÇVÖç2‚“²×Ð¢6Æ74æÖSÒ&÷6—G’Óc†÷fW#¦÷6—G’Ófö7W2×f—6–&ÆS¦÷6—G’ÓG&ç6—F–öâÖ÷6—G’ÓãR†÷fW#¦&rÖ66VçBó&÷VæFVBFW‡BÖ66VçB7W'6÷"×ö–çFW" ¢F—FÆSÒ%N»I¹–ær<H6â6Ž¸–æ‚NªWB>ª2>¹—B ¢&–ÖÆ&VÃÒ%N»I¹–ær<H6â6Ž¸–æ‚NªWB>ª2>¹—B ¢à¢ÄÖ†–Ö—¦S"6Æ74æÖSÒ'rÓ2‚Ó2"óà¢Âö'WGFöãà¢ÂöF—cà¢Â÷Fƒà¢—Ð¢²‚‚’Óâ°¢6öç7Bw&÷W–æw3¢²w&÷W¢7G&–ærÂVæFVf–æVBÂ6÷VçC¢çVÖ&W"Â7F'D–Gƒ¢çVÖ&W"Â6öÇ3¢6öÇVÖåµÒÕµÒÒµÓ°¢f—6–&ÆT6öÇVÖç2æf÷$V6‚‚†6öÂÂ–G‚’Óâ°¢6öç7BÆ7BÒw&÷W–æw5¶w&÷W–æw2æÆVæwF‚ÒÓ°¢–b†Æ7Bbb6öÂæw&÷WbbÆ7Bæw&÷WÓÓÒ6öÂæw&÷W’°¢Æ7Bæ6÷VçB²³°¢Æ7Bæ6öÇ2çW6‚†6öÂ“°¢ÒVÇ6R–b†Æ7Bbb6öÂæw&÷WbbÆ7Bæw&÷W’°¢Æ7Bæ6÷VçB²³°¢Æ7Bæ6öÇ2çW6‚†6öÂ“°¢ÒVÇ6R°¢w&÷W–æw2çW6‚‡²w&÷W¢6öÂæw&÷WÂ6÷VçC¢Â7F'D–Gƒ¢–G‚Â6öÇ3¢¶6öÅÒÒ“°¢Ð¢Ò“° ¢&WGW&âw&÷W–æw2æÖ‚†rÂ–G‚’Óâ°¢–b†ræw&÷W’°¢6öç7Bw&÷W6Æ72Ð¢ræw&÷WÓÓÒuDŒ9DärD”â4…TärròvVF—BÖw&÷WÖ6öÖÖöâÖ†VFW"r ¢ræw&÷WÓÓÒt4„’Dž«åBtž¹ÂÌ8ÒDròvVF—BÖw&÷WÖ†÷W'2Ö†VFW"r ¢†VFW$6Æ74æÖRÇÂ&&rÕ²4ccTc•Ò#°¢&WGW&â€¢ÇF‚ ¢¶W“×¶w'ÒG¶–G‡ÖÒ ¢6öÅ7ã×¶ræ6÷VçGÐ¢6Æ74æÖS×¶7F–6·’F÷Ó¢Õ³sÒ‚Õ³3…ÒG¶w&÷W6Æ77Ò&÷&FW"Ö"&÷&FW"×"&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â44$CTS•Ò‚Ó"’ÓFW‡BÕ³…ÒföçBÖ&Æ6²G&6¶–ær×v–FW"WW&66RFW‡BÖ6VçFW"6VÆV7BÖæöæVÐ¢7G–ÆS×·²fW'F–6ÄÆ–vã¢&Ö–FFÆR"×Ð¢à¢¶ræw&÷WÐ¢Â÷Fƒà¢“°¢ÒVÇ6R°¢òò–æF—f–GVÂ6öÇVÖâv—F‚æòw&÷WÒ&VæFW&–ær&÷u7ãÓ ¢&WGW&âræ6öÇ2æÖ‚†6öÂÂ6öÄ–G‚’Óâ ¢&VæFW$†VFW$6VÆÂ†6öÂÂrç7F'D–G‚²6öÄ–G‚Â"Â'F÷Ó"¢“°¢Ð¢Ò“°¢Ò’‚—Ð¢Â÷G#à¢—Ð¢ÇG"6Æ74æÖS×¶‚Õ³3…ÒG¶†VFW$6Æ74æÖRò""¢&&rÕ²4c„dd5Ò'ÖÓà¢·6VÆV7F&ÆRbb6öÇVÖç2ç6öÖR†2Óâ2æw&÷W’bb€¢ÇF€¢6Æ74æÖS×¶7F–6·’F÷Ó¢Õ³cÒrÓ&÷&FW"Ö"&÷&FW"×"&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â44$CTS•ÒFW‡BÖ6VçFW"G¶†VFW$6Æ74æÖRò†VFW$6Æ74æÖR¢&&rÕ²4c„dd5Ò'ÒFW‡BÕ·f"‚ÒÖ†VFW"ÖföçB×6—¦RÃãcƒsW&VÒ•ÒföçBÖ&öÆBWW&66RFW‡B×6ÆFRÓƒF&³§FW‡B×6ÆFRÓ#Ð¢7G–ÆS×·²FF–æs¢'f"‚Ò×F&ÆR×FF–ærÂã#W&VÒãG&VÒ’"ÂfW'F–6ÄÆ–vã¢&Ö–FFÆR"×Ð¢à¢Æ'WGFöà¢öä6Æ–6³×·FövvÆTÆÇÐ¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"†÷fW#§FW‡BÖ66VçBG&ç6—F–öâÖ6öÆ÷'2×‚ÖWFò ¢à¢·6VÆV7FVE&÷t–G2ç6—¦Râb`¢6VÆV7FVE&÷t–G2ç6—¦RÓÓÒf–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ò€¢ÆF—b6Æ74æÖSÒ'rÓR‚ÓR&rÖ66VçB&÷VæFVBÖÖBfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷&FW"&÷&FW"Ö66VçB6†F÷r×6ÒG&ç6—F–öâ×G&ç6f÷&Ò7F—fS§66ÆRÓ“R#à¢Ä6†V6µ7V&R6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×v†—FR"óà¢ÂöF—cà¢’¢6VÆV7FVE&÷t–G2ç6—¦Râò€¢ÆF—b6Æ74æÖSÒ'rÓR‚ÓR&rÖ66VçBó&÷VæFVBÖÖBfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷&FW"&÷&FW"Ö66VçB6†F÷r×6ÒG&ç6—F–öâ×G&ç6f÷&Ò7F—fS§66ÆRÓ“R#à¢ÄÖ–çW26Æ74æÖSÒ'rÓ2‚Ó2FW‡BÖ66VçB"óà¢ÂöF—cà¢’¢€¢ÆF—b6Æ74æÖSÒ'rÓR‚ÓR&÷&FW"Ó"&÷&FW"Ö66VçBó#&r×v†—FR&÷VæFVBÖÖB†÷fW#¦&÷&FW"Ö66VçBóSG&ç6—F–öâÖ6öÆ÷'2"óà¢—Ð¢Âö'WGFöãà¢Â÷Fƒà¢—Ð¢·6†÷u&÷tçVÖ&W"bb6öÇVÖç2ç6öÖR†2Óâ2æw&÷W’bb€¢ÇF€¢6Æ74æÖS×¶7F–6·’F÷Ó¢Õ³cÒrÕ³S…Ò&÷&FW"Ö"&÷&FW"×"&÷&FW"Õ·f"‚ÒÖw&–BÖÆ–æRÖ6öÆ÷"Â44$CTS•ÒFW‡BÖ6VçFW"G¶†VFW$6Æ74æÖRò†VFW$6Æ74æÖR¢&&rÕ²4c„dd5Ò'ÒFW‡BÕ·f"‚ÒÖ†VFW"ÖföçB×6—¦RÃãcƒsW&VÒ•ÒföçBÖ&öÆBWW&66RFW‡B×6ÆFRÓƒF&³§FW‡B×6ÆFRÓ#w&÷WöæöÐ¢7G–ÆS×·²FF–æs¢'f"‚Ò×F&ÆR×FF–ærÂã#W&VÒãG&VÒ’"ÂfW'F–6ÄÆ–vã¢&Ö–FFÆR"×Ð¢à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ#à¢Ç7ãäæòãÂ÷7ãà¢Æ'WGFöâ ¢G—SÒ&'WGFöâ ¢öä6Æ–6³×²†R’Óâ²Rç7F÷&÷vF–öâ‚“²WFôf—DÆÄ6öÇVÖç2‚“²×Ð¢6Æ74æÖSÒ&÷6—G’Óc†÷fW#¦÷6—G’Ófö7W2×f—6–&ÆS¦÷6—G’ÓG&ç6—F–öâÖ÷6—G’ÓãR†÷fW#¦&rÖ66VçBó&÷VæFVBFW‡BÖ66VçB7W'6÷"×ö–çFW" ¢F—FÆSÒ%N»I¹–ær<H6â6Ž¸–æ‚NªWB>ª2>¹—B ¢&–ÖÆ&VÃÒ%N»I¹–ær<H6â6Ž¸–æ‚NªWB>ª2>¹—B ¢à¢ÄÖ†–Ö—¦S"6Æ74æÖSÒ'rÓ2‚Ó2"óà¢Âö'WGFöãà¢ÂöF—cà¢Â÷Fƒà¢—Ð¢·f—6–&ÆT6öÇVÖç2æÖ‚†6öÂÂ4–G‚’Óâ°¢òò6¶—&VæFW&–ær–b—Bv2Ç&VG’&VæFW&VBf–&÷u7ãÓ"–âF†Rw&÷W&÷r†öæÇ’–bw&÷W–ær—2&W6VçB¢–b†6öÇVÖç2ç6öÖR†2Óâ2æw&÷W’bb6öÂæw&÷W’&WGW&âçVÆÃ°¢ ¢&WGW&â&VæFW$†VFW$6VÆÂ†6öÂÂ4–G‚ÂÂ6öÇVÖç2ç6öÖR†2Óâ2æw&÷W’ò'F÷Õ³3…Ò"¢'F÷Ó"“°¢Ò—Ð¢Â÷G#à ¢Â÷F†VCà¢ÇF&öG’6Æ74æÖSÒ&&÷&FW"×&–Ö'’óR#à¢²ò¢F÷76W"¢÷Ð¢·g5F÷Bâbb6öÇVÖç2ç6öÖR†2Óâ2æWFõ&÷u7â’bb€¢ÇG"7G–ÆS×·²†V–v‡C¢G·g5F÷G×†×Ò&–Ö†–FFVãÒ'G'VR#à¢ÇF@¢6öÅ7ã×·f—6–&ÆT6öÇVÖç2æÆVæwF‚²‡6VÆV7F&ÆRò¢’²‡6†÷u&÷tçVÖ&W"ò¢—Ð¢7G–ÆS×·²†V–v‡C¢G·g5F÷G×†ÂFF–æs¢Â&÷&FW#¢&æöæR"×Ð¢óà¢Â÷G#à¢—Ð ¢¶f–ÇFW&VDæE6÷'FVDFFæÆVæwF‚ÓÓÒò€¢ÇG#à¢ÇF@¢6öÅ7ã×·f—6–&ÆT6öÇVÖç2æÆVæwF‚²‡6VÆV7F&ÆRò¢’²‡6†÷u&÷tçVÖ&W"ò¢—Ð¢6Æ74æÖSÒ'Ó&÷&FW"ÖæöæR&VÆF—fR‚Õ³C…Ò ¢à¢ÆF—`¢6Æ74æÖSÒ'7F–6·’ÆVgBÓfÆW‚fÆW‚Ö6öÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓb ¢7G–ÆS×·²v–GFƒ¢g46öçF–æW%v–GF‚Â†V–v‡C¢C×Ð¢à¢ÆF—b6Æ74æÖSÒ'rÓ#B‚Ó#B&r×&–Ö'’óR&÷VæFVBÕ³3'…ÒfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷&FW"Ó"&÷&FW"ÖF6†VB&÷&FW"×&–Ö'’ó##à¢Å6V&6‚6Æ74æÖSÒ'rÓ‚ÓFW‡B×&–Ö'’ó#"óà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚Ö6öÂ—FV×2Ö6VçFW"vÓ"#à¢Ç ¢6Æ74æÖSÒ'FW‡BÖÆrföçBÖ&Æ6²WW&66RG&6¶–ærÕ³ã&VÕÒFW‡B×&–Ö'’óƒ ¢7G–ÆS×·²föçDfÖ–Ç“¢%fW&Fæ"×Ð¢à¢·6V&6…FW&Ð¢ò$¶Œ;FærL:ÆÒFŽªW’¾«÷B^ª2 ¢¢$NºòÆž¸wRG.¹ær'Ð¢Â÷à¢Ç6Æ74æÖSÒ'FW‡BÖf÷&Vw&÷VæBóCföçBÖ&öÆBFW‡BÕ³ãc#W&VÕÒWW&66RG&6¶–ærÕ³ã6VÕÒÖ‚×rÕ³3…ÒÆVF–ær×&VÆ†VBFW‡BÖ6VçFW"#à¢·6V&6…FW&Òò€¢Ãà¢¶Œ;Fær¶Ž¹·n¹¶’Nº²¶Œ;6²"'Ð¢Ç7â6Æ74æÖSÒ'FW‡B×&–Ö'’#à¢'·6V&6…FW&×Ò ¢Â÷7ãà¢Âóà¢’¢€¢%gV’Ì;&ærNª6’f–ÆR†þ«v2Œ:&âŽ¹’NºòÆž¸wRNº².ª6ærFF ¢—Ð¢Â÷à¢ÂöF—cà¢²‡6V&6…FW&ÒÇÂö&¦V7BçfÇVW2†6öÇVÖäf–ÇFW'2’ç6öÖR‡bÓâb’’bb€¢Æ'WGFöà¢öä6Æ–6³×¶6ÆV$ÆÄf–ÇFW'7Ð¢6Æ74æÖSÒ'‚Ób’Ó"ãR&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"×&–Ö'’FW‡B×&–Ö'’föçBÖ&Æ6²FW‡BÕ³ãc#W&VÕÒWW&66RG&6¶–ær×v–FW7B†÷fW#¦&r×&–Ö'’†÷fW#§FW‡B×v†—FRG&ç6—F–öâÖÆÂ7F—fS§66ÆRÓ“R ¢à¢Œ;6NªWB>ª2.¹’Î¸Ö0¢Âö'WGFöãà¢—Ð¢ÂöF—cà¢Â÷FCà¢Â÷G#à¢’¢6öÇVÖç2ç6öÖR†2Óâ2æWFõ&÷u7â’ò€¢v–æFVDFFæÖ‚‡&÷rÂ–æFW‚’Óâ€¢ÄFF&÷p¢¶W“×·&÷ræ–Bóò–æFW‡Ð¢&÷s×·&÷wÐ¢$–Gƒ×¶–æFW‡Ð¢6VÆV7F&ÆS×·6VÆV7F&ÆWÐ¢6†÷u&÷tçVÖ&W#×·6†÷u&÷tçVÖ&W'Ð¢6VÆV7FVE&÷t–G3×·6VÆV7FVE&÷t–G7Ð¢7F—fT6VÆÃ×¶7F—fT6VÆÇÐ¢6VÆV7F–öå&ævS×·6VÆV7F–öå&ævWÐ¢VF—F–æt6VÆÃ×¶VF—F–æt6VÆÇÐ¢VF—EfÇVS×¶VF—EfÇVWÐ¢f—6–&ÆT6öÇVÖç3×·f—6–&ÆT6öÇVÖç7Ð¢6öÇVÖåv–GF‡3×¶6öÇVÖåv–GF‡7Ð¢—4VF—F&ÆS×¶—4VF—F&ÆWÐ¢öä6VÆÄ6†ævS×¶öä6VÆÄ6†ævWÐ¢FövvÆU&÷s×·FövvÆU&÷wÐ¢7F'DVF—F–æs×·7F'DVF—F–æwÐ¢†æFÆT6VÆÄÖ÷W6TF÷vã×¶†æFÆT6VÆÄÖ÷W6TF÷vçÐ¢†æFÆT6VÆÄÖ÷W6TVçFW#×¶†æFÆT6VÆÄÖ÷W6TVçFW'Ð¢†æFÆT6öçFW‡DÖVçS×¶†æFÆT6öçFW‡DÖVçWÐ¢6WDVF—EfÇVS×·6WDVF—EfÇVWÐ¢6öÖÖ—DVF—C×¶6öÖÖ—DVF—GÐ¢f÷&ÖEfÇVS×¶f÷&ÖEfÇVWÐ¢vWDÆ–væÖVçC×¶vWDÆ–væÖVçGÐ¢–çWE&Vc×¶–çWE&VgÐ¢&÷t†V–v‡C×·&÷t†V–v‡GÐ¢6WE&÷t†V–v‡C×·6WE&÷t†V–v‡GÐ¢7G&—VC×·7G&—VGÐ¢öå&÷t6Æ–6³×¶öå&÷t6Æ–6·Ð¢óà¢’¢’¢€¢f—'GVÄ—FV×2æÖ‚‡f’’Óâ°¢6öç7B&÷rÒv–æFVDFF·f’æ–æFW…Ó°¢&WGW&â€¢ÄFF&÷p¢¶W“×·&÷ræ–Bóòf’æ–æFW‡Ð¢&÷s×·&÷wÐ¢$–Gƒ×·f’æ–æFW‡Ð¢6VÆV7F&ÆS×·6VÆV7F&ÆWÐ¢6†÷u&÷tçVÖ&W#×·6†÷u&÷tçVÖ&W'Ð¢6VÆV7FVE&÷t–G3×·6VÆV7FVE&÷t–G7Ð¢7F—fT6VÆÃ×¶7F—fT6VÆÇÐ¢6VÆV7F–öå&ævS×·6VÆV7F–öå&ævWÐ¢VF—F–æt6VÆÃ×¶VF—F–æt6VÆÇÐ¢VF—EfÇVS×¶VF—EfÇVWÐ¢f—6–&ÆT6öÇVÖç3×·f—6–&ÆT6öÇVÖç7Ð¢6öÇVÖåv–GF‡3×¶6öÇVÖåv–GF‡7Ð¢—4VF—F&ÆS×¶—4VF—F&ÆWÐ¢öä6VÆÄ6†ævS×¶öä6VÆÄ6†ævWÐ¢FövvÆU&÷s×·FövvÆU&÷wÐ¢7F'DVF—F–æs×·7F'DVF—F–æwÐ¢†æFÆT6VÆÄÖ÷W6TF÷vã×¶†æFÆT6VÆÄÖ÷W6TF÷vçÐ¢†æFÆT6VÆÄÖ÷W6TVçFW#×¶†æFÆT6VÆÄÖ÷W6TVçFW'Ð¢†æFÆT6öçFW‡DÖVçS×¶†æFÆT6öçFW‡DÖVçWÐ¢6WDVF—EfÇVS×·6WDVF—EfÇVWÐ¢6öÖÖ—DVF—C×¶6öÖÖ—DVF—GÐ¢f÷&ÖEfÇVS×¶f÷&ÖEfÇVWÐ¢vWDÆ–væÖVçC×¶vWDÆ–væÖVçGÐ¢–çWE&Vc×¶–çWE&VgÐ¢&÷t†V–v‡C×·&÷t†V–v‡GÐ¢6WE&÷t†V–v‡C×·6WE&÷t†V–v‡GÐ¢7G&—VC×·7G&—VGÐ¢öå&÷t6Æ–6³×¶öå&÷t6Æ–6·Ð¢óà¢“°¢Ò¢—Ð ¢²ò¢&÷GFöÒ76W"¢÷Ð¢·g4&÷GFöÕBâbb6öÇVÖç2ç6öÖR†2Óâ2æWFõ&÷u7â’bb€¢ÇG"7G–ÆS×·²†V–v‡C¢G·g4&÷GFöÕG×†×Ò&–Ö†–FFVãÒ'G'VR#à¢ÇF@¢6öÅ7ã×·f—6–&ÆT6öÇVÖç2æÆVæwF‚²‡6VÆV7F&ÆRò¢’²‡6†÷u&÷tçVÖ&W"ò¢—Ð¢7G–ÆS×·²†V–v‡C¢G·g4&÷GFöÕG×†ÂFF–æs¢Â&÷&FW#¢&æöæR"×Ð¢óà¢Â÷G#à¢—Ð¢Â÷F&öG“à¢·6†÷tfö÷FW"bb€¢ÇFfö÷@¢6Æ74æÖSÒ'7F–6·’&÷GFöÒÓ¢Ó3 ¢7G–ÆS×·°¢v–ÆÄ6†ævS¢'G&ç6f÷&Ò"À¢&÷…6†F÷s¢#Ó'‚‚&v&ƒÃÃÃãR’"À¢×Ð¢à¢²ò¢w&æBF÷FÂ&÷r¢÷Ð¢ÇG ¢6Æ74æÖS×¶G¶fö÷FW$6Æ74æÖRÇÂ&&rÕ·f"‚Ò×F&ÆRÖ6öÇVÖâÖ†VFW"Ö&rÂ4cDT4C‚•Ò'ÒG²†fö÷FW$6Æ74æÖRÇÂ""’æ–æ6ÇVFW2‚'FW‡BÒ"’ò""¢'FW‡B×6ÆFRÓƒ'ÒföçBÖ&öÆB&÷&FW"×B&÷&FW"Õ·f"‚Ò×F&ÆRÖ&÷&FW"Ö6öÆ÷"Â6SvF&F2•ÒF÷FÂ×&÷vÐ¢à¢·6VÆV7F&ÆRbb€¢ÇF@¢6Æ74æÖS×¶&÷&FW"Ö"&÷&FW"×"Ó&÷&FW"ÖÂÓ&÷&FW"×B&÷&FW"Õ·f"‚Ò×F&ÆRÖ&÷&FW"Ö6öÆ÷"Â6SvF&F2•ÒG¶fö÷FW$6Æ74æÖRÇÂ"'ÖÐ¢7G–ÆS×·°¢÷6—F–öã¢'7F–6·’"À¢&÷GFöÓ¢À¢¤–æFWƒ¢3À¢&6¶w&÷VæD6öÆ÷#¢fö÷FW$6Æ74æÖRòVæFVf–æVB¢'f"‚Ò×F&ÆRÖ6öÇVÖâÖ†VFW"Ö&rÂ4cDT4C‚’"À¢×Ð¢óà¢—Ð¢·6†÷u&÷tçVÖ&W"bb€¢ÇF@¢6Æ74æÖS×¶&÷&FW"Ö"&÷&FW"×"Ó&÷&FW"ÖÂÓ&÷&FW"×B&÷&FW"Õ·f"‚Ò×F&ÆRÖ&÷&FW"Ö6öÆ÷"Â6SvF&F2•ÒG¶fö÷FW$6Æ74æÖRÇÂ"'ÖÐ¢7G–ÆS×·°¢÷6—F–öã¢'7F–6·’"À¢&÷GFöÓ¢À¢¤–æFWƒ¢3À¢&6¶w&÷VæD6öÆ÷#¢fö÷FW$6Æ74æÖRòVæFVf–æVB¢'f"‚Ò×F&ÆRÖ6öÇVÖâÖ†VFW"Ö&rÂ4cDT4C‚’"À¢×Ð¢óà¢—Ð¢·f—6–&ÆT6öÇVÖç2æÖ‚†6öÃ¢ç’Â4–Gƒ¢çVÖ&W"’Óâ°¢6öç7Bw&æEF÷FÂÒfö÷FW%F÷FÇ5¶6öÂæ¶W•Ó° ¢6öç7B6öÅv–GF‚Ò6öÇVÖåv–GF‡5¶6öÂæ¶W•ÒÇÂ6öÂçv–GFƒ°¢6öç7Bv–GF…7G–ÆRÒ6öÅv–GF€¢òG—Vöb6öÅv–GF‚ÓÓÒ&çVÖ&W" ¢òG¶6öÅv–GF‡×† ¢¢6öÅv–GF€¢¢VæFVf–æVC° ¢&WGW&â€¢ÇF@¢¶W“×¶fö÷FW"Öw&æBÒG¶6öÂæ¶W—ÖÐ¢6Æ74æÖS×¶v†—FW76RÖæ÷w&föçBÖ&öÆB&÷&FW"Ö"&÷&FW"×B&÷&FW"Õ·f"‚Ò×F&ÆRÖ&÷&FW"Ö6öÆ÷"Â6SvF&F2•Ò&÷&FW"×"Ó&÷&FW"ÖÂÓG¶vWDÆ–væÖVçB†6öÂ—ÒWW&66RFW‡BÕ³ãsW&VÕÒG¶fö÷FW$6Æ74æÖRÇÂ&&rÕ·f"‚Ò×F&ÆRÖ6öÇVÖâÖ†VFW"Ö&rÂ4cDT4C‚•Ò'ÒG²†fö÷FW$6Æ74æÖRÇÂ""’æ–æ6ÇVFW2‚'FW‡BÒ"’ò""¢'FW‡B×6ÆFRÓƒ'ÒG¶6öÂæfö÷FW$6Æ74æÖRÇÂ"'ÖÐ¢7G–ÆS×·°¢FF–æs¢'f"‚Ò×F&ÆR×FF–ærÂãG&VÒãg&VÒ’"À¢FF–æuF÷¢#W‚"À¢FF–æt&÷GFöÓ¢#W‚"À¢föçDfÖ–Ç“¢'f"‚ÒÖföçB×F&ÆRÂf"‚ÒÖföçBÖÖ–â’’"À¢v–GFƒ¢v–GF…7G–ÆRÀ¢Ö–åv–GFƒ¢v–GF…7G–ÆRÀ¢Ö…v–GFƒ¢v–GF…7G–ÆRÀ¢÷fW&fÆ÷s¢&†–FFVâ"À¢FW‡D÷fW&fÆ÷s¢&VÆÆ—6—2"À¢÷6—F–öã¢'7F–6·’"À¢&÷GFöÓ¢À¢¤–æFWƒ¢3À¢&6¶w&÷VæD6öÆ÷#¢fö÷FW$6Æ74æÖRòVæFVf–æVB¢'f"‚Ò×F&ÆRÖ6öÇVÖâÖ†VFW"Ö&rÂ4cDT4C‚’"À¢×Ð¢à¢¶4–G‚ÓÓÒ ¢ò%N¹Där>¹„är ¢¢w&æEF÷FÂÓÒçVÆÀ¢òf÷&ÖEfÇVR†w&æEF÷FÂÂ6öÂçG—R¢¢"'Ð¢Â÷FCà¢“°¢Ò—Ð¢Â÷G#à¢Â÷Ffö÷Cà¢—Ð¢Â÷F&ÆSà¢ÂöF—cà ¢²ò¢fö÷FW"(	B&VFW6–væVBÖöFW&â6öçG&öÂbv–æF–öâ&"¢÷Ð¢ÆF—`¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâ6‡&–æ²Ó¢Ó3&VÆF—fR&÷&FW"×B&÷&FW"×6ÆFRÓ#óƒF&³¦&÷&FW"×6ÆFRÓƒ&6¶G&÷Ö&ÇW"×‡2‚Ó2ãR’ÓãRÖ–âÖ‚Õ³3‡…Ò6VÆV7BÖæöæRFW‡B×‡2FW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3F&ÆRÖfö÷FW"×v–æF–öâ&rÕ·f"‚Ò×F&ÆRÖfö÷FW"Ö&rÇf"‚Ò×F&ÆRÖ†VFW"Ö&rÂ4dc4S‚’•Ò ¢7G–ÆS×·²&6¶w&÷VæD6öÆ÷#¢'f"‚Ò×F&ÆRÖfö÷FW"Ö&rÂf"‚Ò×F&ÆRÖ†VFW"Ö&rÂ4dc4S‚’’"×Ð¢à¢²ò¢ÆVgC¢&÷w2W"vRbF÷FÂ&÷r6÷VçBbFööÇ2¢÷Ð¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ2#à¢²ò¢vR6—¦R6VÆV7F÷"¢÷Ð¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"#à¢Ç7â6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒFW‡B×6ÆFRÓSF&³§FW‡B×6ÆFRÓCv†—FW76RÖæ÷w&#à¢†ž¸6âFŽ¸³ ¢Â÷7ãà¢Å6VÆV7@¢fÇVS×¶—FV×5W%vRÓÓÒ–æf–æ—G’ò&ÆÂ"¢7G&–ær†—FV×5W%vR—Ð¢öåfÇVT6†ævS×²‡fÂ’Óâ°¢6WD—FV×5W%vR‡fÂÓÓÒ&ÆÂ"ò–æf–æ—G’¢çVÖ&W"‡fÂ’“°¢6WD7W'&VçEvRƒ“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Ò“°¢×Ð¢à¢Å6VÆV7EG&–vvW ¢6Æ74æÖSÒ&‚Õ³#…Ò‚Ó"FW‡BÕ³…ÒföçBÖ&öÆBFW‡B×6ÆFRÓƒF&³§FW‡B×6ÆFRÓ#&÷&FW"×6ÆFRÓ#ó“F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒ†÷fW#¦&r×6ÆFRÓSF&³¦†÷fW#¦&r×6ÆFRÓsG&ç6—F–öâÖ6öÆ÷'26†F÷rÓ7‡2&÷VæFVBÖgVÆÂrÕ³“…Ò’Ó ¢7G–ÆS×·²†V–v‡C¢##‚"×Ð¢à¢Å6VÆV7EfÇVRÆ6V†öÆFW#Ò$6Ž¸Öââââ"óà¢Âõ6VÆV7EG&–vvW#à¢Å6VÆV7D6öçFVçB6Æ74æÖSÒ&&r×÷÷fW"F&³¦&r×6ÆFRÓƒ&÷&FW"Ö&÷&FW"¢Õ³““““•ÒrÕ³…ÒÖ–â×rÕ³ƒ…Ò#à¢Å6VÆV7D—FVÒfÇVSÒ#"6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒ#ãL;&æsÂõ6VÆV7D—FVÓà¢Å6VÆV7D—FVÒfÇVSÒ##"6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒ#ã#L;&æsÂõ6VÆV7D—FVÓà¢Å6VÆV7D—FVÒfÇVSÒ#S"6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒ#ãSL;&æsÂõ6VÆV7D—FVÓà¢Å6VÆV7D—FVÒfÇVSÒ#"6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒ#ãL;&æsÂõ6VÆV7D—FVÓà¢Å6VÆV7D—FVÒfÇVSÒ&ÆÂ"6Æ74æÖSÒ'FW‡BÕ³…ÒföçBÖÖVF—VÒ#åNªWB>ª3Âõ6VÆV7D—FVÓà¢Âõ6VÆV7D6öçFVçCà¢Âõ6VÆV7Cà¢ÂöF—cà ¢²ò¢FööÆ&"7F–öç2¢÷Ð¢ÆF—b6Æ74æÖSÒ&†–FFVâÖC¦fÆW‚—FV×2Ö6VçFW"vÓãR&÷&FW"ÖÂ&÷&FW"×6ÆFRÓ#óƒF&³¦&÷&FW"×6ÆFRÓƒÂÓ2#à¢²ò¢6öÇVÖâf—6–&–Æ—G’6WGF–æw2¢÷Ð¢ÄG&÷F÷väÖVçSà¢ÄG&÷F÷väÖVçUG&–vvW"46†–ÆCà¢Æ'WGFöà¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒ†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓsFW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3G&ç6—F–öâÖÆÂ6†F÷rÓ7‡2rÓb‚Ób ¢F—FÆSÒ$6Ž¸Öâ>¹—B†ž¸6âFŽ¸²„<:’I«wB’ ¢à¢Å6WGF–æw3"6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Âö'WGFöãà¢ÂôG&÷F÷väÖVçUG&–vvW#à¢ÄG&÷F÷väÖVçT6öçFVçBÆ–vãÒ'7F'B"6Æ74æÖSÒ'rÓS"Ö‚Ö‚Õ³3…Ò÷fW&fÆ÷r×’ÖWFò&r×÷÷fW"F&³¦&r×6ÆFRÓƒ¢Õ³““““•Ò&÷&FW"Ö&÷&FW"6†F÷rÓ'†Â#à¢ÄG&÷F÷väÖVçTÆ&VÂ6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×6ÆFRÓSWW&66R#ä>¹—B†ž¸6âFŽ¸³ÂôG&÷F÷väÖVçTÆ&VÃà¢ÄG&÷F÷väÖVçU6W&F÷"óà¢ÄG&÷F÷väÖVçT—FVÐ¢öä6Æ–6³×²†R’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢6öç7BÆÅf—6–&ÆRÒ6öÇVÖç2æWfW'’€¢†6öÂ’Óà¢—4–D6öÇVÖä¶W’†6öÂæ¶W’’ÇÀ¢VffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’À¢“°¢–b†ÆÅf—6–&ÆR’°¢6WD†–FFVä6öÇVÖç2†æWr6WB†6öÇVÖç2æÖ‚†2’Óâ2æ¶W’’’“°¢6WE6†÷väWFô†–FFVä6öÇVÖç2†æWr6WB‚’“°¢ÒVÇ6R°¢6WD†–FFVä6öÇVÖç2†æWr6WB‚’“°¢6WE6†÷väWFô†–FFVä6öÇVÖç2†æWr6WB†WFô†–FFVä6öÇVÖç2’“°¢Ð¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâFW‡B×‡2föçBÖ&öÆB7W'6÷"×ö–çFW"FW‡B×&–Ö'’ ¢à¢Ç7ãç¶6öÇVÖç2æWfW'’‚†6öÂ’Óâ—4–D6öÇVÖä¶W’†6öÂæ¶W’’ÇÂVffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’’ò.ª†âNªWB>ª2"¢$6Ž¸ÖâNªWB>ª2'ÓÂ÷7ãà¢¶6öÇVÖç2æWfW'’‚†6öÂ’Óâ—4–D6öÇVÖä¶W’†6öÂæ¶W’’ÇÂVffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’’ò€¢ÄW–R6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’6‡&–æ²Ó"óà¢’¢€¢ÄW–Töfb6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×6ÆFRÓ36‡&–æ²Ó"óà¢—Ð¢ÂôG&÷F÷väÖVçT—FVÓà¢ÄG&÷F÷väÖVçU6W&F÷"óà¢¶6öÇVÖç2æÖ‚†6öÂ’Óâ€¢ÄG&÷F÷väÖVçT—FVÐ¢¶W“×¶6öÂæ¶W—Ð¢öä6Æ–6³×²†R’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢FövvÆT6öÇVÖâ†6öÂæ¶W’“°¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâFW‡B×‡27W'6÷"×ö–çFW" ¢à¢Ç7â6Æ74æÖSÒ&fÆW‚Ö–â×rÓ—FV×2Ö6VçFW"vÓ""Ó"#à¢Ç7â6Æ74æÖSÒ'G'Væ6FR#ç¶6öÂæÆ&VÇÓÂ÷7ãà¢¶WFô†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’bb€¢Ç7â6Æ74æÖSÒ'6‡&–æ²ÓFW‡BÕ³—…ÒföçBÖ&öÆBWW&66RG&6¶–ær×v–FRFW‡BÖ×WFVBÖf÷&Vw&÷VæB#à¢N¹VærÒ ¢Â÷7ãà¢—Ð¢Â÷7ãà¢²VffV7F—fT†–FFVä6öÇVÖç2æ†2†6öÂæ¶W’’ÇÂ—4–D6öÇVÖä¶W’†6öÂæ¶W’’ò€¢ÄW–R6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’6‡&–æ²Ó"óà¢’¢€¢ÄW–Töfb6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×6ÆFRÓ36‡&–æ²Ó"óà¢—Ð¢ÂôG&÷F÷väÖVçT—FVÓà¢’—Ð¢ÂôG&÷F÷väÖVçT6öçFVçCà¢ÂôG&÷F÷väÖVçSà ¢Å6fU7FGW46&B ¢6Æ74æÖSÒ"‚Ó"’ÓãR&÷VæFVBÖgVÆÂ&r×v†—FRF&³¦&r×6ÆFRÓƒ&÷&FW"&÷&FW"×6ÆFRÓ#óƒF&³¦&÷&FW"×6ÆFRÓs6†F÷rÓ7‡2vÓrÕ³3…Ò§W7F–g’Ö6VçFW" ¢FW‡E7G–ÆS×·°¢föçDfÖ–Ç“¢&–æ†W&—B"À¢föçEvV–v‡C¢#c"À¢föçE6—¦S¢#—‚"À¢6öÆ÷#¢"3CsSSc’"À¢×Ð¢–6öå7G–ÆS×·°¢v–GFƒ¢#‚"À¢†V–v‡C¢#‚"À¢6öÆ÷#¢"3CsSSc’"À¢×Ð¢óà¢ÂöF—cà¢ÂöF—cà ¢²ò¢&–v‡C¢F7F–ÆRv–æF–öâ6öçG&öÇ2¢÷Ð¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓãR#à¢²ò¢f—'7BvR¢÷Ð¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶7W'&VçEvRÓÓÒÐ¢öä6Æ–6³×²‚’Óâ°¢6WD7W'&VçEvRƒ“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Â&V†f–÷#¢'6Öö÷F‚"Ò“°¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"rÓr‚Ór&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒFW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓs†÷fW#§FW‡B×6ÆFRÓ“F&³¦†÷fW#§FW‡B×v†—FRF—6&ÆVC¦÷6—G’Ó3F—6&ÆVC¦7W'6÷"Öæ÷BÖÆÆ÷vVBG&ç6—F–öâÖÆÂ6†F÷rÓ7‡27F—fS§66ÆRÓ“R7W'6÷"×ö–çFW" ¢F—FÆSÒ%G&ærIªwR ¢à¢Ä6†Wg&öç4ÆVgB6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Âö'WGFöãà ¢²ò¢&Wf–÷W2vR¢÷Ð¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶7W'&VçEvRÓÓÒÐ¢öä6Æ–6³×²‚’Óâ°¢6WD7W'&VçEvR‚‡’ÓâÖF‚æÖ‚ƒÂÒ’“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Â&V†f–÷#¢'6Öö÷F‚"Ò“°¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"rÓr‚Ór&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒFW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓs†÷fW#§FW‡B×6ÆFRÓ“F&³¦†÷fW#§FW‡B×v†—FRF—6&ÆVC¦÷6—G’Ó3F—6&ÆVC¦7W'6÷"Öæ÷BÖÆÆ÷vVBG&ç6—F–öâÖÆÂ6†F÷rÓ7‡27F—fS§66ÆRÓ“R7W'6÷"×ö–çFW" ¢F—FÆSÒ%G&ærG,k¹¶2 ¢à¢Ä6†Wg&öäÆVgB6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Âö'WGFöãà ¢²ò¢vR–æF–6F÷"bV–6²§V×G&÷F÷vâ¢÷Ð¢ÄG&÷F÷väÖVçSà¢ÄG&÷F÷väÖVçUG&–vvW"46†–ÆCà¢Æ'WGFöà¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ‚Ó"ãR‚Ór&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#óƒF&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒFW‡BÕ³…ÒföçBÖ&öÆBFW‡B×6ÆFRÓsF&³§FW‡B×6ÆFRÓ#†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓsG&ç6—F–öâÖ6öÆ÷'26†F÷rÓ7‡27W'6÷"×ö–çFW"6VÆV7BÖæöæR ¢F—FÆSÒ$6Ž¸ÖâG&æræ†æ‚ ¢à¢Ç7â6Æ74æÖSÒ&föçB×6ç2WW&66RG&6¶–ær×v–FW"FW‡BÕ³ãW…Ò#à¢E$ärÇ7â6Æ74æÖSÒ&föçBÖ&Æ6²FW‡B×6ÆFRÓ“F&³§FW‡B×v†—FR#ç¶7W'&VçEvWÓÂ÷7ãâò·F÷FÅvW2ÇÂÐ¢Â÷7ãà¢Ä6†Wg&öäF÷vâ6Æ74æÖSÒ'rÓ2‚Ó2FW‡B×6ÆFRÓC"óà¢Âö'WGFöãà¢ÂôG&÷F÷väÖVçUG&–vvW#à¢ÄG&÷F÷väÖVçT6öçFVçBÆ–vãÒ&VæB"6Æ74æÖSÒ'rÓCBÓ&r×÷÷fW"F&³¦&r×6ÆFRÓƒ&÷&FW"Ö&÷&FW"¢Õ³““““•Ò6†F÷r×†Â#à¢ÄG&÷F÷väÖVçTÆ&VÂ6Æ74æÖSÒ'FW‡BÕ³—…ÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"FW‡BÖ×WFVBÖf÷&Vw&÷VæB‚Ó"’Ó#à¢6‡Wž¸6âI«öâG&æp¢ÂôG&÷F÷väÖVçTÆ&VÃà¢ÄG&÷F÷väÖVçU6W&F÷"óà¢ÆF—b6Æ74æÖSÒ&Ö‚Ö‚ÓC‚÷fW&fÆ÷r×’ÖWFò7W7FöÒ×67&öÆÆ&"ÓãR76R×’ÓãR#à¢´'&’æg&öÒ‡²ÆVæwFƒ¢ÖF‚æÖ–âƒSÂF÷FÅvW2ÇÂ’Ò’æÖ‚…òÂ–G‚’Óâ°¢6öç7BçVÒÒ–G‚²°¢&WGW&â€¢ÄG&÷F÷väÖVçT—FVÐ¢¶W“×·çV×Ð¢öä6Æ–6³×²‚’Óâ°¢6WD7W'&VçEvR‡çVÒ“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Â&V†f–÷#¢'6Öö÷F‚"Ò“°¢×Ð¢6Æ74æÖS×¶FW‡BÕ³…ÒföçBÖ&öÆBWW&66RG&6¶–ær×v–FW"‚Ó"ãR’Ó&÷VæFVBÖÖB7W'6÷"×ö–çFW"fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâG°¢7W'&VçEvRÓÓÒçVÒò&&r×&–Ö'’óFW‡B×&–Ö'’"¢&†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓs ¢ÖÐ¢à¢Ç7ãåG&ær·çV×ÓÂ÷7ãà¢¶7W'&VçEvRÓÓÒçVÒbbÇ7â6Æ74æÖSÒ'rÓãR‚ÓãR&÷VæFVBÖgVÆÂ&r×&–Ö'’"óçÐ¢ÂôG&÷F÷väÖVçT—FVÓà¢“°¢Ò—Ð¢ÂöF—cà¢ÂôG&÷F÷väÖVçT6öçFVçCà¢ÂôG&÷F÷väÖVçSà ¢²ò¢æW‡BvR¢÷Ð¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶7W'&VçEvRãÒF÷FÅvW2ÇÂF÷FÅvW2ÓÓÒÐ¢öä6Æ–6³×²‚’Óâ°¢6WD7W'&VçEvR‚‡’ÓâÖF‚æÖ–â‡F÷FÅvW2Â²’“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Â&V†f–÷#¢'6Öö÷F‚"Ò“°¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"rÓr‚Ór&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒFW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓs†÷fW#§FW‡B×6ÆFRÓ“F&³¦†÷fW#§FW‡B×v†—FRF—6&ÆVC¦÷6—G’Ó3F—6&ÆVC¦7W'6÷"Öæ÷BÖÆÆ÷vVBG&ç6—F–öâÖÆÂ6†F÷rÓ7‡27F—fS§66ÆRÓ“R7W'6÷"×ö–çFW" ¢F—FÆSÒ%G&ær6R ¢à¢Ä6†Wg&öå&–v‡B6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Âö'WGFöãà ¢²ò¢Æ7BvR¢÷Ð¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶7W'&VçEvRãÒF÷FÅvW2ÇÂF÷FÅvW2ÓÓÒÐ¢öä6Æ–6³×²‚’Óâ°¢6WD7W'&VçEvR‡F÷FÅvW2“°¢67&öÆÄ6öçF–æW%&Vbæ7W'&VçCòç67&öÆÅFò‡²F÷¢Â&V†f–÷#¢'6Öö÷F‚"Ò“°¢×Ð¢6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"rÓr‚Ór&÷VæFVBÖgVÆÂ&÷&FW"&÷&FW"×6ÆFRÓ#F&³¦&÷&FW"×6ÆFRÓs&r×v†—FRF&³¦&r×6ÆFRÓƒFW‡B×6ÆFRÓcF&³§FW‡B×6ÆFRÓ3†÷fW#¦&r×6ÆFRÓF&³¦†÷fW#¦&r×6ÆFRÓs†÷fW#§FW‡B×6ÆFRÓ“F&³¦†÷fW#§FW‡B×v†—FRF—6&ÆVC¦÷6—G’Ó3F—6&ÆVC¦7W'6÷"Öæ÷BÖÆÆ÷vVBG&ç6—F–öâÖÆÂ6†F÷rÓ7‡27F—fS§66ÆRÓ“R7W'6÷"×ö–çFW" ¢F—FÆSÒ%G&ær7^¹’ ¢à¢Ä6†Wg&öç5&–v‡B6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢²ò¢6öçFW‡BÖVçR¢÷Ð¢¶6öçFW‡DÖVçRbb€¢ÆF—`¢6Æ74æÖSÒ&f—†VB¢Õ³Ò&r×v†—FRó“&6¶G&÷Ö&ÇW"ÖÖB6†F÷rÖ†&B’ÓÖ–â×rÕ³ƒ…Ò&÷VæFVB&÷&FW"Ó"&÷&FW"×&–Ö'’÷fW&fÆ÷rÖ†–FFVâæ–ÖFRÖ–âfFRÖ–â¦ööÒÖ–â6Æ–FRÖ–âÖg&öÒ×F÷Ó"GW&F–öâÓS ¢7G–ÆS×·²F÷¢6öçFW‡DÖVçRç’ÂÆVgC¢6öçFW‡DÖVçRç‚×Ð¢öä6Æ–6³×²†R’ÓâRç7F÷&÷vF–öâ‚—Ð¢à¢ÆF—b6Æ74æÖSÒ'‚Ó2’ÓãRFW‡BÕ³ãSc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW7BFW‡B×&–Ö'’óCÖ"Ó&÷&FW"Ö"&÷&FW"×&–Ö'’ó#à¢F†òL:2æ†æ€¢ÂöF—cà ¢¶6öçFW‡DÖVçRç"ÓÒÓbb€¢Ãà¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶6öçFW‡DÖVçRç%Ó°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶6öçFW‡DÖVçRæ5Ó°¢6öç7BfÂÒ&÷u¶6öÂæ¶W•Ó°¢ÆWBfÅ7G"Ò"#°¢–b†6öÂçG—RÓÓÒ&7W'&Væ7’"ÇÂ6öÂçG—RÓÓÒ&ÖöæW’"ÇÂ6öÂçG—RÓÓÒ&çVÖ&W""’°¢6öç7BçVÒÒ'6TÖöæW•FôçVÖ&W"‡fÂ“°¢fÅ7G"Ò—4æâ†çVÒ’ò""¢7G&–ær†çVÒ“°¢ÒVÇ6R°¢fÅ7G"Ò7G&–ær†f÷&ÖEfÇVR‡fÂÂ6öÂçG—R’“°¢Ð¢æf–vF÷"æ6Æ—&ö&Bçw&—FUFW‡B‡fÅ7G"“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢Ä6÷’6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãå6ò6Œ:—vœ:G.¸²;CÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢–b†öä6VÆÄ6†ævR’°¢–b‡6VÆV7F–öå&ævR’°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢6öç7BÖ„2ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2“°¢ ¢f÷"†ÆWB"ÒÖ–å#²"ÃÒÖ…#²"²²’°¢f÷"†ÆWB2ÒÖ–ä3²2ÃÒÖ„3²2²²’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF·%Ó°¢öä6VÆÄ6†ævR‡&÷rÂf—6–&ÆT6öÇVÖç5¶5Òæ¶W’Â""“°¢Ð¢Ð¢Fö7Bç7V66W72‚,I:2Œ;6NºòÆž¸wR<:2;BIkº626Ž¸Öâ"“°¢ÒVÇ6R°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶6öçFW‡DÖVçRç%Ó°¢öä6VÆÄ6†ævR‡&÷rÂf—6–&ÆT6öÇVÖç5¶6öçFW‡DÖVçRæ5Òæ¶W’Â""“°¢Fö7Bç7V66W72‚,I:2Œ;6NºòÆž¸wR;B"“°¢Ð¢Ð¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷WFW‡BÖFW7G'V7F—fR†÷fW#§FW‡BÖFW7G'V7F—fR ¢à¢ÄW&6W"6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡BÖFW7G'V7F—fRóCw&÷WÖ†÷fW#§FW‡BÖFW7G'V7F—fRG&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãç·6VÆV7F–öå&ævRbb„ÖF‚æ'2‡6VÆV7F–öå&ævRæVæE"Ò6VÆV7F–öå&ævRç7F'E"’âÇÂÖF‚æ'2‡6VÆV7F–öå&ævRæVæD2Ò6VÆV7F–öå&ævRç7F'D2’â’ò%Œ;6vœ:G.¸²l;–ær6Ž¸Öâ"¢%Œ;6vœ:G.¸²;B'ÓÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢–b†öäFVÆWFU6VÆV7F–öâbb6VÆV7F–öå&ævRbb„ÖF‚æ'2‡6VÆV7F–öå&ævRæVæE"Ò6VÆV7F–öå&ævRç7F'E"’âÇÂÖF‚æ'2‡6VÆV7F–öå&ævRæVæD2Ò6VÆV7F–öå&ævRç7F'D2’â’’°¢öäFVÆWFU6VÆV7F–öâ‡°¢7F'E#¢ÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"’À¢VæE#¢ÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"’À¢7F'D3¢ÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2’À¢VæD3¢ÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'D2Â6VÆV7F–öå&ævRæVæD2’À¢Ò“°¢6WE6VÆV7F–öå&ævR†çVÆÂ“°¢ÒVÇ6R–b†öäFVÆWFU&÷w2bb6VÆV7F–öå&ævRbbÖF‚æ'2‡6VÆV7F–öå&ævRæVæE"Ò6VÆV7F–öå&ævRç7F'E"’â’°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7BÖ…"ÒÖF‚æÖ‚‡6VÆV7F–öå&ævRç7F'E"Â6VÆV7F–öå&ævRæVæE"“°¢6öç7B&÷w5FôFVÆWFRÒµÓ°¢f÷"†ÆWB"ÒÖ–å#²"ÃÒÖ…#²"²²’°¢&÷w5FôFVÆWFRçW6‚†f–ÇFW&VDæE6÷'FVDFF·%Ò“°¢Ð¢öäFVÆWFU&÷w2‡&÷w5FôFVÆWFR“°¢6WE6VÆV7F–öå&ævR†çVÆÂ“°¢Fö7Bç7V66W72†I:2Œ;6G·&÷w5FôFVÆWFRæÆVæwF‡ÒL;&æv“°¢ÒVÇ6R–b†öäFVÆWFU&÷r’°¢–b‡6VÆV7F–öå&ævRbbÖF‚æ'2‡6VÆV7F–öå&ævRæVæE"Ò6VÆV7F–öå&ævRç7F'E"’â’°¢Fö7BæW'&÷"‚%L:Öæ‚ìH6ærŒ;6æ†ž¸RL;&ær¶Œ;Fær¶Žª2NºVær‡F†ž«÷RöäFVÆWFU&÷w2ööäFVÆWFU6VÆV7F–öâ’"“°¢ÒVÇ6R°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶6öçFW‡DÖVçRç%Ó°¢öäFVÆWFU&÷r‡&÷rÂ6öçFW‡DÖVçRç"“°¢Ð¢ÒVÇ6R°¢Fö7BæW'&÷"‚%L:Öæ‚ìH6ærŒ;6L;&ær¶Œ;Fær¶Žª2NºVær6†ò.ª6ærì:’"“°¢Ð¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷WFW‡BÖFW7G'V7F—fR†÷fW#§FW‡BÖFW7G'V7F—fR ¢à¢ÅG&6ƒ"6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡BÖFW7G'V7F—fRóCw&÷WÖ†÷fW#§FW‡BÖFW7G'V7F—fRG&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãç·6VÆV7F–öå&ævRbbÖF‚æ'2‡6VÆV7F–öå&ævRæVæE"Ò6VÆV7F–öå&ævRç7F'E"’âò%Œ;6æŽºöærL;&ærIær6Ž¸Öâ"¢%Œ;6L;&ærì:’'ÓÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6öç7B6öÂÒf—6–&ÆT6öÇVÖç5¶6öçFW‡DÖVçRæ5Ó°¢6WDf÷&ÖDÖöFÂ‡²—4÷Vã¢G'VRÂ6öÄ¶W“¢6öÂæ¶W’Ò“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢ÅG—R6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãìI¸¶æ‚Nªær;CÂ÷7ãà¢Âö'WGFöãà ¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢–b†öäFE&÷r’°¢6öç7BF&vWE&÷rÒf–ÇFW&VDæE6÷'FVDFF¶6öçFW‡DÖVçRç%Ó°¢6öç7B7GVÄ–G‚ÒF&vWE&÷ròFFæf–æD–æFW‚‚‡"’Óâ"æ–BÓÓÒF&vWE&÷ræ–B’¢Ó°¢öäFE&÷r†7GVÄ–G‚ãÒò7GVÄ–G‚¢VæFVf–æVB“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢ÒVÇ6R°¢Fö7BæW'&÷"‚%L:Öæ‚ìH6ærFŒ:¦ÒL;&ær¶Œ;Fær¶Žª2NºVær6†ò.ª6ærì:’"“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢Ð¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&rÖ66VçBófÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷WFW‡BÖ66VçB†÷fW#§FW‡BÖ66VçBóƒ ¢à¢Äf–ÆUFW‡B6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡BÖ66VçBócw&÷WÖ†÷fW#§FW‡BÖ66VçBG&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãåFŒ:¦ÒL;&ærÞ¹¶“Â÷7ãà¢Âö'WGFöãà ¢ÄG&÷F÷väÖVçU6W&F÷"6Æ74æÖSÒ&&r×&–Ö'’ó×‚Ó"óà¢Âóà¢—Ð ¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6÷”6öÇVÖâ†6öçFW‡DÖVçRæ2“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢Ä6÷’6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãå6ò6Œ:—>¹—CÂ÷7ãà¢Âö'WGFöãà¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6÷•6VÆV7F–öâ‚“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢ÅF&ÆS"6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãå6ò6Œ:—l;–ær6Ž¸ÖãÂ÷7ãà¢Âö'WGFöãà¢·6VÆV7F–öå&ævRbb€¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢–b†öäFVÆWFU6VÆV7F–öâ’°¢öäFVÆWFU6VÆV7F–öâ‡6VÆV7F–öå&ævR“°¢ÒVÇ6R–b†öä6VÆÄ6†ævR’°¢6öç7B²7F'E"ÂVæE"Â7F'D2ÂVæD2ÒÒ6VÆV7F–öå&ævS°¢6öç7BÖ–å"ÒÖF‚æÖ–â‡7F'E"ÂVæE"’À¢Ö…"ÒÖF‚æÖ‚‡7F'E"ÂVæE"“°¢6öç7BÖ–ä2ÒÖF‚æÖ–â‡7F'D2ÂVæD2’À¢Ö„2ÒÖF‚æÖ‚‡7F'D2ÂVæD2“°¢f÷"†ÆWB’ÒÖ–å#²’ÃÒÖ…#²’²²’°¢f÷"†ÆWB¢ÒÖ–ä3²¢ÃÒÖ„3²¢²²’°¢6öç7B&÷rÒf–ÇFW&VDæE6÷'FVDFF¶•Ó°¢öä6VÆÄ6†ævR‡&÷rÂf—6–&ÆT6öÇVÖç5¶¥Òæ¶W’Â""“°¢Ð¢Ð¢Fö7Bç7V66W72€¢I:2Œ;6NºòÆž¸wRG&öærG²†Ö…"ÒÖ–å"²’¢†Ö„2ÒÖ–ä2²—Ò;FÀ¢“°¢Ð¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷WFW‡BÖFW7G'V7F—fR†÷fW#§FW‡BÖFW7G'V7F—fR ¢à¢ÅG&6ƒ"6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡BÖFW7G'V7F—fRóCw&÷WÖ†÷fW#§FW‡BÖFW7G'V7F—fRG&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãåŒ;6l;–ær6Ž¸ÖãÂ÷7ãà¢Âö'WGFöãà¢—Ð¢ÄG&÷F÷väÖVçU6W&F÷"6Æ74æÖSÒ&&r×&–Ö'’ó×‚Ó"óà¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6WE6÷'D6öæf–r‡°¢¶W“¢f—6–&ÆT6öÇVÖç5¶6öçFW‡DÖVçRæ5Òæ¶W’À¢F—&V7F–öã¢&62"À¢Ò“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢Ä6†Wg&öåW6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãå>ª÷Ž«÷Õ£Â÷7ãà¢Âö'WGFöãà¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6WE6÷'D6öæf–r‡°¢¶W“¢f—6–&ÆT6öÇVÖç5¶6öçFW‡DÖVçRæ5Òæ¶W’À¢F—&V7F–öã¢&FW62"À¢Ò“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&–Ö'’óRfÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷W ¢à¢Ä6†Wg&öäF÷vâ6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&–Ö'’óCw&÷WÖ†÷fW#§FW‡B×&–Ö'’G&ç6—F–öâÖ6öÆ÷'2"óà¢Ç7ãå>ª÷Ž«÷¢ÔÂ÷7ãà¢Âö'WGFöãà¢·6÷'D6öæf–rbb€¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢6WE6÷'D6öæf–r†çVÆÂ“°¢6Æ÷6T6öçFW‡DÖVçR‚“°¢Fö7Bç7V66W72‚,I:2Œ;6>ª÷Ž«÷>¹—B"“°¢×Ð¢6Æ74æÖSÒ'rÖgVÆÂ‚Ó2’Ó"FW‡BÖÆVgBFW‡BÕ³ãc#W&VÕÒföçBÖ&Æ6²WW&66RG&6¶–ær×v–FW"†÷fW#¦&r×&÷6RÓSF&³¦†÷fW#¦&r×&÷6RÓ“Só3fÆW‚—FV×2Ö6VçFW"vÓ"ãRG&ç6—F–öâÖ6öÆ÷'2w&÷WFW‡B×&÷6RÓc†÷fW#§FW‡B×&÷6RÓs ¢à¢Å‚6Æ74æÖSÒ'rÓ2ãR‚Ó2ãRFW‡B×&÷6RÓS7G&ö¶RÕ³"ãUÒ"óà¢Ç7ãåŒ;6>ª÷Ž«÷Â÷7ãà¢Âö'WGFöãà¢—Ð¢ÂöF—cà¢—Ð¢²ò¢6öÇVÖâf÷&ÖBF–Æör¢÷Ð¢¶f÷&ÖDÖöFÂbb€¢Ä6öÇVÖäf÷&ÖDF–Æöp¢¶W“×¶f÷&ÖDÖöFÂæ6öÄ¶W—Ð¢—4÷Vã×¶f÷&ÖDÖöFÂæ—4÷VçÐ¢öä6Æ÷6S×²‚’Óâ6WDf÷&ÖDÖöFÂ†çVÆÂ—Ð¢6öÄ¶W“×¶f÷&ÖDÖöFÂæ6öÄ¶W—Ð¢–æ—F–Äf÷&ÖC×¶6öÇVÖäf÷&ÖG5¶f÷&ÖDÖöFÂæ6öÄ¶W•ÒÇÂ·×Ð¢öå6fS×²†f÷&ÖC¢²Æ–væÖVçCó¢&ÆVgB"Â&6VçFW""Â'&–v‡B"Ò’Óâ°¢6WD6öÇVÖäf÷&ÖG2‚‡&Wb’Óâ‡°¢ââç&WbÀ¢¶f÷&ÖDÖöFÂæ6öÄ¶W•Ó¢f÷&ÖBÀ¢Ò’“°¢×Ð¢óà¢—Ð¢Âóà¢“°¢ÒÀ¢“° ¤FFF&ÆRæF—7Æ”æÖRÒ$FFF&ÆR#°