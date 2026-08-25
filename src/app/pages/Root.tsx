/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Navbar } from "../components/layouts/Navbar";
import { UiSettingsModal } from "../components/UiSettingsModal";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";

// ── Root không dùng framer-motion để tránh layout thrashing trên shell layout ──
export function Root() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
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
    <div className="flex absolute inset-0 overflow-hidden font-sans text-foreground bg-background justify-center">
      {/* Mobile Sidebar Overlay — CSS transition thay vì framer-motion */}
      <div
        onClick={() => setIsMobileMenuOpen(false)}
        className={`fixed inset-0 bg-black/40 backdrop-blur-md z-[60] lg:hidden transition-opacity duration-300
          ${isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden min-w-0 relative bg-background w-full"
      >
        <div className="bg-transparent relative z-40">
          <Navbar
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
