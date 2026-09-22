import { useEffect, useState } from "react";
import { useAppData } from "../../lib/contexts/AppDataContext";
import { motion, AnimatePresence } from "motion/react";

export function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAppData();
  const [loaderTimedOut, setLoaderTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    const safetyTimer = window.setTimeout(() => {
      // Storage hydration continues in the background, but a slow/stalled
      // IndexedDB read must never make the whole application unusable.
      setLoaderTimedOut(true);
    }, 1800);

    return () => window.clearTimeout(safetyTimer);
  }, [isLoading]);

  return (
    <>
      <AnimatePresence>
        {isLoading && !loaderTimedOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm"
          >
            <div className="w-64 space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 text-center">
                Đang xử lý dữ liệu...
              </p>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-indigo-600"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: 2,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
