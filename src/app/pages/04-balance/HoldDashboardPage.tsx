import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { HoldAddDashboard } from "./components/HoldAddDashboard";

export function HoldDashboardPage(): React.ReactElement {
  return (
    <div className="trial-balance-page flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key="hold-dashboard-main"
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          className="trial-balance-page-content absolute inset-0 flex flex-col min-h-0 min-w-0 bg-transparent items-center overflow-hidden"
          style={{ padding: "12px" }}
        >
          <HoldAddDashboard />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
