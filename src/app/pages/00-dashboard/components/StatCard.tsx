import { LucideIcon, ArrowUpRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  subtitle?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  subtitle,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`stat-card stat-group vintage-card p-6 flex flex-col justify-between h-full relative overflow-hidden bg-[var(--card,white)] text-[var(--card-foreground,#334155)] border border-[var(--border,#E2E8F0)] ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pattern-dots pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className={`p-4 bg-primary/20 rounded-full border border-primary/30 flex items-center justify-center shadow-inner`}
          >
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {title}
            </span>
            {onClick && (
              <ArrowUpRight className="w-4 h-4 text-primary/40 mt-1" />
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[0.65rem] font-bold uppercase text-primary/60 tracking-[0.2em]">
            {subtitle || "Summary"}
          </p>
          <div className="text-3xl font-serif text-foreground tracking-tight">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
