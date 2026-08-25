import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { 
  Database, 
  CreditCard, 
  ShieldCheck, 
  Scale, 
  ArrowRight, 
  EyeOff, 
  Activity, 
  Calendar, 
  Play,
  RotateCcw,
  Clock
} from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();

  const [hiddenCards, setHiddenCards] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard_hidden_cards");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleCardVisibility = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenCards((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      localStorage.setItem("dashboard_hidden_cards", JSON.stringify(next));
      return next;
    });
  };

  const cards = [
    {
      title: "Master AE",
      path: "/master-ae",
      desc: "Manage AE data sheets & configuration",
      icon: <Database className="w-5 h-5 text-amber-700" />
    },
    {
      title: "Bulk Payment",
      path: "/payment",
      desc: "Process bank exports & transaction reconciliations",
      icon: <CreditCard className="w-5 h-5 text-amber-700" />
    },
    {
      title: "Audit Center",
      path: "/audit",
      desc: "Compare payroll data & detect discrepancies",
      icon: <ShieldCheck className="w-5 h-5 text-amber-700" />
    },
    {
      title: "Balance",
      path: "/hold-dashboard",
      desc: "Track & adjust trial balance and hold records",
      icon: <Scale className="w-5 h-5 text-amber-700" />
    },
    {
      title: "Timesheet Hub",
      path: "/centers",
      desc: "Review timecards & MKT Local North pivot fees",
      icon: <Clock className="w-5 h-5 text-amber-700" />
    }
  ];

  const visibleCards = cards.filter((c) => !hiddenCards.includes(c.path));

  return (
    <div id="dashboard-container" className="w-full h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 lg:p-10 bg-transparent text-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-600"></span>
              <span className="tabular-nums text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                PRIMARY VIEW
              </span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-slate-900 mb-2">
              Dashboard Overview
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Quản lý lương và kiểm toán chuyên nghiệp. Theo dõi phân phối thời gian thực và phát hiện các sai lệch.
            </p>
          </div>

          {hiddenCards.length > 0 && (
            <button
              onClick={() => {
                setHiddenCards([]);
                localStorage.removeItem("dashboard_hidden_cards");
              }}
              className="self-start flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Khôi phục thẻ ({hiddenCards.length})</span>
            </button>
          )}
        </div>

        {/* MAIN GRID CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* MODULE CARDS SECTION (LEFT 8 COLS) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Các Phân Hệ Chính ({visibleCards.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleCards.map((c) => (
                <div
                  key={c.path}
                  className="group relative bg-white border border-slate-200/90 hover:border-amber-500/50 rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[160px]"
                >
                  <Link
                    to={c.path}
                    aria-label={`Mở ${c.title}`}
                    className="absolute inset-0 z-0 rounded-2xl"
                  />

                  {/* Card Action Buttons */}
                  <div className="relative z-[1] pointer-events-none flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center transition-transform group-hover:scale-105">
                      {c.icon}
                    </div>

                    <button
                      onClick={(e) => toggleCardVisibility(c.path, e)}
                      title="Ẩn thẻ này"
                      className="relative z-10 pointer-events-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer opacity-80 group-hover:opacity-100"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="relative z-[1] pointer-events-none">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                        {c.title}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-700 group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {c.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SIDEBAR METRICS & ACTIONS (RIGHT 4 COLS) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col gap-6">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-slate-100">
                  Trạng Thái Hệ Thống
                </h2>

                <div className="flex flex-col gap-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                        System Status
                      </span>
                      <span className="text-base font-bold text-slate-800 font-serif italic">
                        Operational
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Last Audit
                      </span>
                      <span className="text-base font-bold text-slate-800 font-serif italic">
                        {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate('/audit')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-5 py-3.5 rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Audit Process</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
