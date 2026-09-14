import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity,
  ArrowRight,
  Calendar,
  Clock,
  Database,
  Layers3,
  Play,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { TableInitialMark } from "../../components/TableInitialMark";

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

  const toggleCardVisibility = (path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setHiddenCards((previous) => {
      const next = previous.includes(path)
        ? previous.filter((item) => item !== path)
        : [...previous, path];
      localStorage.setItem("dashboard_hidden_cards", JSON.stringify(next));
      return next;
    });
  };

  const restoreCards = () => {
    setHiddenCards([]);
    localStorage.removeItem("dashboard_hidden_cards");
  };

  const cards = [
    {
      title: "Master AE",
      path: "/master-ae",
      desc: "Manage AE source files, mappings and payroll configuration.",
      icon: <Database className="h-5 w-5" />,
      tone: {
        card: "border-[#E8B0A5] bg-[#FDF7F6] hover:border-[#CC7C6B] shadow-[0_12px_30px_-24px_rgba(204,124,107,0.45)]",
        iconBox: "border-[#E8B0A5] bg-[#FBF1EF] text-[#59261D]",
        title: "group-hover:text-[#59261D]",
        arrow: "group-hover:border-[#CC7C6B] group-hover:bg-[#CC7C6B] group-hover:text-white",
        tag: "bg-[#FBF1EF] text-[#59261D] border-[#E8B0A5]",
      },
    },
    {
      title: "Audit Center",
      path: "/audit",
      desc: "Compare source data and review payroll discrepancies.",
      icon: <ShieldCheck className="h-5 w-5" />,
      tone: {
        card: "border-[#DFD0D6] bg-[#FAF7F8] hover:border-[#A26377] shadow-[0_12px_30px_-24px_rgba(162,99,119,0.45)]",
        iconBox: "border-[#DFD0D6] bg-[#F8EEF1] text-[#2D2126]",
        title: "group-hover:text-[#2D2126]",
        arrow: "group-hover:border-[#A26377] group-hover:bg-[#A26377] group-hover:text-white",
        tag: "bg-[#F8EEF1] text-[#2D2126] border-[#DFD0D6]",
      },
    },
    {
      title: "Balance",
      path: "/hold-dashboard",
      desc: "Track trial balance, deductions and carried Hold records.",
      icon: <Scale className="h-5 w-5" />,
      tone: {
        card: "border-[#CCD8DF] bg-[#F5F8FA] hover:border-[#6F8E9F] shadow-[0_12px_30px_-24px_rgba(111,142,159,0.45)]",
        iconBox: "border-[#CCD8DF] bg-[#E4ECEF] text-[#1E2C35]",
        title: "group-hover:text-[#1E2C35]",
        arrow: "group-hover:border-[#6F8E9F] group-hover:bg-[#6F8E9F] group-hover:text-white",
        tag: "bg-[#E4ECEF] text-[#1E2C35] border-[#CCD8DF]",
      },
    },
    {
      title: "Timesheet Hub",
      path: "/centers",
      desc: "Review roster hours, center payments and MKT allocation.",
      icon: <Clock className="h-5 w-5" />,
      tone: {
        card: "border-[#F5DC9C] bg-[#FFFBF2] hover:border-[#D4A338] shadow-[0_12px_30px_-24px_rgba(212,163,56,0.45)]",
        iconBox: "border-[#F5DC9C] bg-[#FDF7EA] text-[#574116]",
        title: "group-hover:text-[#574116]",
        arrow: "group-hover:border-[#D4A338] group-hover:bg-[#D4A338] group-hover:text-white",
        tag: "bg-[#FDF7EA] text-[#574116] border-[#F5DC9C]",
      },
    },
  ];

  const visibleCards = cards.filter((card) => !hiddenCards.includes(card.path));

  return (
    <div
      id="dashboard-container"
      className="h-full min-h-0 w-full overflow-x-hidden overflow-y-auto bg-transparent p-3 text-foreground sm:p-4 lg:p-5"
    >
      <div className="mx-auto grid min-h-full w-full max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] gap-4 lg:gap-5">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-card/75 px-5 py-4 shadow-[0_18px_45px_-38px_color-mix(in_srgb,var(--primary)_55%,transparent)] backdrop-blur-sm sm:flex-row sm:items-center lg:px-7 lg:py-5">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Primary workspace
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Dashboard Overview
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              One workspace for payroll processing, timesheets, audit controls and monthly balances.
            </p>
          </div>

          {hiddenCards.length > 0 && (
            <button
              type="button"
              onClick={restoreCards}
              className="flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs transition-colors hover:bg-muted sm:self-center"
            >
              Restore cards ({hiddenCards.length})
            </button>
          )}
        </header>

        <main className="grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="flex min-h-0 flex-col rounded-2xl border border-border/80 bg-card/45 p-3 sm:p-4 lg:col-span-9">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Core modules
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {visibleCards.length} of {cards.length} available
                </p>
              </div>
              <Layers3 className="h-4 w-4 text-primary/65" />
            </div>

            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              {visibleCards.map((card, index) => (
                <article
                  key={card.path}
                  className={`group relative flex min-h-[190px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 sm:p-6 ${card.tone.card}`}
                >
                  <Link
                    to={card.path}
                    aria-label={`Open ${card.title}`}
                    className="absolute inset-0 z-0 rounded-2xl"
                  />

                  <div className="pointer-events-none relative z-[1] flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-transform group-hover:scale-105 ${card.tone.iconBox}`}>
                      {card.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold tabular-nums tracking-[0.16em] px-2 py-0.5 rounded-full border ${card.tone.tag}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => toggleCardVisibility(card.path, event)}
                        title="Hide this card"
                        aria-label={`Hide ${card.title}`}
                        className="table-initial-toggle pointer-events-auto relative z-10 cursor-pointer text-muted-foreground transition-colors"
                      >
                        <TableInitialMark label={card.title} />
                      </button>
                    </div>
                  </div>

                  <div className="pointer-events-none relative z-[1] mt-8">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className={`font-serif text-xl font-bold text-foreground transition-colors sm:text-2xl ${card.tone.title}`}>
                          {card.title}
                        </h2>
                        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                          {card.desc}
                        </p>
                      </div>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all ${card.tone.arrow}`}>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-[0_18px_45px_-38px_color-mix(in_srgb,var(--primary)_55%,transparent)] lg:col-span-3 lg:p-6">
            <div className="border-b border-border/70 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                System status
              </p>
              <h2 className="mt-1 font-serif text-xl font-bold text-foreground">
                Ready to process
              </h2>
            </div>

            <div className="grid flex-1 content-center gap-3 py-5">
              <div className="flex items-center gap-3 rounded-xl border border-[#F5DC9C] bg-[#FFFBF2] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#F5DC9C] bg-[#FDF7EA] text-[#574116]">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Platform
                  </span>
                  <span className="font-serif text-sm font-bold text-[#574116]">Operational</span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-[#CCD8DF] bg-[#F5F8FA] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#CCD8DF] bg-[#E4ECEF] text-[#1E2C35]">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Working date
                  </span>
                  <span className="font-serif text-sm font-bold text-[#1E2C35]">
                    {new Date().toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-[#DFD0D6] bg-[#FAF7F8] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DFD0D6] bg-[#F8EEF1] text-[#2D2126]">
                  <Layers3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Visible modules
                  </span>
                  <span className="font-serif text-sm font-bold text-[#2D2126]">
                    {visibleCards.length} / {cards.length}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/audit")}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#A26377] hover:bg-[#8e5264] px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" />
              Run audit process
            </button>
          </aside>
        </main>
      </div>
    </div>
  );
}
