import React from "react";
import { ExternalLink } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./ui/hover-card";
import {
  getTransactionReferenceAudit,
  type TransactionReferenceAuditEntry,
  type TransactionReferenceField,
} from "../lib/utils/transaction-reference-sync";

function formatCorrectionTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsed);
}

export function TransactionReferenceCell({
  value,
  row,
  field,
  onOpenTransaction,
}: {
  value: unknown;
  row: Record<string, unknown>;
  field: TransactionReferenceField;
  onOpenTransaction?: (
    audit: TransactionReferenceAuditEntry,
    row: Record<string, unknown>,
  ) => void;
}) {
  const audit = getTransactionReferenceAudit(row, field);
  if (!audit) return <>{String(value ?? "")}</>;

  const oldValue = String(audit.oldValue ?? "").trim() || "(trống)";
  const newValue = String(value ?? audit.newValue ?? "").trim() || "(trống)";

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <HoverCard openDelay={160} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-amber-100/35 text-[8px] font-black leading-none text-amber-700/55 transition-colors hover:border-amber-500/60 hover:bg-amber-100 hover:text-amber-800"
            aria-label={`Xem lịch sử sửa ${audit.fieldLabel}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenTransaction?.(audit, row);
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            !
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-80 border-amber-200/80 bg-white p-3 text-[11px] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-2">
            <p className="font-extrabold uppercase tracking-wider text-amber-800">
              Đã đồng bộ từ Transaction
            </p>
            <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1 text-slate-600">
              <dt>Giá trị cũ</dt>
              <dd className="break-all font-semibold text-slate-800">{oldValue}</dd>
              <dt>Giá trị mới</dt>
              <dd className="break-all font-semibold text-emerald-700">{newValue}</dd>
              <dt>Thời điểm</dt>
              <dd className="font-medium text-slate-700">
                {formatCorrectionTime(audit.correctedAt)}
              </dd>
            </dl>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 font-bold text-sky-700 hover:bg-sky-100"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenTransaction?.(audit, row);
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Mở ô tham chiếu tại Transaction
            </button>
          </div>
        </HoverCardContent>
      </HoverCard>
      <span className="truncate">{newValue}</span>
    </span>
  );
}
