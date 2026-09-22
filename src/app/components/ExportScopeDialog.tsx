import React from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";

export function chooseExcelExport(onTable: () => void, onPage = () => {
  window.dispatchEvent(new Event("app-export-section-excel"));
}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { root.unmount(); host.remove(); };
  const run = (action: () => void) => { close(); action(); };
  root.render(
    <Dialog open onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="!max-w-[380px] !w-[calc(100vw-32px)] !p-5 !gap-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
        <DialogHeader className="gap-1.5 text-left">
          <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            Xuất file Excel
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Bạn muốn xuất dữ liệu của riêng bảng này hay toàn bộ các bảng trong trang?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 px-3 rounded-lg font-medium border-slate-200 hover:bg-slate-100 text-slate-700"
            onClick={() => run(onTable)}
          >
            Chỉ bảng này
          </Button>
          <Button
            size="sm"
            className="text-xs h-8 px-3 rounded-lg font-medium bg-primary hover:bg-primary/90 text-white"
            onClick={() => run(onPage)}
          >
            Toàn bộ trang
          </Button>
        </div>
      </DialogContent>
    </Dialog>,
  );
}
