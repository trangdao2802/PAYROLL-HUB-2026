import { useState, useMemo, useEffect } from "react";
import {
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Table2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  TASTE_PRESETS,
  TastePreset,
  UiSettings,
  applyUiSettings,
  saveUiSettings,
  loadUiSettings,
  computeContrastTextColor,
  calculateRelativeLuminance,
  calculateContrastRatio,
} from "../lib/ui-settings";
import { toast } from "sonner";

export interface ThemePreviewCardProps {
  /** Initial preset ID to preview (defaults to current applied theme) */
  initialPresetId?: string;
  /** Custom settings preview override (e.g., when editing in settings modal) */
  customSettingsPreview?: Partial<UiSettings>;
  /** Callback when user clicks Apply */
  onApply?: (presetId: string, presetData: TastePreset) => void;
  /** Callback to close container if inside popover/modal */
  onClose?: () => void;
  /** Extra container classes */
  className?: string;
  /** Compact mode (hides preset list, only shows card preview) */
  compact?: boolean;
}

const PRESET_ENTRIES = Object.values(TASTE_PRESETS);

export function ThemePreviewCard({
  initialPresetId,
  customSettingsPreview,
  onApply,
  onClose,
  className = "",
  compact = false,
}: ThemePreviewCardProps) {
  // Current active theme from document / localStorage
  const [activeThemeId, setActiveThemeId] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("app-theme") ||
        "lila-rose"
      );
    }
    return "lila-rose";
  });

  // Selected preset being previewed (null means follow initialPresetId / activeThemeId)
  const [userSelectedPresetId, setUserSelectedPresetId] = useState<string | null>(null);

  const previewId = userSelectedPresetId ?? (initialPresetId || activeThemeId || "lila-rose");

  // Synchronize active theme from storage/DOM mutation events
  useEffect(() => {
    const handleStorageChange = () => {
      const current =
        document.documentElement.getAttribute("data-theme") ||
        localStorage.getItem("app-theme") ||
        "lila-rose";
      setActiveThemeId(current);
    };

    window.addEventListener("storage", handleStorageChange);
    const observer = new MutationObserver(handleStorageChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      observer.disconnect();
    };
  }, []);

  const selectedPreset: TastePreset = useMemo(() => {
    return (
      TASTE_PRESETS[previewId] ||
      TASTE_PRESETS[activeThemeId] ||
      TASTE_PRESETS["lila-rose"] ||
      PRESET_ENTRIES[0]
    );
  }, [previewId, activeThemeId]);

  // Resolve preview colors: custom override takes precedence if supplied
  const previewColors = useMemo(() => {
    const tableHeaderBg =
      customSettingsPreview?.tableHeaderBg || selectedPreset.tableHeaderBg;
    // Footer strictly mirrors header background
    const tableFooterBg =
      customSettingsPreview?.tableFooterBg || tableHeaderBg;
    const tableColumnHeaderBg =
      customSettingsPreview?.tableColumnHeaderBg ||
      selectedPreset.tableColumnHeaderBg;
    const tableColumnHeaderTextColor =
      customSettingsPreview?.tableColumnHeaderTextColor ||
      selectedPreset.tableColumnHeaderTextColor ||
      "#2D2126";
    const tableDataBg =
      customSettingsPreview?.tableDataBg || selectedPreset.tableDataBg;
    const stripeColor2 =
      customSettingsPreview?.stripeColor2 || selectedPreset.stripeColor2;
    const gridLineColor =
      customSettingsPreview?.gridLineColor || selectedPreset.gridLineColor;
    const accent = customSettingsPreview?.accent || selectedPreset.accent;
    const text = customSettingsPreview?.text || selectedPreset.text;

    const headerContrast = computeContrastTextColor(tableHeaderBg, text);
    const footerContrast = computeContrastTextColor(tableFooterBg, text);
    const headerLuminance = calculateRelativeLuminance(tableHeaderBg);
    const contrastRatio = calculateContrastRatio(
      tableHeaderBg,
      headerContrast.primary
    );

    return {
      tableHeaderBg,
      tableFooterBg,
      tableColumnHeaderBg,
      tableColumnHeaderTextColor,
      tableDataBg,
      stripeColor2,
      gridLineColor,
      accent,
      text,
      headerContrast,
      footerContrast,
      headerLuminance,
      contrastRatio,
    };
  }, [selectedPreset, customSettingsPreview]);

  const isDifferentFromActive =
    previewId !== activeThemeId || Boolean(customSettingsPreview);

  const handleApply = async () => {
    try {
      const presetData = selectedPreset;
      // 1. Update data-theme on HTML root
      document.documentElement.setAttribute("data-theme", presetData.id);
      localStorage.setItem("app-theme", presetData.id);
      setActiveThemeId(presetData.id);

      // 2. Load existing settings and merge with preset
      const current = await loadUiSettings();
      const updated: UiSettings = {
        ...current,
        preset: presetData.id,
        bg: presetData.bg,
        accent: presetData.accent,
        text: presetData.text,
        border: presetData.border,
        stripeColor1: presetData.stripeColor1,
        stripeColor2: presetData.stripeColor2,
        gridLineColor: presetData.gridLineColor,
        tableHeaderBg: presetData.tableHeaderBg,
        tableSubHeaderBg: presetData.tableSubHeaderBg,
        tableFooterBg: presetData.tableFooterBg,
        tableColumnHeaderBg: presetData.tableColumnHeaderBg,
        tableColumnHeaderTextColor: presetData.tableColumnHeaderTextColor,
        tableDataBg: presetData.tableDataBg,
        tableFont: presetData.tableFont,
        tableRadius: presetData.tableRadius,
        ...(customSettingsPreview || {}),
      };

      await saveUiSettings(updated);
      applyUiSettings(updated);

      toast.success(`Đã áp dụng chủ đề: ${presetData.name}`);
      setUserSelectedPresetId(null);
      if (onApply) {
        onApply(presetData.id, presetData);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("Failed to apply theme preset:", err);
      toast.error("Không thể lưu chủ đề, vui lòng thử lại.");
    }
  };

  const handleReset = () => {
    setUserSelectedPresetId(null);
    toast.info("Đã khôi phục xem trước về chủ đề đang dùng.");
  };

  return (
    <div
      id="theme-preview-card"
      className={`flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 text-card-foreground shadow-md transition-all ${className}`}
    >
      {/* Header bar of preview card */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 text-accent shadow-xs"
            style={{ backgroundColor: previewColors.tableHeaderBg }}
          >
            <Table2
              className="h-4 w-4"
              style={{ color: previewColors.headerContrast.primary }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-tight text-foreground">
                Xem Trước Chủ Đề Bảng
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: previewColors.tableHeaderBg,
                  color: previewColors.headerContrast.primary,
                  border: `1px solid ${previewColors.gridLineColor}`,
                }}
              >
                {selectedPreset.id}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
              {selectedPreset.name}
            </p>
          </div>
        </div>

        {isDifferentFromActive && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <Sparkles className="h-2.5 w-2.5" />
            Đang xem thử
          </span>
        )}
      </div>

      {/* Preset selection chips (if not compact) */}
      {!compact && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Palette className="h-3 w-3" /> Chọn chủ đề để xem trước:
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
              {PRESET_ENTRIES.length} chủ đề
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-0.5 py-0.5">
            {PRESET_ENTRIES.map((preset) => {
              const isSelected = preset.id === previewId;
              const isActive = preset.id === activeThemeId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setUserSelectedPresetId(preset.id)}
                  className={`group relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "border-primary bg-primary/10 font-bold text-primary shadow-xs ring-1 ring-primary/30"
                      : "border-border/60 bg-background/80 hover:bg-muted/70 text-foreground"
                  }`}
                  title={preset.name}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/80 shadow-2xs"
                    style={{ backgroundColor: preset.tableHeaderBg }}
                  />
                  <span className="truncate flex-1 font-medium">
                    {preset.name.split("·")[0].trim()}
                  </span>
                  {isActive && (
                    <Check
                      className="h-3 w-3 shrink-0 text-emerald-600"
                      title="Chủ đề đang áp dụng"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mini Interactive Table Preview Frame */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border shadow-xs">
        {/* 1. Mini Table Header */}
        <div
          className="flex min-h-[38px] items-center justify-between border-b px-3 py-1.5 transition-colors"
          style={{
            backgroundColor: previewColors.tableHeaderBg,
            borderColor: previewColors.gridLineColor,
          }}
        >
          <div className="flex flex-col">
            <span
              className="text-xs font-bold tracking-tight leading-tight"
              style={{ color: previewColors.headerContrast.primary }}
            >
              BẢNG TỔNG HỢP CÔNG & LƯƠNG
            </span>
            <span
              className="text-[10px] leading-tight"
              style={{ color: previewColors.headerContrast.muted }}
            >
              Kỳ tính lương 03/2026 • 24 Cơ sở
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums border"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.4)",
                borderColor: previewColors.gridLineColor,
                color: previewColors.headerContrast.primary,
              }}
            >
              Đồng bộ 100%
            </span>
          </div>
        </div>

        {/* 2. Mini Column Header */}
        <div
          className="grid grid-cols-12 gap-1 border-b px-3 py-1 text-[10px] font-bold transition-colors"
          style={{
            backgroundColor: previewColors.tableColumnHeaderBg,
            color: previewColors.tableColumnHeaderTextColor,
            borderColor: previewColors.gridLineColor,
          }}
        >
          <span className="col-span-3 truncate">Mã NV</span>
          <span className="col-span-4 truncate">Họ và Tên</span>
          <span className="col-span-2 text-right tabular-nums">Giờ</span>
          <span className="col-span-3 text-right tabular-nums">Thực lĩnh</span>
        </div>

        {/* 3. Mini Rows */}
        <div
          className="flex flex-col text-[10px]"
          style={{ backgroundColor: previewColors.tableDataBg }}
        >
          <div
            className="grid grid-cols-12 gap-1 border-b px-3 py-1 tabular-nums text-foreground/90 font-mono transition-colors"
            style={{ borderColor: previewColors.gridLineColor }}
          >
            <span className="col-span-3 font-semibold text-primary">NV0129</span>
            <span className="col-span-4 truncate font-sans text-foreground">
              Nguyễn Văn An
            </span>
            <span className="col-span-2 text-right">184.0h</span>
            <span className="col-span-3 text-right font-semibold">18,500,000₫</span>
          </div>

          <div
            className="grid grid-cols-12 gap-1 border-b px-3 py-1 tabular-nums text-foreground/90 font-mono transition-colors"
            style={{
              backgroundColor: previewColors.stripeColor2,
              borderColor: previewColors.gridLineColor,
            }}
          >
            <span className="col-span-3 font-semibold text-primary">NV0142</span>
            <span className="col-span-4 truncate font-sans text-foreground">
              Trần Thị Mai
            </span>
            <span className="col-span-2 text-right">176.5h</span>
            <span className="col-span-3 text-right font-semibold">16,200,000₫</span>
          </div>
        </div>

        {/* 4. Mini Table Footer / Pagination */}
        <div
          className="flex min-h-[34px] items-center justify-between border-t px-3 py-1 transition-colors text-[10px]"
          style={{
            backgroundColor: previewColors.tableFooterBg,
            borderColor: previewColors.gridLineColor,
          }}
        >
          <div className="flex items-center gap-1.5 tabular-nums">
            <span
              className="font-medium"
              style={{ color: previewColors.footerContrast.primary }}
            >
              Trang 1 / 10
            </span>
            <span style={{ color: previewColors.footerContrast.muted }}>•</span>
            <span style={{ color: previewColors.footerContrast.muted }}>
              250 nhân sự
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="flex h-5 w-5 items-center justify-center rounded border opacity-50 cursor-not-allowed"
              style={{
                borderColor: previewColors.gridLineColor,
                color: previewColors.footerContrast.primary,
              }}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded border hover:bg-black/5 active:scale-95 transition-transform"
              style={{
                borderColor: previewColors.gridLineColor,
                color: previewColors.footerContrast.primary,
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Contrast and WCAG Spec Indicator */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground border border-border/40">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            WCAG AA ({previewColors.contrastRatio.toFixed(1)}:1)
          </span>
          <span className="text-border">•</span>
          <span className="tabular-nums">
            Độ sáng: {(previewColors.headerLuminance * 100).toFixed(0)}% (
            {previewColors.headerContrast.isLightBg ? "Nền sáng" : "Nền tối"})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-border"
            style={{ backgroundColor: previewColors.tableHeaderBg }}
            title={`Màu tiêu đề: ${previewColors.tableHeaderBg}`}
          />
          <span className="text-[10px] text-muted-foreground font-mono">
            {previewColors.tableHeaderBg}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {isDifferentFromActive ? (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">
            Chủ đề đang hoạt động
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-semibold hover:bg-muted active:scale-[0.98] transition-all cursor-pointer text-foreground"
            >
              Đóng
            </button>
          )}

          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            Áp dụng toàn bộ cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThemePreviewCard;
