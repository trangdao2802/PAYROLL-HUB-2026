import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "default",
}: ConfirmDialogProps) {
  const displayDescription = description || "Vui lòng xác nhận hành động của bạn.";
  const isDestructive = variant === "destructive";
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[460px] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 font-[family-name:var(--font-table,var(--font-main))] text-card-foreground shadow-2xl">
        <AlertDialogHeader
          className="flex-row items-center gap-3 border-b border-border px-5 py-4 text-left"
          style={{ backgroundColor: "var(--table-header-bg, #FAF3E8)" }}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isDestructive ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary"}`}>
            {isDestructive ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
              Xác nhận thao tác dữ liệu
            </span>
            <AlertDialogTitle className="text-sm font-black uppercase tracking-tight text-foreground">
              {title}
            </AlertDialogTitle>
          </span>
        </AlertDialogHeader>
        <AlertDialogDescription className="px-5 py-5 text-xs font-medium leading-5 text-muted-foreground">
          {displayDescription}
        </AlertDialogDescription>
        <AlertDialogFooter className="flex-row justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
          <AlertDialogCancel
            onClick={onClose}
            className="mt-0 h-9 rounded-full border-border bg-card px-5 text-[10px] font-extrabold uppercase tracking-wider text-foreground shadow-sm hover:bg-muted"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onClose();
            }}
            className={`h-9 rounded-full border-0 px-5 text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
