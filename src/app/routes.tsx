import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { loadHoldDashboardPage } from "./lib/lazy-routes";
import { TimesheetHub } from "./pages/01-timesheet/TimesheetHub";

// Helper to retry dynamic imports if network or dev server momentarily drops
async function retryImport<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryImport(fn, retries - 1, delay * 1.5);
  }
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    HydrateFallback: () => (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Đang tải giao diện...
      </div>
    ),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await retryImport(() => import("./pages/00-dashboard/Dashboard"))).Dashboard,
        }),
      },
      {
        path: "centers",
        Component: TimesheetHub,
      },
      {
        path: "master-ae",
        lazy: async () => ({
          Component: (await retryImport(() => import("./pages/03-master/MasterAE"))).MasterAE,
        }),
      },
      {
        path: "hold-dashboard",
        lazy: async () => ({
          Component: (await loadHoldDashboardPage()).HoldDashboardPage,
        }),
      },
      {
        path: "audit",
        lazy: async () => ({
          Component: (await retryImport(() => import("./pages/02-audit/Audit"))).Audit,
        }),
      },
      {
        path: "payment",
        lazy: async () => ({
          Component: (await retryImport(() => import("./pages/04-balance/BulkPayment"))).BulkPayment,
        }),
      },
      {
        path: "pivot",
        lazy: async () => ({
          Component: (await retryImport(() => import("./pages/04-balance/PivotSheet"))).PivotSheet,
        }),
      },
    ],
  },
]);
