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

interface NavItemConfig {
  to: string;
  icon: React.ElementType;
  label: string;
  activeClass: string;
  hoverClass: string;
  iconActive: string;
  iconInactive: string;
  tooltipClass: string;
}

const navItems: NavItemConfig[] = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    activeClass: "bg-[#FAF7F7] text-[#3D2A2A] border border-[#CBBABA] shadow-sm ring-2 ring-[#3D2A2A]/20",
    hoverClass: "hover:bg-[#FAF7F7]/80 hover:text-[#3D2A2A]",
    iconActive: "text-[#3D2A2A]",
    iconInactive: "text-slate-500 group-hover:text-[#3D2A2A]",
    tooltipClass: "bg-[#3D2A2A] text-white",
  },
  {
    to: "/centers",
    icon: BarChart3,
    label: "Timesheet",
    activeClass: "bg-[#FDF7EA] text-[#574116] border border-[#F5DC9C] shadow-sm ring-2 ring-[#FBE8B9]/50",
    hoverClass: "hover:bg-[#FDF7EA]/70 hover:text-[#574116]",
    iconActive: "text-[#574116]",
    iconInactive: "text-slate-500 group-hover:text-[#574116]",
    tooltipClass: "bg-[#574116] text-white",
  },
  {
    to: "/audit",
    icon: ShieldCheck,
    label: "Audit",
    activeClass: "bg-[#F8EEF1] text-[#2D2126] border border-[#DFD0D6] shadow-sm ring-2 ring-[#A26377]/30",
    hoverClass: "hover:bg-[#F8EEF1]/60 hover:text-[#2D2126]",
    iconActive: "text-[#2D2126]",
    iconInactive: "text-slate-500 group-hover:text-[#2D2126]",
    tooltipClass: "bg-[#2D2126] text-white",
  },
  {
    to: "/master-ae",
    icon: Database,
    label: "Master AE",
    activeClass: "bg-[#FBF1EF] text-[#59261D] border border-[#E8B0A5] shadow-sm ring-2 ring-[#CC7C6B]/30",
    hoverClass: "hover:bg-[#FBF1EF]/80 hover:text-[#59261D]",
    iconActive: "text-[#59261D]",
    iconInactive: "text-slate-500 group-hover:text-[#59261D]",
    tooltipClass: "bg-[#59261D] text-white",
  },
  {
    to: "/hold-dashboard",
    icon: Wallet,
    label: "Balance",
    activeClass: "bg-[#E4ECEF] text-[#1E2C35] border border-[#CCD8DF] shadow-sm ring-2 ring-[#6F8E9F]/30",
    hoverClass: "hover:bg-[#E4ECEF]/60 hover:text-[#1E2C35]",
    iconActive: "text-[#1E2C35]",
    iconInactive: "text-slate-500 group-hover:text-[#1E2C35]",
    tooltipClass: "bg-[#1E2C35] text-white",
  },
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
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col items-center gap-3 py-4 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Tooltip key={item.to} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.to}
                  style={{ width: "52px", height: "52px" }}
                  className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 group active:scale-[0.96] ${
                    isActive
                      ? item.activeClass
                      : `bg-transparent text-slate-500 ${item.hoverClass}`
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 shrink-0 ${isActive ? item.iconActive : item.iconInactive} transition-colors`}
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className={`${item.tooltipClass} font-bold text-[0.65rem] uppercase px-3 py-1.5 rounded-lg border-none shadow-md`}
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Settings at Bottom */}
      <div className="mt-auto p-3 w-full flex flex-col items-center relative z-10 pb-6">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenSettings}
              style={{ width: "52px", height: "52px" }}
              className="flex items-center justify-center rounded-2xl transition-colors duration-200 text-slate-500 hover:bg-[#F8EEF1] hover:text-[#2D2126] hover:border hover:border-[#DFD0D6] active:scale-[0.96] cursor-pointer"
            >
              <Wrench className="w-5 h-5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-[#2D2126] text-white font-bold text-[0.65rem] uppercase px-3 py-1.5 rounded-lg border-none shadow-md"
          >
            Settings
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}
