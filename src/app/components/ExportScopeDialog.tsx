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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xuất Excel</DialogTitle>
          <DialogDescription>Bạn muốn xuất riêng bảng này hay toàn bộ trang?</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => run(onTable)}>Chỉ bảng này</Button>
          <Button onClick={() => run(onPage)}>Toàn bộ trang</Button>
        </div>
      </DialogContent>
    </Dialog>,
  );
}
