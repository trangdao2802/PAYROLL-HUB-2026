import React, { useState, useMemo, useCallback } from "react";
import {
  Download,
  RotateCcw,
  Sparkles,
  ArrowLeftRight,
  GraduationCap,
  Briefcase,
  Edit2,
  Check,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Settings,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../../components/ui/popover";
import { useAppData } from "../../../lib/contexts/AppDataContext";
import {
  DEFAULT_SALARY_SCALES,
  TASK_COLUMNS,
  ACADEMIC_FIELDS,
} from "../../../constants/timesheet-logic";
import {
  TableInitialMark,
  TableTitleRemainder,
} from "../../../components/TableInitialMark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ScaleMeta {
  code: string;
  name: string;
  desc: string;
}

const BASE_SCALE_LIST: ScaleMeta[] = [
  { code: "S1", name: "Scale S1 - Standard", desc: "Teaching Assistant Level 1 (Entry)" },
  { code: "S2", name: "Scale S2 - Experienced", desc: "Teaching Assistant Level 2 (Experienced)" },
  { code: "S3", name: "Scale S3 - Senior", desc: "Senior Teaching Assistant Level 3" },
  { code: "S4", name: "Scale S4 - Specialist", desc: "Academic Specialist Level 4" },
  { code: "S5", name: "Scale S5 - Advanced", desc: "Advanced Assistant Level 5" },
  { code: "S6", name: "Scale S6 - Master", desc: "Master Assistant Level 6" },
  { code: "S7", name: "Scale S7 - Operations", desc: "Operations & Admin Special Level 7" },
  { code: "S-CORP", name: "Corporate Program", desc: "Enterprise & Corporate Projects" },
  { code: "SDN1", name: "Da Nang Level 1", desc: "Da Nang Campus - Level 1" },
  { code: "SDN2", name: "Da Nang Level 2", desc: "Da Nang Campus - Level 2" },
  { code: "SDN3", name: "Da Nang Level 3", desc: "Da Nang Campus - Level 3" },
  { code: "SDN7", name: "Da Nang Level 7", desc: "Da Nang Campus - Operations Special" },
];

export interface TypeColumnDef {
  key: string;
  label: string;
  category: "academic" | "admin";
  defaultRateField?: "ac" | "ad" | "summer" | "outing" | "summerInstructors";
  fixedDefaultRate?: number;
  desc: string;
}

// Standard Academic Types (English)
const STANDARD_ACADEMIC_TYPES: TypeColumnDef[] = [
  { key: "inClass", label: "In-Class", category: "academic", defaultRateField: "ac", desc: "Active in-class teaching hours" },
  { key: "inClassAtls", label: "In-Class ATLS", category: "academic", defaultRateField: "ac", desc: "ATLS curriculum teaching hours" },
  { key: "demo", label: "Demo Class", category: "academic", defaultRateField: "ac", desc: "Demo and admission trial sessions" },
  { key: "tutoring", label: "Tutoring", category: "academic", defaultRateField: "ac", desc: "Individual & small group tutoring" },
  { key: "waitingClass", label: "Waiting Class", category: "academic", defaultRateField: "ac", desc: "Supervised waiting sessions" },
  { key: "clubActivity", label: "Club Activity", category: "academic", defaultRateField: "ac", desc: "Student club events & activities" },
  { key: "parentMeeting", label: "Parent Meeting", category: "academic", defaultRateField: "ac", desc: "Parent-teacher consultation" },
];

// Standard Admin Types (English)
const STANDARD_ADMIN_TYPES: TypeColumnDef[] = [
  { key: "sms", label: "SMS Contact", category: "admin", defaultRateField: "ad", desc: "Parent communication & updates" },
  { key: "progressReport", label: "Progress Report", category: "admin", defaultRateField: "ad", desc: "Student progress reports" },
  { key: "pt", label: "Placement Test (PT)", category: "admin", defaultRateField: "ad", desc: "Entrance placement testing" },
  { key: "meetingTraining", label: "Meeting / Training", category: "admin", defaultRateField: "ad", desc: "Staff meetings & training" },
  { key: "conductTest", label: "Conduct Test", category: "admin", defaultRateField: "ad", desc: "Exam proctoring & supervision" },
  { key: "supportMkt", label: "Support MKT / Local", category: "admin", defaultRateField: "ad", desc: "Marketing & campus support" },
  { key: "supportLxo", label: "Support LXO", category: "admin", defaultRateField: "ad", desc: "Operations & LXO support" },
  { key: "supportEc", label: "Support EC", category: "admin", defaultRateField: "ad", desc: "Educational Consultant support" },
  { key: "renewalProjects", label: "Renewal Projects", category: "admin", defaultRateField: "ad", desc: "Contract renewal tasks" },
  { key: "summer", label: "Summer / Discovery", category: "admin", defaultRateField: "summer", desc: "Summer day camp program" },
  { key: "outing", label: "Summer Outing", category: "admin", defaultRateField: "outing", desc: "Excursions & outdoor events" },
  { key: "summerInstructors", label: "Summer Instructors", category: "admin", defaultRateField: "summerInstructors", desc: "Summer lead instructors" },
  { key: "other", label: "Other Admin", category: "admin", defaultRateField: "ad", desc: "Miscellaneous admin tasks" },
];

interface TypeRatesTableProps {
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export function TypeRatesTable({ showSidebar = true, onToggleSidebar }: TypeRatesTableProps) {
  const { appData, updateAppData } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"all" | "academic" | "admin" | "custom">("all");
  const [editingCell, setEditingCell] = useState<{ scaleCode: string; typeKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isAutoFit, setIsAutoFit] = useState(true);

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState<number | typeof Infinity>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Dialog Add Scale state
  const [isAddScaleOpen, setIsAddScaleOpen] = useState(false);
  const [newScaleCode, setNewScaleCode] = useState("");
  const [newScaleName, setNewScaleName] = useState("");
  const [newAcademicRate, setNewAcademicRate] = useState("35000");
  const [newAdminRate, setNewAdminRate] = useState("20000");

  const customSalaryRates = useMemo(() => appData?.customSalaryRates || {}, [appData?.customSalaryRates]);
  const customTypeRates = useMemo(() => appData?.customTypeRates || {}, [appData?.customTypeRates]);
  const rawRoster = useMemo(() => appData?.Timesheet_Roster || [], [appData?.Timesheet_Roster]);

  // Dynamically extract all distinct types from raw data
  const { academicColumns, adminColumns } = useMemo(() => {
    const academicCols: TypeColumnDef[] = [...STANDARD_ACADEMIC_TYPES];
    const adminCols: TypeColumnDef[] = [...STANDARD_ADMIN_TYPES];

    const knownAcademicKeys = new Set(academicCols.map((c) => c.key.toLowerCase()));
    const knownAdminKeys = new Set(adminCols.map((c) => c.key.toLowerCase()));

    // Scan raw roster for extra types if any
    const rawTypeCounts = new Map<string, number>();
    rawRoster.forEach((r: Record<string, unknown>) => {
      const rawType = String(
        r.type || r.code || r.task || r.activity || r["Loại hoạt động"] || r["Loại"] || ""
      ).trim();
      if (rawType) {
        rawTypeCounts.set(rawType, (rawTypeCounts.get(rawType) || 0) + 1);
      }
    });

    rawTypeCounts.forEach((_, rawType) => {
      const normalized = rawType.toLowerCase().trim();
      const mappedKey = TASK_COLUMNS[normalized] || normalized;

      const isAcademic =
        ACADEMIC_FIELDS.includes(mappedKey) ||
        normalized.includes("class") ||
        normalized.includes("tutoring") ||
        normalized.includes("demo");

      if (isAcademic) {
        if (!knownAcademicKeys.has(mappedKey.toLowerCase()) && !knownAcademicKeys.has(normalized)) {
          knownAcademicKeys.add(mappedKey.toLowerCase());
          academicCols.push({
            key: mappedKey,
            label: rawType,
            category: "academic",
            defaultRateField: "ac",
            desc: `Raw Data Type (${rawType})`,
          });
        }
      } else {
        if (!knownAdminKeys.has(mappedKey.toLowerCase()) && !knownAdminKeys.has(normalized)) {
          knownAdminKeys.add(mappedKey.toLowerCase());
          adminCols.push({
            key: mappedKey,
            label: rawType,
            category: "admin",
            defaultRateField: "ad",
            desc: `Raw Data Type (${rawType})`,
          });
        }
      }
    });

    return { academicColumns: academicCols, adminColumns: adminCols };
  }, [rawRoster]);

  // Compute effective rate for a given scale and type column
  const getEffectiveRate = useCallback(
    (scaleCode: string, col: TypeColumnDef): { rate: number; isCustom: boolean } => {
      // 1. Check if specific custom type rate is set globally
      if (customTypeRates[col.key] !== undefined) {
        return { rate: Number(customTypeRates[col.key]), isCustom: true };
      }

      // 2. Check if scale has custom rate for this field
      const scaleCustom = customSalaryRates[scaleCode];
      const scaleDefault = DEFAULT_SALARY_SCALES[scaleCode] || DEFAULT_SALARY_SCALES.S1;

      if (col.defaultRateField) {
        if (scaleCustom && scaleCustom[col.defaultRateField] !== undefined) {
          return { rate: Number(scaleCustom[col.defaultRateField]), isCustom: true };
        }
        return { rate: Number(scaleDefault[col.defaultRateField] || 0), isCustom: false };
      }

      if (col.fixedDefaultRate !== undefined) {
        return { rate: col.fixedDefaultRate, isCustom: false };
      }

      return { rate: col.category === "academic" ? scaleDefault.ac : scaleDefault.ad, isCustom: false };
    },
    [customSalaryRates, customTypeRates]
  );

  // Compute all available scales (Baseline + custom scales)
  const allScales = useMemo(() => {
    const list = [...BASE_SCALE_LIST];
    const known = new Set(list.map((s) => s.code.toUpperCase()));

    // Add scales from Q_Salary_Scale if present
    const qSalary = appData?.Q_Salary_Scale || [];
    qSalary.forEach((s: Record<string, unknown>) => {
      const code = String(s.sCode || s.code || s.salary_scale || "").trim();
      if (code && !known.has(code.toUpperCase())) {
        known.add(code.toUpperCase());
        list.push({
          code,
          name: `Scale ${code}`,
          desc: `System Salary Scale ${code}`,
        });
      }
    });

    // Also add scales from customSalaryRates if any
    Object.keys(customSalaryRates).forEach((code) => {
      if (code && !known.has(code.toUpperCase())) {
        known.add(code.toUpperCase());
        list.push({
          code,
          name: `Scale ${code}`,
          desc: `Custom Scale ${code}`,
        });
      }
    });

    return list;
  }, [appData?.Q_Salary_Scale, customSalaryRates]);

  // Determine if a scale has any custom rate
  const hasScaleCustomRate = useCallback(
    (scaleCode: string) => {
      if (customSalaryRates[scaleCode] && Object.keys(customSalaryRates[scaleCode]).length > 0) {
        return true;
      }
      return false;
    },
    [customSalaryRates]
  );

  // Filter scales based on search and category
  const filteredScales = useMemo(() => {
    let result = allScales;

    if (activeCategoryFilter === "custom") {
      result = result.filter((s) => hasScaleCustomRate(s.code));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allScales, activeCategoryFilter, searchQuery, hasScaleCustomRate]);

  // Columns to display based on activeCategoryFilter
  const displayAcademicCols = useMemo(() => {
    if (activeCategoryFilter === "admin") return [];
    return academicColumns;
  }, [activeCategoryFilter, academicColumns]);

  const displayAdminCols = useMemo(() => {
    if (activeCategoryFilter === "academic") return [];
    return adminColumns;
  }, [activeCategoryFilter, adminColumns]);

  // Pagination calculation
  const totalPages = itemsPerPage === Infinity ? 1 : Math.max(1, Math.ceil(filteredScales.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedScales = useMemo(() => {
    if (itemsPerPage === Infinity) return filteredScales;
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredScales.slice(start, start + itemsPerPage);
  }, [filteredScales, itemsPerPage, safeCurrentPage]);

  const customRatesCount = useMemo(() => {
    return Object.keys(customSalaryRates).length + Object.keys(customTypeRates).length;
  }, [customSalaryRates, customTypeRates]);

  // Handle saving inline edit
  const handleSaveCellRate = (scaleCode: string, col: TypeColumnDef) => {
    const num = parseFloat(editValue.replace(/[^\d.-]/g, ""));
    if (isNaN(num) || num < 0) {
      toast.error("Please enter a valid numeric rate");
      setEditingCell(null);
      return;
    }

    if (col.defaultRateField) {
      const nextCustomRates = {
        ...customSalaryRates,
        [scaleCode]: {
          ...(DEFAULT_SALARY_SCALES[scaleCode] || {}),
          ...(customSalaryRates[scaleCode] || {}),
          [col.defaultRateField]: num,
        },
      };
      updateAppData((prev) => ({ ...prev, customSalaryRates: nextCustomRates }), true, true);
      toast.success(
        `Saved rate for ${scaleCode} - ${col.label}: ${num.toLocaleString("en-US")} VND/h`
      );
    } else {
      const nextCustomTypeRates = {
        ...customTypeRates,
        [col.key]: num,
      };
      updateAppData((prev) => ({ ...prev, customTypeRates: nextCustomTypeRates }), true, true);
      toast.success(
        `Saved rate for ${col.label}: ${num.toLocaleString("en-US")} VND/h`
      );
    }

    setEditingCell(null);
  };

  // Reset all rates to default
  const handleResetAllToDefault = () => {
    if (
      window.confirm(
        "Are you sure you want to restore all salary scales and unit rates to default?"
      )
    ) {
      updateAppData((prev) => ({
        ...prev,
        customSalaryRates: undefined,
        customTypeRates: undefined,
      }), true, true);
      toast.success("All unit rates have been restored to system defaults");
    }
  };

  // Toggle Auto-fit Widths
  const handleToggleAutoFit = () => {
    setIsAutoFit((prev) => !prev);
    toast.info(
      !isAutoFit
        ? "Auto-fit column widths enabled"
        : "Expanded column widths enabled"
    );
  };

  // Add new custom scale
  const handleAddNewScale = () => {
    const code = newScaleCode.trim().toUpperCase();
    if (!code) {
      toast.error("Please enter a Scale Code (e.g. S8, SDN4)");
      return;
    }

    const acRate = parseFloat(newAcademicRate.replace(/[^\d.-]/g, "")) || 35000;
    const adRate = parseFloat(newAdminRate.replace(/[^\d.-]/g, "")) || 20000;

    const nextCustomRates = {
      ...customSalaryRates,
      [code]: {
        ac: acRate,
        ad: adRate,
        summer: 29474,
        outing: 26316,
        summerInstructors: 150000,
      },
    };

    updateAppData((prev) => ({ ...prev, customSalaryRates: nextCustomRates }), true, true);
    toast.success(`Created salary scale: ${code} (Academic: ${acRate.toLocaleString("en-US")}, Admin: ${adRate.toLocaleString("en-US")})`);
    setIsAddScaleOpen(false);
    setNewScaleCode("");
    setNewScaleName("");
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const rowsData = filteredScales.map((scale, idx) => {
        const rowObj: Record<string, string | number> = {
          "No.": idx + 1,
          "Scale Code": scale.code,
          "Scale Description": `${scale.name} - ${scale.desc}`,
        };

        academicColumns.forEach((c) => {
          rowObj[`[Academic] ${c.label} (VND/h)`] = getEffectiveRate(scale.code, c).rate;
        });

        adminColumns.forEach((c) => {
          rowObj[`[Admin] ${c.label} (VND/h)`] = getEffectiveRate(scale.code, c).rate;
        });

        return rowObj;
      });

      const ws = XLSX.utils.json_to_sheet(rowsData);
      XLSX.utils.book_append_sheet(wb, ws, "Unit_Rate_Type");
      XLSX.writeFile(wb, `Unit_Rate_Type_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Exported Unit Rate Type Excel sheet successfully");
    } catch {
      toast.error("Failed to export Excel sheet");
    }
  };

  // Compute column averages for summary footer
  const columnAverages = useMemo(() => {
    const avgMap: Record<string, number> = {};

    [...academicColumns, ...adminColumns].forEach((col) => {
      if (filteredScales.length === 0) {
        avgMap[col.key] = 0;
        return;
      }
      const sum = filteredScales.reduce((acc, scale) => {
        return acc + getEffectiveRate(scale.code, col).rate;
      }, 0);
      avgMap[col.key] = Math.round(sum / filteredScales.length);
    });

    return avgMap;
  }, [academicColumns, adminColumns, filteredScales, getEffectiveRate]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
      <div className="unified-table-frame table-container flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent border-0">
        {/* Unified Table Frame Header */}
        <div className="unified-table-frame-header table-header flex items-center justify-between shrink-0 w-full min-h-[50px] px-3.5 py-2 border-b border-border bg-[var(--table-header-bg,#FAF3E8)]">
          <div className="app-table-title-lockup min-w-0">
            <div className="app-table-title-line flex items-center gap-2">
              {onToggleSidebar ? (
                <button
                  onClick={onToggleSidebar}
                  className="table-initial-toggle shrink-0 cursor-pointer transition-all active:scale-95"
                  title={showSidebar ? "Hide Sidebar Panel" : "Show Sidebar Panel"}
                  aria-label={showSidebar ? "Hide Sidebar Panel" : "Show Sidebar Panel"}
                  aria-expanded={showSidebar}
                  type="button"
                >
                  <TableInitialMark label="UNIT RATE TYPE CONFIGURATION MATRIX" />
                </button>
              ) : (
                <TableInitialMark
                  label="UNIT RATE TYPE CONFIGURATION MATRIX"
                  className="text-primary"
                />
              )}
              <h3 className="font-bold uppercase tracking-wider text-primary text-[12px] leading-snug">
                <TableTitleRemainder label="UNIT RATE TYPE CONFIGURATION MATRIX" />
              </h3>
            </div>
            <p className="app-table-title-meta text-[10px] text-muted-foreground/80 font-medium font-sans leading-tight">
              Hourly unit rate matrix for Academic & Admin tasks (VND/hour). Click any cell to edit unit rate.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">
                SCALES
              </span>
              <span className="text-xs font-black text-foreground">
                {filteredScales.length} / {allScales.length}
              </span>
            </div>

            <div className="flex flex-col items-end border-l border-border/60 pl-4">
              <span className="text-[9px] font-bold text-foreground/60 uppercase tracking-tighter whitespace-nowrap">
                TOTAL TYPES
              </span>
              <div className="bg-card px-2.5 py-0.5 rounded-md border border-border/60 shadow-2xs">
                <span className="text-xs font-black text-primary tracking-tight">
                  {academicColumns.length + adminColumns.length} Types
                </span>
              </div>
            </div>

            {customRatesCount > 0 && (
              <div className="hidden sm:flex flex-col items-end border-l border-border/60 pl-4">
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter whitespace-nowrap">
                  CUSTOM
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                  <Sparkles className="w-2.5 h-2.5" /> {customRatesCount} Custom
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar & Control Bar */}
        <div className="shrink-0 px-3.5 py-2 bg-muted/25 border-b border-border flex items-center justify-between gap-2.5">
          {/* Left: Category Filter Chips (no outer container border) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("all")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                activeCategoryFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              All ({academicColumns.length + adminColumns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("academic")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === "academic"
                  ? "bg-amber-600 text-white shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>Academic ({academicColumns.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter("admin")}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                activeCategoryFilter === "admin"
                  ? "bg-sky-600 text-white shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Admin ({adminColumns.length})</span>
            </button>
            {customRatesCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategoryFilter("custom")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  activeCategoryFilter === "custom"
                    ? "bg-purple-600 text-white shadow-2xs font-bold"
                    : "text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Custom</span>
              </button>
            )}
          </div>

          {/* Right: Table Settings Icon Popover */}
          <div className="flex items-center gap-2 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="btn-unit-rates-table-settings"
                  className="relative h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-[11px] font-medium transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                  title="Cài đặt & Tác vụ bảng Unit Rate Type"
                >
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  <span>Cài đặt</span>
                  {searchQuery && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card shrink-0" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3 space-y-3 bg-card border border-border shadow-xl rounded-xl z-50">
                {/* Search inside Settings */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                    <span>Tìm kiếm thang lương</span>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                      >
                        Xóa tìm kiếm
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search scale code, name..."
                      className="w-full h-8 pl-8 pr-7 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Table Actions inside Settings */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-foreground block">Tác vụ bảng</span>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddScaleOpen(true)}
                      className="w-full h-8 px-2.5 flex items-center justify-between rounded-lg border border-border bg-muted/30 hover:bg-muted text-foreground text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>Thêm thang lương (Add Scale)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="w-full h-8 px-2.5 flex items-center justify-between rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất Excel (Export Excel)</span>
                      </div>
                    </button>

                    {customRatesCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllToDefault}
                        className="w-full h-8 px-2.5 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Khôi phục mặc định ({customRatesCount})</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Main Table Viewport */}
        <div className="flex-1 overflow-auto bg-card relative">
          <table
            className="w-full text-left border-collapse"
            style={{
              fontFamily: "var(--font-table, var(--font-main))",
              tableLayout: isAutoFit ? "auto" : "fixed",
            }}
          >
            {/* Header with Super Headers */}
            <thead className="sticky top-0 z-30">
              {/* Row 1: Super Headers */}
              <tr className="bg-[var(--table-column-header-bg,#F4ECD8)] text-[var(--table-column-header-text-color,#1e293b)] border-b border-border text-xs uppercase font-extrabold tracking-wider">
                {/* Column 1: No. with integrated Auto-fit button */}
                <th
                  rowSpan={2}
                  className="px-2 py-2 text-center border-r border-b-2 border-border bg-[var(--table-column-header-bg,#F4ECD8)] w-14 min-w-[56px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No.</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAutoFit();
                      }}
                      className={`rounded p-0.5 transition-colors cursor-pointer ${
                        isAutoFit
                          ? "text-primary hover:bg-primary/20 bg-primary/10"
                          : "text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                      title={isAutoFit ? "Auto-fit: Đang bật (Click để tắt)" : "Auto-fit: Đang tắt (Click để bật)"}
                      aria-label="Toggle Auto-fit column widths"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                    </button>
                  </div>
                </th>

                {/* Column 2: Scale Code */}
                <th
                  rowSpan={2}
                  className="px-3.5 py-2 border-r border-b-2 border-border bg-[var(--table-column-header-bg,#F4ECD8)] min-w-[90px]"
                >
                  Scale Code
                </th>

                {/* Column 3: Scale Description */}
                <th
                  rowSpan={2}
                  className="px-3.5 py-2 border-r border-b-2 border-border min-w-[180px]"
                >
                  Scale Description
                </th>

                {/* Super Header 1: Academic Hours */}
                {displayAcademicCols.length > 0 && (
                  <th
                    colSpan={displayAcademicCols.length}
                    className="px-3 py-2 text-center border-r border-b border-border bg-amber-500/15 text-amber-950 dark:text-amber-100 font-black tracking-wider"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                      <span>Academic Hours ({displayAcademicCols.length} Types)</span>
                    </div>
                  </th>
                )}

                {/* Super Header 2: Admin Hours */}
                {displayAdminCols.length > 0 && (
                  <th
                    colSpan={displayAdminCols.length}
                    className="px-3 py-2 text-center border-b border-border bg-sky-500/15 text-sky-950 dark:text-sky-100 font-black tracking-wider"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-sky-700 dark:text-sky-300" />
                      <span>Admin Hours ({displayAdminCols.length} Types)</span>
                    </div>
                  </th>
                )}
              </tr>

              {/* Row 2: Sub-headers (Types) */}
              <tr className="bg-[var(--table-column-header-bg,#F4ECD8)] text-[var(--table-column-header-text-color,#1e293b)] border-b-2 border-border text-[11px] font-bold">
                {/* Academic Sub-Columns */}
                {displayAcademicCols.map((col, cIdx) => (
                  <th
                    key={`ac-col-${col.key}`}
                    className={`px-2.5 py-2 text-right border-r border-border min-w-[110px] whitespace-nowrap bg-amber-500/5 ${
                      cIdx === displayAcademicCols.length - 1 && displayAdminCols.length > 0
                        ? "border-r-2 border-r-amber-500/40"
                        : ""
                    }`}
                    title={col.desc}
                  >
                    <div className="font-extrabold text-foreground">{col.label}</div>
                  </th>
                ))}

                {/* Admin Sub-Columns */}
                {displayAdminCols.map((col, cIdx) => (
                  <th
                    key={`ad-col-${col.key}`}
                    className={`px-2.5 py-2 text-right border-r border-border min-w-[110px] whitespace-nowrap bg-sky-500/5 ${
                      cIdx === displayAdminCols.length - 1 ? "border-r-0" : ""
                    }`}
                    title={col.desc}
                  >
                    <div className="font-extrabold text-foreground">{col.label}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/60 text-xs">
              {paginatedScales.map((scale, sIdx) => {
                const actualIndex =
                  itemsPerPage === Infinity
                    ? sIdx
                    : (safeCurrentPage - 1) * itemsPerPage + sIdx;

                return (
                  <tr
                    key={scale.code}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    {/* 1. No. (Auto-sequence STT) */}
                    <td className="px-3 py-2 text-center border-r border-border font-mono font-normal text-muted-foreground">
                      {actualIndex + 1}
                    </td>

                    {/* 2. Scale Code */}
                    <td className="px-3.5 py-2 border-r border-border font-mono font-normal text-xs text-foreground">
                      {scale.code}
                    </td>

                    {/* 3. Scale Description */}
                    <td className="px-3.5 py-2 border-r border-border">
                      <div className="font-normal text-foreground">{scale.name}</div>
                      <div
                        className="text-[10.5px] text-muted-foreground truncate max-w-[210px]"
                        title={scale.desc}
                      >
                        {scale.desc}
                      </div>
                    </td>

                    {/* Academic Types Data Cells */}
                    {displayAcademicCols.map((col, cIdx) => {
                      const { rate, isCustom } = getEffectiveRate(scale.code, col);
                      const isEditing =
                        editingCell?.scaleCode === scale.code &&
                        editingCell?.typeKey === col.key;

                      return (
                        <td
                          key={`ac-val-${scale.code}-${col.key}`}
                          className={`px-2.5 py-1.5 border-r border-border text-right ${
                            cIdx === displayAcademicCols.length - 1 &&
                            displayAdminCols.length > 0
                              ? "border-r-2 border-r-amber-500/40"
                              : ""
                          }`}
                        >
                          {isEditing ? (
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-6 w-20 px-1 text-right text-xs font-normal font-mono border-2 border-primary rounded bg-card text-foreground focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleSaveCellRate(scale.code, col);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveCellRate(scale.code, col)
                                }
                                className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingCell({
                                  scaleCode: scale.code,
                                  typeKey: col.key,
                                });
                                setEditValue(String(rate));
                              }}
                              className={`group/cell flex items-center justify-end gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:bg-primary/10 ${
                                isCustom
                                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 font-normal border border-amber-500/30"
                                  : "font-mono font-normal text-foreground"
                              }`}
                              title={`Click to edit unit rate for ${scale.code} - ${col.label}`}
                            >
                              <span className="tabular-nums font-normal text-[11.5px]">
                                {rate.toLocaleString("vi-VN")}
                              </span>
                              <Edit2 className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Admin Types Data Cells */}
                    {displayAdminCols.map((col, cIdx) => {
                      const { rate, isCustom } = getEffectiveRate(scale.code, col);
                      const isEditing =
                        editingCell?.scaleCode === scale.code &&
                        editingCell?.typeKey === col.key;

                      return (
                        <td
                          key={`ad-val-${scale.code}-${col.key}`}
                          className={`px-2.5 py-1.5 border-r border-border text-right ${
                            cIdx === displayAdminCols.length - 1
                              ? "border-r-0"
                              : ""
                          }`}
                        >
                          {isEditing ? (
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-6 w-20 px-1 text-right text-xs font-normal font-mono border-2 border-primary rounded bg-card text-foreground focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleSaveCellRate(scale.code, col);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSaveCellRate(scale.code, col)
                                }
                                className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingCell({
                                  scaleCode: scale.code,
                                  typeKey: col.key,
                                });
                                setEditValue(String(rate));
                              }}
                              className={`group/cell flex items-center justify-end gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:bg-primary/10 ${
                                isCustom
                                  ? "bg-sky-500/10 text-sky-800 dark:text-sky-300 font-normal border border-sky-500/30"
                                  : "font-mono font-normal text-foreground"
                              }`}
                              title={`Click to edit unit rate for ${scale.code} - ${col.label}`}
                            >
                              <span className="tabular-nums font-normal text-[11.5px]">
                                {rate.toLocaleString("vi-VN")}
                              </span>
                              <Edit2 className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Footer Summary Row */}
            <tfoot className="sticky bottom-0 z-30 bg-[var(--table-column-header-bg,#F4ECD8)] text-[var(--table-column-header-text-color,#1e293b)] text-[11px] border-t-2 border-border shadow-[0_-3px_12px_rgba(0,0,0,0.08)]">
              <tr>
                <td className="px-3 py-2 text-center border-r border-border bg-[var(--table-column-header-bg,#F4ECD8)] font-normal">
                  Σ
                </td>
                <td className="px-3.5 py-2 border-r border-border bg-[var(--table-column-header-bg,#F4ECD8)] font-normal uppercase text-foreground">
                  {filteredScales.length} Scales
                </td>
                <td className="px-3.5 py-2 border-r border-border text-foreground/80 font-normal">
                  Average Rate
                </td>
                {displayAcademicCols.map((col) => (
                  <td
                    key={`footer-ac-${col.key}`}
                    className="px-2.5 py-2 text-right border-r border-border font-mono font-normal text-[11px] tabular-nums text-foreground"
                  >
                    {(columnAverages[col.key] || 0).toLocaleString("vi-VN")}
                  </td>
                ))}
                {displayAdminCols.map((col, idx) => (
                  <td
                    key={`footer-ad-${col.key}`}
                    className={`px-2.5 py-2 text-right border-r border-border font-mono font-normal text-[11px] tabular-nums text-foreground ${
                      idx === displayAdminCols.length - 1 ? "border-r-0" : ""
                    }`}
                  >
                    {(columnAverages[col.key] || 0).toLocaleString("vi-VN")}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Pagination & Rows Per Page Controls */}
        <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 border-t border-border bg-[var(--table-header-bg,#FAF3E8)] text-xs text-foreground/80">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground">
              Showing{" "}
              <strong>
                {filteredScales.length === 0
                  ? 0
                  : (safeCurrentPage - 1) * (itemsPerPage === Infinity ? filteredScales.length : itemsPerPage) + 1}
                -
                {itemsPerPage === Infinity
                  ? filteredScales.length
                  : Math.min(safeCurrentPage * itemsPerPage, filteredScales.length)}
              </strong>{" "}
              of <strong>{filteredScales.length}</strong> salary scales
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
              <span className="text-[10px] text-muted-foreground font-bold uppercase">
                Rows:
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(val) => {
                  setItemsPerPage(val === "all" ? Infinity : Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-6 w-16 text-[11px] bg-card border-border px-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-[99999]">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-bold px-2 tabular-nums">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Add Custom Scale */}
      <Dialog open={isAddScaleOpen} onOpenChange={setIsAddScaleOpen}>
        <DialogContent className="max-w-md bg-card rounded-2xl border border-border shadow-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Add New Salary Scale
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new salary scale code and configure default hourly unit rates.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase text-foreground/80">
                Scale Code *
              </label>
              <input
                type="text"
                placeholder="e.g. S8, SDN4, S-CORP..."
                value={newScaleCode}
                onChange={(e) => setNewScaleCode(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-bold uppercase focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase text-foreground/80">
                Scale Name / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Scale 8 - Senior Specialist"
                value={newScaleName}
                onChange={(e) => setNewScaleName(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  Academic Rate (VND/h)
                </label>
                <input
                  type="text"
                  placeholder="35000"
                  value={newAcademicRate}
                  onChange={(e) => setNewAcademicRate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-sky-700 dark:text-sky-300">
                  Admin Rate (VND/h)
                </label>
                <input
                  type="text"
                  placeholder="20000"
                  value={newAdminRate}
                  onChange={(e) => setNewAdminRate(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono font-bold focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddScaleOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-bold border border-border hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddNewScale}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-2xs"
            >
              Create Scale
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TypeRatesTable;
