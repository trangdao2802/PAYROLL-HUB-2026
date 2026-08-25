/* eslint-disable @typescript-eslint/no-unused-vars */
import { Link, useLocation } from "react-router";
import {
  ListChecks,
  Users,
  ChevronRight,
  Banknote,
  Coins,
  CircleDollarSign,
  RefreshCw,
  Flower2,
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  BarChart3,
  Database,
  Wrench,
  X,
  Building2,
  Table2,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { CalendarIcon } from "lucide-react";
import { MonthPicker } from "../shared/MonthPicker";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onCloseMobile?: () => void;
  onOpenSettings?: () => void;
}

const navItems: { to: string; icon: React.ElementType; label: string }[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/centers", icon: BarChart3, label: "Timesheet" },
  { to: "/audit", icon: ShieldCheck, label: "Audit" },
  { to: "/master-ae", icon: Database, label: "Master" },
  { to: "/hold-dashboard", icon: Wallet, label: "Balance" },
];

export function LeftSidebar({
  isCollapsed,
  onToggle,
  onCloseMobile,
  onOpenSettings,
}: SidebarProps) {
  const location = useLocation();
  const { appData, updateAppData } = useAppData();

  const showMonthCard = location.pathname === "/master-ae" || location.pathname === "/hold-dashboard";
  const currentMonth = appData.globalMonth || "03.2026";

  const parseToInputMonth = (m: string) => {
    if (!m) return "";
    const parts = m.split(".");
    if (parts.length === 2) {
      const [month, year] = parts;
      if (month.length === 2 && year.length === 4) {
        return `${year}-${month}`;
      }
    }
    return "";
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [year, month] = val.split("-");
      if (year && month) {
        updateAppData((prev) => ({ ...prev, globalMonth: `${month}.${year}` }));
      }
    }
  };

  return (
    <motion.div
      id="app-sidebar"
      className="side-panel relative h-full shrink-0 flex flex-col z-50 bg-transparent"
    >
      {/* Logo Section */}
      <div
        style={{ padding: "12px", marginBottom: "12px" }}
        className="flex items-center justify-center w-full relative z-10 bg-transparent flex-col gap-4"
      >
        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden absolute top-0 right-0 bg-destructive text-white p-1 rounded-bl-lg"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {showMonthCard && (
          <div className={`w-full flex-col items-center bg-primary/10 rounded-2xl p-2 mt-2 ${isCollapsed ? 'hidden' : 'flex'}`}>
            <label className="text-[10px] font-bold text-primary mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> Tháng
            </label>
            <MonthPicker
              value={currentMonth}
              onChange={(newVal) => {
                if (newVal) {
                  updateAppData((prev) => ({ ...prev, globalMonth: newVal }));
                }
              }}
              align="center"
            />
          </div>
        )}
        
        {showMonthCard && isCollapsed && (
          <Tooltip delayDuration={0}>
             <TooltipTrigger className="flex flex-col items-center bg-primary/10 rounded-xl p-3 mt-2 w-full justify-center">
               <CalendarIcon className="w-5 h-5 text-primary" />
             </TooltipTrigger>
             <TooltipContent side="right">Tháng: {currentMonth}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nav Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col items-center gap-4 py-4 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Tooltip key={item.to} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  style={{ width: "56px", height: "56px" }}
                  className={`relative flex items-center justify-center rounded-2xl transition-all duration-300 group ${
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/20 ring-1 ring-primary/20"
                      : "bg-transparent text-slate-500 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-primary"} transition-colors`}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-primary text-white font-bold text-[0.65rem] uppercase px-3 py-1.5 rounded-lg border-none"
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Settings at Bottom */}
      <div className="mt-auto p-4 w-full flex flex-col items-center relative z-10 pb-8">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              style={{ width: "56px", height: "56px" }}
              className="flex items-center justify-center rounded-2xl transition-colors duration-300 text-slate-500 hover:bg-primary/5 hover:text-primary"
            >
              <Wrench className="w-5 h-5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-primary text-white font-bold text-[0.65rem] uppercase px-3 py-1.5 rounded-lg border-none"
          >
            Settings
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
