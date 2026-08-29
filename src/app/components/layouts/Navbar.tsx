/* eslint-disable @typescript-eslint/no-unused-vars */
import { Link, useLocation } from "react-router";
import {
  CircleDollarSign,
  Building2,
  Database,
  ShieldCheck,
  CreditCard,
  Table2,
  Bell,
  User,
  Settings,
  Settings2,
  Trash2,
  Menu,
  ListChecks,
  Users,
  BarChart3,
  Coins,
  Wallet,
  CalendarIcon,
  UploadCloud,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { TableData } from "../../types";
import { MonthPicker } from "../shared/MonthPicker";
import { toast } from "sonner";
import { syncReportingMonthReconciliation } from "../../lib/utils/reconciliation-sync";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const navigationItems = [
  { id: "dashboard", label: "dashboard", icon: LayoutDashboard, path: "/" },
  { id: "centers", label: "timesheet", icon: BarChart3, path: "/centers" },
  { id: "audit", label: "audit", icon: ShieldCheck, path: "/audit" },
  { id: "master-ae", label: "master", icon: Database, path: "/master-ae" },
  { id: "hold-dashboard", label: "balance", icon: Wallet, path: "/hold-dashboard" },
];

const pageTabs: Record<string, { id: string; label: string; icon: React.ElementType }[]> = {
  "/centers": [
    { id: "employee", label: "Total Paid Hours", icon: Users },
    { id: "center", label: "Roster Center", icon: Building2 },
    { id: "mkt_local_north", label: "Pivot Timesheet", icon: FileText },
    { id: "roster_raw", label: "Raw Data", icon: FileText },
    { id: "upload", label: "Cài đặt & Tải file (Timesheet)", icon: UploadCloud },
  ],
  "/audit": [
    { id: "main", label: "Audit Overview", icon: ShieldCheck },
    { id: "detail", label: "Audit Discrepancy Details", icon: AlertCircle },
    { id: "rules", label: "Allowed Intern Rules", icon: ListChecks },
  ],
  "/master-ae": [
    { id: "Sheet1_AE", label: "Gross Pay", icon: Database },
    { id: "Hold_AE", label: "Deductions", icon: Database },
    { id: "BulkPayment", label: "Bulk Payment", icon: Wallet },
    { id: "Pivot", label: "Pivot Master", icon: FileText },
    { id: "upload", label: "Cài đặt & Tải file (Master)", icon: UploadCloud },
  ],
};

interface NavbarProps {
  onToggleMobileMenu: () => void;
  onOpenSettings: () => void;
}

export function Navbar({ onToggleMobileMenu, onOpenSettings }: NavbarProps) {
  const location = useLocation();
  const { appData, updateAppData } = useAppData();
  const [timesheetActiveTabId, setTimesheetActiveTabId] = useState("employee");
  const [activeTabLabel, setActiveTabLabel] = useState(() => {
    return sessionStorage.getItem("active_timesheet_tab_label") || "Total Paid Hours";
  });

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.label) {
        setActiveTabLabel(detail.label);
        sessionStorage.setItem("active_timesheet_tab_label", detail.label);
      }
      if (detail && detail.tab) {
        setTimesheetActiveTabId(detail.tab);
      }
    };
    window.addEventListener("timesheet-tab-changed", handleTabChange);
    return () => {
      window.removeEventListener("timesheet-tab-changed", handleTabChange);
    };
  }, []);

  const isTimesheetPage = location.pathname === "/centers";
  
  const [masterActiveTab, setMasterActiveTab] = useState(() => {
    return (localStorage.getItem("master_ae_active_tab") as string) || "Sheet1_AE";
  });

  const [auditActiveTab, setAuditActiveTab] = useState(() => (
    sessionStorage.getItem("audit_active_tab") || "main"
  ));

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.tab) {
        setMasterActiveTab(detail.tab);
      }
    };
    window.addEventListener("master-ae-tab-changed", handleTabChange);
    return () => {
      window.removeEventListener("master-ae-tab-changed", handleTabChange);
    };
  }, []);

  useEffect(() => {
    const handleAuditTabChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.tab) {
        setAuditActiveTab(detail.tab);
        sessionStorage.setItem("audit_active_tab", detail.tab);
      }
    };
    window.addEventListener("audit-tab-changed", handleAuditTabChange);
    return () => {
      window.removeEventListener("audit-tab-changed", handleAuditTabChange);
    };
  }, []);

  const lookupPath = location.pathname;
  const currentTabId =
    lookupPath === "/master-ae" ? masterActiveTab :
    lookupPath === "/audit" ? auditActiveTab :
    lookupPath === "/centers" ? timesheetActiveTabId : "";

  const currentTabObj = pageTabs[lookupPath]?.find((t) => t.id === currentTabId);

  const currentPageLabel = (
    location.pathname === "/" ? "Dashboard" :
    location.pathname === "/hold-dashboard" ? "Balance" :
    currentTabObj ? currentTabObj.label :
    (isTimesheetPage ? activeTabLabel : "Select View")
  );

  const showMonthCard = location.pathname === "/master-ae" || location.pathname === "/hold-dashboard" || location.pathname === "/payment" || location.pathname === "/pivot";
  const shouldAutoSyncReconciliation = location.pathname === "/master-ae" || location.pathname === "/payment" || location.pathname === "/pivot";
  const currentMonth = appData.globalMonth || "03.2026";
  const bankSourceRowCount = appData.Bank_North_AE?.data?.length || 0;
  const lastAutoSyncedMonthRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldAutoSyncReconciliation || bankSourceRowCount === 0) {
      lastAutoSyncedMonthRef.current = null;
      return;
    }
    if (lastAutoSyncedMonthRef.current === currentMonth) return;

    lastAutoSyncedMonthRef.current = currentMonth;
    updateAppData((prev) =>
      syncReportingMonthReconciliation(prev, currentMonth),
    );
  }, [bankSourceRowCount, currentMonth, shouldAutoSyncReconciliation, updateAppData]);

  return (
    <header 
      id="app-navbar"
      className="navbar-header px-6 flex justify-between items-center relative z-40 shrink-0 w-full max-w-full overflow-visible h-[35.4924px] backdrop-blur-md transition-all duration-300 bg-transparent"
      style={{
        background: "transparent",
        height: "35.4924px",
      }}
    >
      {/* Oozing loang/bleed transition glow right below the navbar */}
      <div 
        className="absolute bottom-[-32px] left-0 right-0 h-32 pointer-events-none opacity-60 z-[-1]"
        style={{
          background: "transparent",
          filter: "blur(24px)",
        }}
      />
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="app-brand-lockup select-none border-0 bg-transparent p-0 shadow-none no-underline outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            title="Dashboard"
            aria-label="Về Dashboard"
            aria-current={location.pathname === "/" ? "page" : undefined}
          >
            <span className="sr-only">Payroll Hub</span>
            <span className="app-brand-wordmark" aria-hidden="true" />
          </Link>
          {location.pathname !== "/" && pageTabs[lookupPath] && (
            <div className="flex items-center animate-in fade-in slide-in-from-left-4 duration-300">
              <span className="text-muted-foreground/60 text-xs mr-2 tabular-nums select-none">/</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-1 h-7 text-accent hover:text-foreground transition-all group font-bold text-xs tracking-tight cursor-pointer active:scale-95 px-1 bg-transparent border-none shadow-none outline-none focus:outline-none focus-visible:outline-none"
                  >
                    <span style={{ fontFamily: "'Gentium Book Plus', serif", fontSize: "10.75px" }}>
                      {currentPageLabel}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 p-1.5 bg-card border border-border shadow-xl rounded-xl z-[9999]">
                  {pageTabs[lookupPath].map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => {
                        if (lookupPath === "/centers") {
                           window.dispatchEvent(new CustomEvent("timesheet-request-tab-change", { detail: { tab: t.id } }));
                        } else if (lookupPath === "/audit") {
                           window.dispatchEvent(new CustomEvent("audit-request-tab-change", { detail: { tab: t.id } }));
                        } else if (lookupPath === "/master-ae") {
                           window.dispatchEvent(new CustomEvent("master-ae-request-tab-change", { detail: { tab: t.id } }));
                        }
                      }}
                      className={`text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-2 hover:bg-accent/10 hover:text-accent focus:bg-accent/10 focus:text-accent transition-colors outline-none focus:outline-none focus-visible:outline-none ${
                        t.id === currentTabId ? "bg-accent/10 text-accent" : "text-foreground"
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5 opacity-70 text-accent" />
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-6 items-center">
              {navigationItems.filter((item) => item.id !== "dashboard").map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`font-sans lowercase font-semibold tracking-wider text-xs no-underline relative transition-all outline-none focus:outline-none focus-visible:outline-none ${
                      isActive ? "text-accent font-bold after:content-[''] after:absolute after:-bottom-[16px] after:left-0 after:w-full after:h-[2px] after:bg-accent" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
   
          <div className="text-right text-xs text-foreground flex items-center justify-end gap-3" style={{ fontFamily: "var(--font-main)" }}>
              {showMonthCard && (
                <div className="origin-right">
                  <MonthPicker
                    value={currentMonth}
                    onChange={(newVal) => {
                      if (newVal) {
                        updateAppData((prev) => ({ ...prev, globalMonth: newVal }));
                      }
                    }}
                    align="end"
                  />
                </div>
              )}
          </div>
        </div>
    </header>
  );
}
