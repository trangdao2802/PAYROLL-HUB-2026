/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppDataProvider } from "./lib/contexts/AppDataContext";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { Toaster, toast } from "sonner";
import { LoadingWrapper } from "./components/shared/LoadingWrapper";
import localforage from "localforage";
import {
  type UiSettings,
  loadUiSettings,
  applyUiSettings,
  UI_SETTINGS_KEY,
  TASTE_PRESETS,
} from "./lib/ui-settings";

export default function App() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === UI_SETTINGS_KEY + "_small" && e.newValue) {
        try {
          applyUiSettings(JSON.parse(e.newValue));
        } catch (err) {
          console.error("Failed to parse small ui settings string from localStorage on storage event.", err);
        }
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key ? e.key.toLowerCase() : "";
        const code = e.code;
        if (key === "r" || code === "KeyR") {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new Event("app-data-refresh"));
          const pathname = window.location.pathname.toLowerCase();
          if (pathname.startsWith("/master-ae")) {
            window.dispatchEvent(new Event("trigger-pivot-refresh"));
            window.dispatchEvent(new Event("master-ae-request-refresh"));
          } else if (pathname.startsWith("/centers")) {
            window.dispatchEvent(new Event("timesheet-request-refresh"));
          } else if (pathname.startsWith("/audit")) {
            window.dispatchEvent(new Event("audit-request-refresh"));
          }
          window.dispatchEvent(new Event("ui-settings-changed"));
          toast.success("Đã làm mới trang hiện tại (Ctrl + R)");
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("keydown", handleKeyDown, true);

    const loadAndApply = async () => {
      // 1. Try fast load from localStorage (small settings only)
      const fastSaved = localStorage.getItem(UI_SETTINGS_KEY + "_small");
      if (fastSaved) {
        try {
          applyUiSettings(JSON.parse(fastSaved));
        } catch (e) {
          console.error("Failed to apply fastSaved settings from localStorage", e);
        }
      } else {
        // Fallback to legacy full settings in localStorage
        const legacySaved = localStorage.getItem(UI_SETTINGS_KEY);
        if (legacySaved) {
          try {
            applyUiSettings(JSON.parse(legacySaved));
          } catch (e) {
            console.error("Failed to apply legacySaved settings from localStorage", e);
          }
        }
      }

      // 2. Load full settings from localforage (including images)
      try {
        const fullSaved = await loadUiSettings();
        if (fullSaved) {
          applyUiSettings(fullSaved);
        }
      } catch (e) {
        console.error("Failed to load full UI settings", e);
        toast.error("Lỗi khi tải cài đặt");
      }
    };

    loadAndApply();

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AppDataProvider>
        <LoadingWrapper>
          <RouterProvider router={router} />
        </LoadingWrapper>
        <Toaster position="bottom-right" richColors visibleToasts={1} duration={2000} />
      </AppDataProvider>
    </ErrorBoundary>
  );
}
