import React, { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { SnapshotHistoryPanel } from "./SnapshotHistoryPanel";
import { getSnapshotsList } from "../../lib/utils/snapshot-manager";

export function SnapshotHistoryToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const list = await getSnapshotsList();
      setCount(list.length);
    };

    updateCount();

    const handleUpdate = () => {
      updateCount();
    };

    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("payroll-snapshots-updated", handleUpdate);
    window.addEventListener("open-snapshot-history", handleOpen);

    return () => {
      window.removeEventListener("payroll-snapshots-updated", handleUpdate);
      window.removeEventListener("open-snapshot-history", handleOpen);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        id="btn-nav-snapshot-history"
        onClick={() => setIsOpen(true)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all outline-none active:scale-[0.98] cursor-pointer ${
          isOpen
            ? "bg-primary text-primary-foreground border-primary shadow-xs"
            : "border-border/80 bg-card hover:bg-muted/80 text-foreground shadow-2xs"
        }`}
        title="Lịch sử phiên bản & Điểm khôi phục (Google Sheets style)"
        aria-label="Lịch sử phiên bản"
      >
        <RotateCcw className={`w-4 h-4 ${isOpen ? "text-primary-foreground" : "text-foreground/80"}`} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white tabular-nums shadow-xs">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <SnapshotHistoryPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default SnapshotHistoryToggle;
