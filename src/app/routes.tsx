import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { loadHoldDashboardPage, loadRouteModule } from "./lib/lazy-routes";
import { TimesheetHub } from "./pages/01-timesheet/TimesheetHub";
import { RouteErrorBoundary } from "./components/shared/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    errorElement: <RouteErrorBoundary />,
    HydrateFallback: () => (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Đang tải giao diện...
      </div>
    ),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await loadRouteModule("dashboard", () => import("./pages/00-dashboard/Dashboard"))).Dashboard,
        }),
      },
      {
        path: "centers",
        Component: TimesheetHub,
      },
      {
        path: "master-ae",
        lazy: async () => ({
          Component: (await loadRouteModule("master-ae", () => import("./pages/03-master/MasterAE"))).MasterAE,
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
          Component: (await loadRouteModule("audit", () => import("./pages/02-audit/Audit"))).Audit,
        }),
      },
      {
        path: "payment",
        lazy: async () => ({
          Component: (await loadRouteModule("payment", () => import("./pages/04-balance/BulkPayment"))).BulkPayment,
        }),
      },
      {
        path: "pivot",
        lazy: async () => ({
          Component: (await loadRouteModule("pivot", () => import("./pages/04-balance/PivotSheet"))).PivotSheet,
        }),
      },
    ],
  },
]);
