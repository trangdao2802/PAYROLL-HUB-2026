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
    },
    {
      title: "Audit Center",
      path: "/audit",
      desc: "Compare source data and review payroll discrepancies.",
      icon: <ShieldCheck className="h-5 w-5" />,
    },
    {
      title: "Balance",
      path: "/hold-dashboard",
      desc: "Track trial balance, deductions and carried Hold records.",
      icon: <Scale className="h-5 w-5" />,
    },
    {
      title: "Timesheet Hub",
      path: "/centers",
      desc: "Review roster hours, center payments and MKT allocation.",
      icon: <Clock className="h-5 w-5" />,
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
              <TableInitialMark label="Restore cards" className="text-primary" />
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
                  className="group relative flex min-h-[190px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_14px_34px_-30px_color-mix(in_srgb,var(--primary)_65%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_22px_46px_-32px_color-mix(in_srgb,var(--primary)_70%,transparent)] sm:p-6"
                >
                  <Link
                    to={card.path}
                    aria-label={`Open ${card.title}`}
                    className="absolute inset-0 z-0 rounded-2xl"
                  />

                  <div className="pointer-events-none relative z-[1] flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary transition-transform group-hover:scale-105">
                      {card.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tabular-nums tracking-[0.16em] text-muted-foreground/70">
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
                        <h2 className="font-serif text-xl font-bold text-foreground transition-colors group-hover:text-primary sm:text-2xl">
                          {card.title}
                        </h2>
                        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                          {card.desc}
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all group-hover:border-primary/25 group-hover:bg-primary group-hover:text-primary-foreground">
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
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Platform
                  </span>
                  <span className="font-serif text-sm font-bold text-foreground">Operational</span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Working date
                  </span>
                  <span className="font-serif text-sm font-bold text-foreground">
                    {new Date().toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.07] text-primary">
                  <Layers3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Visible modules
                  </span>
                  <span className="font-serif text-sm font-bold text-foreground">
                    {visibleCards.length} / {cards.length}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/audit")}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
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
