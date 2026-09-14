import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useEffect, useState } from "react";
import { TASTE_PRESETS, loadUiSettings, saveUiSettings } from "../lib/ui-settings";

const themes = [
  { id: "lila-rose", label: "Lila Rose", color: "#A26377" },
  { id: "breeze-blue", label: "Breeze Blue", color: "#6F8E9F" },
  { id: "butter-yellow", label: "Butter Yellow", color: "#D4A338" },
  { id: "coral-clay", label: "Coral Clay", color: "#CC7C6B" },
  { id: "espresso-blush", label: "Espresso Blush", color: "#3D2A2A" },
];

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("app-theme") || "lila-rose";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("app-theme", themeId);
    if (TASTE_PRESETS[themeId]) {
      const presetData = TASTE_PRESETS[themeId];
      loadUiSettings().then((current) => {
        saveUiSettings({
          ...current,
          preset: themeId,
          bg: presetData.bg,
          accent: presetData.accent,
          text: presetData.text,
          border: presetData.border,
          stripeColor1: presetData.stripeColor1,
          stripeColor2: presetData.stripeColor2,
          gridLineColor: presetData.gridLineColor,
          tableHeaderBg: presetData.tableHeaderBg,
          tableFooterBg: presetData.tableFooterBg,
          tableColumnHeaderBg: presetData.tableColumnHeaderBg,
          tableColumnHeaderTextColor: presetData.tableColumnHeaderTextColor,
          tableDataBg: presetData.tableDataBg,
          tableFont: presetData.tableFont,
          tableRadius: presetData.tableRadius,
        });
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Chủ đề giao diện"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={`cursor-pointer flex items-center justify-between text-xs font-medium px-3 py-2 ${
              currentTheme === theme.id ? "bg-accent/10 text-accent" : ""
            }`}
          >
            <span>{theme.label}</span>
            <span
              className="w-3 h-3 rounded-full border border-border/50"
              style={{ backgroundColor: theme.color }}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
