import { useState, useEffect } from "react";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ThemePreviewCard } from "./ThemePreviewCard";

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("app-theme") ||
        "lila-rose"
      );
    }
    return "lila-rose";
  });

  useEffect(() => {
    const checkTheme = () => {
      const theme =
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("app-theme") ||
        "lila-rose";
      setCurrentTheme(theme);
    };

    window.addEventListener("storage", checkTheme);
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      window.removeEventListener("storage", checkTheme);
      observer.disconnect();
    };
  }, []);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/80 bg-card hover:bg-muted/80 text-foreground text-xs font-semibold shadow-2xs transition-all outline-none active:scale-[0.98] cursor-pointer"
          title={`Xem trước chủ đề bảng (${currentTheme})`}
        >
          <Palette className="w-3.5 h-3.5 text-accent" />
          <span className="hidden lg:inline text-[11px]">Chủ đề</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[420px] max-w-[95vw] p-0 border border-border shadow-2xl rounded-xl z-[9999]"
      >
        <ThemePreviewCard
          initialPresetId={currentTheme}
          onClose={() => setIsOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export default ThemeSwitcher;
