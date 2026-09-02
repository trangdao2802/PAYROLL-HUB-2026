import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Navbar } from "../components/layouts/Navbar";
import { UiSettingsModal } from "../components/UiSettingsModal";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";

// ── Root không dùng framer-motion để tránh layout thrashing trên shell layout ──
export function Root() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // AppDataProvider lives above RouterProvider, so publish route changes for
    // route-scoped data work without forcing a document reload.
    window.dispatchEvent(new Event("app-route-changed"));
  }, [location.pathname]);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener("open-ui-settings", handleOpenSettings);
    return () => window.removeEventListener("open-ui-settings", handleOpenSettings);
  }, []);

  return (
    <div className="app-viewport-shell flex overflow-hidden font-sans text-foreground bg-background justify-center">
      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden min-w-0 relative bg-background w-full"
      >
        <div className="bg-transparent relative z-40">
          <Navbar
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        <main className="flex-1 flex flex-col min-h-0 relative">
          <ErrorBoundary key={location.pathname}>
            <div className="flex-1 flex flex-col min-h-0">
              <Outlet />
            </div>
          </ErrorBoundary>

          {/* Quick Shortcuts Exclamation Floating Dock - Removed as requested */}
        </main>
        
        <UiSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
