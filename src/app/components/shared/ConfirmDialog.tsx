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
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-none border-2 border-black bg-white/90 backdrop-blur-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-black text-black uppercase tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-black/80 font-bold">
            {displayDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={onClose}
            className="rounded-none border-2 border-black bg-white/90 backdrop-blur-md text-black hover:bg-black/5 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onClose();
            }}
            className={`rounded-none border-2 border-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${
              variant === "destructive"
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-black text-white hover:bg-black/90"
            }`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
