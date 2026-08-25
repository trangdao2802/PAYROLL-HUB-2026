let holdDashboardPagePromise:
  | Promise<typeof import("../pages/04-balance/HoldDashboardPage")>
  | undefined;

export function loadHoldDashboardPage() {
  holdDashboardPagePromise ??= import("../pages/04-balance/HoldDashboardPage");
  return holdDashboardPagePromise;
}
