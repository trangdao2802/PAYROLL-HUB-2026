const DYNAMIC_IMPORT_RELOAD_PREFIX = "payroll:dynamic-import-reload:";
const RELOAD_GUARD_MS = 60_000;

export function isDynamicImportError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .+ failed|error loading dynamically imported module|Failed to load module script|Expected a JavaScript-or-Wasm module script/i.test(
    message,
  );
}

export function reloadLatestAppVersion(routeKey = "app"): boolean {
  if (typeof window === "undefined") return false;

  const storageKey = `${DYNAMIC_IMPORT_RELOAD_PREFIX}${routeKey}`;
  const globalStorageKey = `${DYNAMIC_IMPORT_RELOAD_PREFIX}app`;
  const now = Date.now();
  const lastReload = Number(
    window.sessionStorage.getItem(globalStorageKey) ||
      window.sessionStorage.getItem(storageKey) ||
      0,
  );
  if (lastReload && now - lastReload < RELOAD_GUARD_MS) return false;

  window.sessionStorage.setItem(globalStorageKey, String(now));
  window.sessionStorage.setItem(storageKey, String(now));
  const url = new URL(window.location.href);
  url.searchParams.set("__app_reload", String(now));
  window.location.replace(url.toString());
  return true;
}

function clearReloadGuard(routeKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${DYNAMIC_IMPORT_RELOAD_PREFIX}app`);
  window.sessionStorage.removeItem(`${DYNAMIC_IMPORT_RELOAD_PREFIX}${routeKey}`);

  const url = new URL(window.location.href);
  if (url.searchParams.has("__app_reload")) {
    url.searchParams.delete("__app_reload");
    window.history.replaceState(window.history.state, "", url.toString());
  }
}

export async function loadRouteModule<T>(
  routeKey: string,
  importer: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const module = await importer();
      clearReloadGuard(routeKey);
      return module;
    } catch (error) {
      lastError = error;
      if (!isDynamicImportError(error) || attempt >= retries) break;
      await new Promise((resolve) =>
        window.setTimeout(resolve, 350 * (attempt + 1)),
      );
    }
  }

  if (isDynamicImportError(lastError) && reloadLatestAppVersion(routeKey)) {
    // Navigation is in progress. Keep the rejected lazy route from rendering
    // React Router's generic error screen before the fresh document arrives.
    return new Promise<T>(() => undefined);
  }
  throw lastError;
}

let holdDashboardPagePromise:
  | Promise<typeof import("../pages/04-balance/HoldDashboardPage")>
  | undefined;

export function loadHoldDashboardPage() {
  holdDashboardPagePromise ??= loadRouteModule(
    "hold-dashboard",
    () => import("../pages/04-balance/HoldDashboardPage"),
  ).catch((error) => {
    holdDashboardPagePromise = undefined;
    throw error;
  });
  return holdDashboardPagePromise;
}
