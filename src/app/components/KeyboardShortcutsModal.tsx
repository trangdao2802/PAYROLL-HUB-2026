import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "global" | "table" | "navigation";
}

const SHORTCUTS: ShortcutItem[] = [
  {
    category: "global",
    keys: ["Ctrl", "R"],
    description: "Làm mới dữ liệu & giao diện trang hiện tại (không tải lại cả web)",
  },
  {
    category: "global",
    keys: ["Ctrl", "B"],
    description: "Thu gọn / Mở rộng thanh điều hướng bên (Sidebar)",
  },
  {
    category: "global",
    keys: ["Ctrl", "/"],
    description: "Mở bảng danh sách phím tắt này",
  },
  {
    category: "table",
    keys: ["Ctrl", "C"],
    description: "Sao chép ô hoặc vùng các ô đã chọn vào Clipboard",
  },
  {
    category: "table",
    keys: ["Ctrl", "V"],
    description: "Dán dữ liệu bảng từ Clipboard vào các ô",
  },
  {
    category: "table",
    keys: ["Ctrl", "A"],
    description: "Chọn tất cả các dòng / ô trong bảng dữ liệu",
  },
  {
    category: "table",
    keys: ["Ctrl", "D"],
    description: "Sao chép giá trị từ ô phía trên xuống ô đang chọn (Fill Down)",
  },
  {
    category: "table",
    keys: ["Enter"],
    description: "Bắt đầu chỉnh sửa ô đang chọn / Lưu giá trị đã sửa",
  },
  {
    category: "navigation",
    keys: ["Tab"],
    description: "Di chuyển đến ô tiếp theo sang bên phải",
  },
  {
    category: "navigation",
    keys: ["Shift", "Tab"],
    description: "Di chuyển lùi về ô trước đó",
  },
  {
    category: "navigation",
    keys: ["↑", "↓", "←", "→"],
    description: "Điều hướng di chuyển giữa các ô trong bảng",
  },
  {
    category: "global",
    keys: ["Esc"],
    description: "Đóng cửa sổ bật lên / Hủy bỏ thao tác chỉnh sửa ô",
  },
];

export const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "?" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    const handleOpenEvent = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-keyboard-shortcuts", handleOpenEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-keyboard-shortcuts", handleOpenEvent);
    };
  }, []);

  const isMac =
    typeof window !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const renderKey = (key: string) => {
    if (key === "Ctrl" && isMac) return "⌘ Cmd";
    return key;
  };

  const globalShortcuts = SHORTCUTS.filter((s) => s.category === "global");
  const tableShortcuts = SHORTCUTS.filter((s) => s.category === "table");
  const navShortcuts = SHORTCUTS.filter((s) => s.category === "navigation");

  return (
    <>
      {/* Floating helper trigger button at bottom-right */}
      <button
        type="button"
        id="btn-global-keyboard-shortcuts"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-3 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-background/50 hover:bg-background/80 border border-border/50 shadow-xs backdrop-blur-md text-muted-foreground hover:text-primary transition-all active:scale-95 cursor-pointer select-none group"
        title="Phím tắt hệ thống (Ctrl + /)"
        aria-label="Phím tắt hệ thống (Ctrl + /)"
      >
        <Keyboard className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          id="modal-keyboard-shortcuts"
          className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-6"
        >
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Phím tắt hệ thống</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Toàn cục
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Các tổ hợp phím giúp thao tác và xử lý bảng tính nhanh chóng
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Toàn cục */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1">
                Phím tắt chung
              </h4>
              <div className="space-y-1.5">
                {globalShortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 border border-slate-200/50 dark:border-slate-800 transition-colors"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                        >
                          {renderKey(k)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bảng dữ liệu */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1">
                Thao tác trên bảng dữ liệu (Data Table)
              </h4>
              <div className="space-y-1.5">
                {tableShortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 border border-slate-200/50 dark:border-slate-800 transition-colors"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                        >
                          {renderKey(k)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Điều hướng */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-1">
                Điều hướng ô & trang
              </h4>
              <div className="space-y-1.5">
                {navShortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 border border-slate-200/50 dark:border-slate-800 transition-colors"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                        >
                          {renderKey(k)}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Mẹo: Bạn có thể nhấn phím <kbd className="font-mono font-bold text-slate-600 dark:text-slate-300">?</kbd> bất cứ lúc nào để mở bảng này.</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
