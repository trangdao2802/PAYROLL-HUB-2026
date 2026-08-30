import localforage from "localforage";
import { useState, useEffect } from "react";
import { defaultCustomRules } from "./custom-rules";

export interface CustomRule {
  id: string;
  selector: string;
  radius?: string;
  bg?: string;
  color?: string;
  border?: string;
  borderColor?: string;
  borderWidth?: string;
  padding?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  margin?: string;
  width?: string;
  height?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  lineHeight?: string;
}

export interface UiSettings {
  bg: string;
  bgImage: string;
  bgImageStyle?:
    | "cover"
    | "contain"
    | "original"
    | "pattern-sm"
    | "pattern-md"
    | "pattern-lg"
    | "brand-stripes-purple"
    | "brand-stripes-green"
    | "brand-stripes-brown";
  bgImageOpacity?: number;
  accent: string;
  text: string;
  border: string;
  fontSize: string;
  tablePadding: string;
  sidebarPos: "left" | "right";
  radius: string;
  tableRadius?: string;
  customRules?: CustomRule[];
  titleAlign: string;
  tableFont?: string;
  autoSave?: boolean;
  showHelp?: boolean;
  stripeColor1?: string;
  stripeColor2?: string;
  gridLineColor?: string;
  showPivotSubtotals?: boolean;
  showGrandTotals?: boolean;
  showMktCols?: boolean;
  showBusiness?: boolean;
  showL07?: boolean;
  showChargeToCenterMkt?: boolean;
  colWidthPreference?: "narrow" | "normal" | "wide";
  defaultAuditYear?: number;
  tableHeaderBg?: string;
  tableFooterBg?: string;
  tableColumnHeaderBg?: string;
  tableDataBg?: string;
  preset?: string;
}

export interface TastePreset {
  id: string;
  name: string;
  bg: string;
  accent: string;
  text: string;
  border: string;
  stripeColor1: string;
  stripeColor2: string;
  gridLineColor: string;
  tableHeaderBg: string;
  tableFooterBg: string;
  tableColumnHeaderBg?: string;
  tableDataBg: string;
  tableFont: string;
  tableRadius: string;
}

export const TASTE_PRESETS: Record<string, TastePreset> = {
  systematic: {
    id: "systematic",
    name: "Lila Rose (Mặc định)",
    bg: "#F7F3F5",
    accent: "#8E4A49",
    text: "#493A3E",
    border: "#D9C9D0",
    stripeColor1: "#FBF8FA",
    stripeColor2: "#F1E7EB",
    gridLineColor: "rgba(142, 74, 73, 0.10)",
    tableHeaderBg: "#E9D9DF",
    tableFooterBg: "#E9D9DF",
    tableColumnHeaderBg: "#D9C9D0",
    tableDataBg: "#FBF8FA",
    tableFont: "var(--font-main)",
    tableRadius: "12px",
  },
  editorial: {
    id: "editorial",
    name: "Editorial Beige (Cổ điển)",
    bg: "#F9F8F6",
    accent: "#5D111A",
    text: "#1C1917",
    border: "#E7E5E4",
    stripeColor1: "#FFFFFF",
    stripeColor2: "#F9F8F6",
    gridLineColor: "rgba(0, 0, 0, 0.035)",
    tableHeaderBg: "#F1EFEB",
    tableFooterBg: "#F1EFEB",
    tableColumnHeaderBg: "#F1EFEB",
    tableDataBg: "#F9F8F6",
    tableFont: "var(--font-main)",
    tableRadius: "12px",
  },
  minimalist: {
    id: "minimalist",
    name: "Tối giản (Minimalist Linear Clean)",
    bg: "#FAFAFA",
    accent: "#09090B",
    text: "#18181B",
    border: "#E4E4E7",
    stripeColor1: "#F4F4F5",
    stripeColor2: "#FAFAFA",
    gridLineColor: "rgba(24, 24, 27, 0.035)",
    tableHeaderBg: "#F4F4F5",
    tableFooterBg: "#F4F4F5",
    tableColumnHeaderBg: "#E4E4E7",
    tableDataBg: "#FAFAFA",
    tableFont: "var(--font-inter)",
    tableRadius: "6px",
  },
  soft: {
    id: "soft",
    name: "Cao cấp (Soft Premium DTC)",
    bg: "#FDFBF7",
    accent: "#7A3B2E",
    text: "#3F2A26",
    border: "#EFE8DC",
    stripeColor1: "#FAF3E8",
    stripeColor2: "#FDFBF7",
    gridLineColor: "rgba(63, 42, 38, 0.035)",
    tableHeaderBg: "#FAF0DD",
    tableFooterBg: "#FAF0DD",
    tableColumnHeaderBg: "#F8EAD3",
    tableDataBg: "#FDFBF7",
    tableFont: "var(--font-nunito)",
    tableRadius: "16px",
  },
  flowbutter: {
    id: "flowbutter",
    name: "Flowbutter Pantone (Vintage)",
    bg: "#F5EFC6",
    accent: "#4D0E12",
    text: "#231815",
    border: "#A5BCD6",
    stripeColor1: "#FFF8D9",
    stripeColor2: "#EDF3F9",
    gridLineColor: "rgba(74, 46, 39, 0.13)",
    tableHeaderBg: "#A5BCD6",
    tableFooterBg: "#E8DDB3",
    tableColumnHeaderBg: "#D4E0EC",
    tableDataBg: "#FFF8D9",
    tableFont: "var(--font-main)",
    tableRadius: "14px",
  }
};

export const defaultSettings: UiSettings = {
  bg: "#F7F3F5",
  bgImage: "",
  bgImageStyle: "cover",
  bgImageOpacity: 100,
  accent: "#8E4A49",
  text: "#493A3E",
  border: "#D9C9D0",
  fontSize: "13px",
  tablePadding: "12px 16px",
  sidebarPos: "left",
  radius: "12px",
  tableRadius: "12px",
  customRules: defaultCustomRules,
  titleAlign: "center",
  tableFont: "var(--font-main)",
  autoSave: true,
  showHelp: true,
  stripeColor1: "#FBF8FA",
  stripeColor2: "#F1E7EB",
  gridLineColor: "rgba(142, 74, 73, 0.10)",
  tableHeaderBg: "#E9D9DF",
  tableFooterBg: "#E9D9DF",
  tableColumnHeaderBg: "#D9C9D0",
  tableDataBg: "#FBF8FA",
  showPivotSubtotals: true,
  showGrandTotals: true,
  showMktCols: true,
  showBusiness: true,
  showL07: true,
  colWidthPreference: "normal",
  defaultAuditYear: 2026,
  preset: "systematic",
};

export const UI_SETTINGS_KEY = "PayrollApp_UiSettings_HushedElegance_v8";

function isValidColor(color: unknown): boolean {
  if (typeof color !== "string") return false;
  const c = color.trim();
  return (
    /^#[0-9A-Fa-f]{3,8}$/.test(c) ||
    c.startsWith("rgba(") ||
    c.startsWith("rgb(") ||
    c === "transparent" ||
    c === "inherit"
  );
}

export function normalizeCssLength(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return `${clean}px`;
  return clean;
}

export function isSafeCustomSelector(selector: unknown): selector is string {
  if (typeof selector !== "string") return false;
  const clean = selector.trim();
  if (!clean || clean.length > 500 || /[{};@]/.test(clean)) return false;
  if (typeof document === "undefined") return true;
  try {
    document.querySelector(clean);
    return true;
  } catch {
    return false;
  }
}

function normalizeBoxShorthand(value?: string): string | undefined {
  const clean = value?.trim();
  if (!clean) return undefined;
  return clean
    .split(/\s+/)
    .map((part) => normalizeCssLength(part) || part)
    .join(" ");
}

function buildCustomRuleCss(
  rule: Partial<CustomRule>,
  includeInspectorOutline = false,
): string {
  if (!isSafeCustomSelector(rule.selector)) return "";
  return `
    ${rule.selector} {
      ${rule.radius ? `border-radius: ${normalizeCssLength(rule.radius)} !important;` : ""}
      ${rule.bg ? `background-color: ${rule.bg} !important;` : ""}
      ${rule.color ? `color: ${rule.color} !important;` : ""}
      ${rule.border ? `border: ${rule.border} !important;` : ""}
      ${rule.borderColor ? `border-color: ${rule.borderColor} !important;` : ""}
      ${rule.borderWidth ? `border-width: ${normalizeCssLength(rule.borderWidth)} !important;` : ""}
      ${rule.padding ? `padding: ${normalizeBoxShorthand(rule.padding)} !important;` : ""}
      ${rule.paddingTop ? `padding-top: ${normalizeCssLength(rule.paddingTop)} !important;` : ""}
      ${rule.paddingBottom ? `padding-bottom: ${normalizeCssLength(rule.paddingBottom)} !important;` : ""}
      ${rule.paddingLeft ? `padding-left: ${normalizeCssLength(rule.paddingLeft)} !important;` : ""}
      ${rule.paddingRight ? `padding-right: ${normalizeCssLength(rule.paddingRight)} !important;` : ""}
      ${rule.margin ? `margin: ${normalizeBoxShorthand(rule.margin)} !important;` : ""}
      ${rule.width ? `width: ${normalizeCssLength(rule.width)} !important;` : ""}
      ${rule.height ? `height: ${normalizeCssLength(rule.height)} !important;` : ""}
      ${rule.fontSize ? `font-size: ${normalizeCssLength(rule.fontSize)} !important;` : ""}
      ${rule.fontFamily ? `font-family: ${rule.fontFamily} !important;` : ""}
      ${rule.fontWeight ? `font-weight: ${rule.fontWeight} !important;` : ""}
      ${rule.fontStyle ? `font-style: ${rule.fontStyle} !important;` : ""}
      ${rule.textDecoration ? `text-decoration-line: ${rule.textDecoration} !important;` : ""}
      ${rule.textAlign ? `text-align: ${rule.textAlign} !important;` : ""}
      ${rule.lineHeight ? `line-height: ${normalizeCssLength(rule.lineHeight)} !important;` : ""}
      ${includeInspectorOutline ? "outline: 3px solid var(--primary, #3b82f6) !important; outline-offset: -3px !important;" : ""}
    }
  `;
}

type RgbColor = { r: number; g: number; b: number };

function parseCssColor(color: string): RgbColor | null {
  const value = color.trim();
  const shortHex = value.match(/^#([0-9a-f]{3,4})$/i);
  if (shortHex) {
    const [r, g, b] = shortHex[1].slice(0, 3).split("").map((part) =>
      parseInt(part + part, 16),
    );
    return { r, g, b };
  }

  const longHex = value.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (longHex) {
    return {
      r: parseInt(longHex[1].slice(0, 2), 16),
      g: parseInt(longHex[1].slice(2, 4), 16),
      b: parseInt(longHex[1].slice(4, 6), 16),
    };
  }

  const rgb = value.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i,
  );
  if (!rgb) return null;
  return {
    r: Math.min(255, Number(rgb[1])),
    g: Math.min(255, Number(rgb[2])),
    b: Math.min(255, Number(rgb[3])),
  };
}

function rgbToHsl({ r, g, b }: RgbColor) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

function rotateHarmonyColor(color: RgbColor, degrees: number) {
  const { h, s, l } = rgbToHsl(color);
  return `hsl(${Math.round((h + degrees) % 360)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

function readableForeground(color: RgbColor) {
  const linear = ({ r, g, b }: RgbColor) =>
    [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
  const [r, g, b] = linear(color);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "#09090b" : "#ffffff";
}

function applyHarmonyVariables(root: HTMLElement, accent: string) {
  const parsed = parseCssColor(accent) || { r: 9, g: 9, b: 11 };
  root.style.setProperty("--primary-foreground", readableForeground(parsed));
  root.style.setProperty("--harmony-complement", rotateHarmonyColor(parsed, 180));
  root.style.setProperty("--harmony-triadic-1", rotateHarmonyColor(parsed, 120));
  root.style.setProperty("--harmony-triadic-2", rotateHarmonyColor(parsed, 240));
  root.style.setProperty("--harmony-tetradic-1", rotateHarmonyColor(parsed, 90));
  root.style.setProperty("--harmony-tetradic-2", rotateHarmonyColor(parsed, 180));
  root.style.setProperty("--harmony-tetradic-3", rotateHarmonyColor(parsed, 270));
  root.style.setProperty(
    "--theme-surface-soft",
    `color-mix(in srgb, ${accent} 5%, var(--card, #ffffff))`,
  );
  root.style.setProperty(
    "--theme-surface-strong",
    `color-mix(in srgb, ${accent} 10%, var(--card, #ffffff))`,
  );
  root.style.setProperty(
    "--theme-surface-complement",
    "color-mix(in srgb, var(--harmony-complement) 7%, var(--card, #ffffff))",
  );
  root.style.setProperty(
    "--theme-surface-triadic",
    "color-mix(in srgb, var(--harmony-triadic-1) 6%, var(--card, #ffffff))",
  );
  root.style.setProperty(
    "--theme-surface-tetradic",
    "color-mix(in srgb, var(--harmony-tetradic-1) 5%, var(--card, #ffffff))",
  );
}

export function applyUiSettings(settings: UiSettings, previewRule?: Partial<CustomRule>) {
  const root = document.documentElement;
  applyHarmonyVariables(root, settings.accent || "#09090b");

  if (settings.preset === "dark_tech") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const accent = settings.accent || "#09090b";
  const background = settings.bg || (settings.preset === "dark_tech" ? "#09090b" : "#ffffff");
  const foreground = settings.text || (settings.preset === "dark_tech" ? "#f4f4f5" : "#18181b");
  const cardMix = settings.preset === "dark_tech" ? 8 : 2;
  const card = `color-mix(in srgb, ${accent} ${cardMix}%, ${background})`;
  root.style.setProperty("--card", card);
  root.style.setProperty("--card-foreground", foreground);
  root.style.setProperty("--popover", card);
  root.style.setProperty("--popover-foreground", foreground);
  root.style.setProperty(
    "--muted",
    `color-mix(in srgb, ${accent} ${settings.preset === "dark_tech" ? 14 : 7}%, ${background})`,
  );
  root.style.setProperty(
    "--muted-foreground",
    `color-mix(in srgb, ${accent} 48%, ${foreground})`,
  );

  if (settings.bg) {
    root.style.setProperty("--background", settings.bg);
    root.style.setProperty("--bg", settings.bg);
    if (typeof document !== "undefined" && document.body) {
      document.body.style.backgroundColor = settings.bg;
    }
  }
  if (settings.text) {
    root.style.setProperty("--foreground", settings.text);
    root.style.setProperty("--ink", settings.text);
  }
  if (settings.border) {
    root.style.setProperty("--border", settings.border);
    root.style.setProperty("--shadow-hard", `4px 4px 0px ${settings.border}`);
    root.style.setProperty("--shadow-hard-sm", `2px 2px 0px ${settings.border}`);
  }
  if (settings.accent) {
    root.style.setProperty("--accent", settings.accent);
    root.style.setProperty("--primary", settings.accent);
    root.style.setProperty("--ring", settings.accent);
    root.style.setProperty("--secondary", "var(--harmony-complement)");
    root.style.setProperty("--secondary-foreground", "var(--primary-foreground)");
    root.style.setProperty("--accent-foreground", "var(--primary-foreground)");
  }

  if (settings.bgImageStyle?.startsWith("brand-stripes-")) {
    root.style.setProperty(
      "--bg-image-opacity",
      ((settings.bgImageOpacity ?? 100) / 100).toString(),
    );
    root.style.setProperty("--bg-image-size", "20px 20px");
    root.style.setProperty("--bg-image-repeat", "repeat");
    root.style.setProperty("--bg-image-attachment", "fixed");

    if (settings.bgImageStyle === "brand-stripes-purple") {
      root.style.setProperty("--bg-image", "var(--pattern-stripes-purple)");
    } else if (settings.bgImageStyle === "brand-stripes-green") {
      root.style.setProperty("--bg-image", "var(--pattern-stripes-green)");
    } else if (settings.bgImageStyle === "brand-stripes-brown") {
      root.style.setProperty("--bg-image", "var(--pattern-stripes-brown)");
    }
  } else if (settings.bgImage) {
    root.style.setProperty("--bg-image", `url(${settings.bgImage})`);
    root.style.setProperty("--bg-image-attachment", "fixed");
    root.style.setProperty(
      "--bg-image-opacity",
      ((settings.bgImageOpacity ?? 100) / 100).toString(),
    );
    if (settings.bgImageStyle === "pattern-sm") {
      root.style.setProperty("--bg-image-size", "50px");
      root.style.setProperty("--bg-image-repeat", "repeat");
      root.style.setProperty("--bg-image-position", "top left");
    } else if (settings.bgImageStyle === "pattern-md") {
      root.style.setProperty("--bg-image-size", "100px");
      root.style.setProperty("--bg-image-repeat", "repeat");
      root.style.setProperty("--bg-image-position", "top left");
    } else if (settings.bgImageStyle === "pattern-lg") {
      root.style.setProperty("--bg-image-size", "200px");
      root.style.setProperty("--bg-image-repeat", "repeat");
      root.style.setProperty("--bg-image-position", "top left");
    } else if (settings.bgImageStyle === "contain") {
      root.style.setProperty("--bg-image-size", "contain");
      root.style.setProperty("--bg-image-repeat", "no-repeat");
      root.style.setProperty("--bg-image-position", "center");
    } else if (settings.bgImageStyle === "original") {
      root.style.setProperty("--bg-image-size", "auto");
      root.style.setProperty("--bg-image-repeat", "no-repeat");
      root.style.setProperty("--bg-image-position", "center");
    } else {
      root.style.setProperty("--bg-image-size", "cover");
      root.style.setProperty("--bg-image-repeat", "no-repeat");
      root.style.setProperty("--bg-image-position", "center");
    }
  } else {
    root.style.removeProperty("--bg-image");
    root.style.removeProperty("--bg-image-size");
    root.style.removeProperty("--bg-image-repeat");
    root.style.removeProperty("--bg-image-position");
    root.style.removeProperty("--bg-image-attachment");
    root.style.setProperty("--bg-image-opacity", "0");
  }

  if (settings.accent) {
    root.style.setProperty("--accent", settings.accent);
    root.style.setProperty("--primary", settings.accent);
    root.style.setProperty("--ring", settings.accent);
  }
  if (settings.text) {
    root.style.setProperty("--foreground", settings.text);
  }
  if (settings.border) {
    root.style.setProperty("--border", settings.border);
    root.style.setProperty("--shadow-hard", `4px 4px 0px ${settings.border}`);
    root.style.setProperty(
      "--shadow-hard-sm",
      `2px 2px 0px ${settings.border}`,
    );
  }
  if (settings.fontSize)
    root.style.setProperty("--font-size", settings.fontSize);
  if (settings.tableFont) {
    root.style.setProperty("--font-table", settings.tableFont);
    root.style.setProperty("--tabular-nums", settings.tableFont);
  }
  if (settings.tablePadding)
    root.style.setProperty("--table-padding", settings.tablePadding);
  if (settings.radius) root.style.setProperty("--radius", settings.radius);
  if (settings.stripeColor1)
    root.style.setProperty("--stripe-color1", settings.stripeColor1);
  if (settings.stripeColor2)
    root.style.setProperty("--stripe-color2", settings.stripeColor2);

  const rawGrid = settings.gridLineColor?.trim();
  const effectiveGrid =
    !rawGrid ||
    rawGrid === "#E7E5E4" ||
    rawGrid === "#e7dbdc" ||
    rawGrid === "#cbd5e1" ||
    rawGrid === "#e2e8f0" ||
    rawGrid === "#ccc" ||
    rawGrid === "#ddd" ||
    rawGrid === "#94a3b8"
      ? "rgba(0, 0, 0, 0.035)"
      : rawGrid;

  root.style.setProperty("--grid-line-color", effectiveGrid);
  root.style.setProperty("--table-grid-color", effectiveGrid);
  root.style.setProperty("--table-border-color", effectiveGrid);

  root.style.setProperty("--table-header-bg", settings.tableHeaderBg || "#E9D9DF");
  root.style.setProperty("--table-footer-bg", settings.tableFooterBg || settings.tableHeaderBg || "#E9D9DF");
  root.style.setProperty("--table-column-header-bg", settings.tableColumnHeaderBg || "#D9C9D0");
  root.style.setProperty("--table-data-bg", settings.tableDataBg || "#FBF8FA");

  if (settings.titleAlign) {
    const [flexAlign, textAlign] = settings.titleAlign.split("|");
    root.style.setProperty("--title-align", flexAlign);
    root.style.setProperty("--text-align", textAlign);
  }

  if (settings.sidebarPos === "right") {
    document.body.classList.add("sidebar-right");
  } else {
    document.body.classList.remove("sidebar-right");
  }

  // Inject custom CSS rules
  let styleEl = document.getElementById("custom-ui-rules");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "custom-ui-rules";
    document.head.appendChild(styleEl);
  }

  let css = "";
  css += `
    .table-container,
    .table-container table,
    .data-table-wrapper,
    .pivot-table-container,
    .master-ae-table-wrapper,
    #table-card,
    header.table-header,
    div.table-wrapper,
    .main-header-wrapper,
    .table-data-container {
      border-radius: ${settings.tableRadius || "0px"} !important;
    }

    /* General Table & Grid Rules */
    table, 
    .data-table-wrapper table, 
    .pivot-table-container table, 
    .pivot-master-table,
    .master-ae-table-wrapper table {
      border-color: ${effectiveGrid} !important;
      font-size: ${settings.fontSize || "13px"} !important;
      font-family: ${settings.tableFont || "var(--font-table, var(--font-main))"} !important;
    }

    table th, 
    table td, 
    .data-table-wrapper th, 
    .data-table-wrapper td, 
    .pivot-table-container th, 
    .pivot-table-container td, 
    .pivot-master-table th,
    .pivot-master-table td,
    .master-ae-table-wrapper th, 
    .master-ae-table-wrapper td,
    .unified-table-frame th,
    .unified-table-frame td,
    .reconcile-table-region th,
    .reconcile-table-region td,
    .analysis-data-table th,
    .analysis-data-table td,
    .bulk-payment-layout table th,
    .bulk-payment-layout table td {
      border-color: ${effectiveGrid} !important;
      border-right: 1px solid ${effectiveGrid} !important;
      border-left: none !important;
      padding: ${settings.tablePadding || "10px 14px"} !important;
      font-size: ${settings.fontSize || "13px"} !important;
      font-family: ${settings.tableFont || "var(--font-table, var(--font-main))"} !important;
    }

    table th :where(span, div, button, input, select, option, label, p),
    table td :where(span, div, button, input, select, option, label, p),
    .pivot-master-table th :where(span, div, button, input, select, option, label, p),
    .pivot-master-table td :where(span, div, button, input, select, option, label, p) {
      font-family: ${settings.tableFont || "var(--font-table, var(--font-main))"} !important;
      font-size: ${settings.fontSize || "13px"} !important;
    }

    table th, 
    .data-table-wrapper th, 
    .pivot-table-container th, 
    .pivot-master-table th,
    .master-ae-table-wrapper th,
    .audit-data-table-wrapper th,
    .unified-table-frame th,
    .analysis-data-table th,
    .reconcile-table-region th {
      text-align: center !important;
    }

    table th > div, 
    .data-table-wrapper th > div, 
    .pivot-table-container th > div, 
    .pivot-master-table th > div,
    .master-ae-table-wrapper th > div,
    .audit-data-table-wrapper th > div,
    .unified-table-frame th > div,
    .analysis-data-table th > div,
    .reconcile-table-region th > div,
    table th span,
    .data-table-wrapper th span,
    .pivot-table-container th span,
    .pivot-master-table th span {
      justify-content: center !important;
      text-align: center !important;
    }

    table tbody td,
    .data-table-wrapper tbody td,
    .pivot-table-container tbody td,
    .pivot-master-table tbody td,
    .master-ae-table-wrapper tbody td,
    .audit-data-table-wrapper tbody td {
      background-color: ${settings.tableDataBg || "#FFFFFF"} !important;
    }

    thead,
    thead th,
    thead tr,
    table thead th, 
    table thead tr, 
    .data-table-wrapper thead th, 
    .data-table-wrapper thead tr,
    .pivot-table-container thead th,
    .pivot-table-container thead tr,
    .pivot-master-table thead th,
    .pivot-master-table thead tr,
    .master-ae-table-wrapper thead th,
    .master-ae-table-wrapper thead tr,
    .audit-data-table-wrapper thead th,
    .audit-data-table-wrapper thead tr,
    .sticky-header-col,
    tfoot,
    table tfoot,
    table tfoot tr,
    table tfoot td,
    table tfoot th,
    .data-table-wrapper tfoot td,
    .data-table-wrapper tfoot th,
    .master-ae-table-wrapper tfoot td,
    .master-ae-table-wrapper tfoot th,
    .pivot-table-container tfoot td,
    .pivot-table-container tfoot th,
    .pivot-master-table tfoot td,
    .pivot-master-table tfoot th,
    .audit-data-table-wrapper tfoot td,
    .audit-data-table-wrapper tfoot th,
    .total-row,
    .total-row td,
    .total-row th,
    tr.total-row td,
    tr.total-row th {
      background-color: ${settings.tableColumnHeaderBg || "#D9C9D0"} !important;
      color: ${settings.accent || "#7B4F85"} !important;
      border-left: none !important;
      border-right: none !important;
    }

    .unified-table-frame-header,
    .table-header,
    .trial-balance-header,
    .table-footer-pagination,
    .unified-table-frame-footer,
    .pivot-master-frame .unified-table-frame-header,
    .pivot-master-frame .unified-table-frame-footer,
    .page-master-ae .unified-table-frame-header,
    .page-master-ae .unified-table-frame-footer,
    .page-master-ae .table-footer-pagination,
    .page-master-config .unified-table-frame-header,
    .page-master-config .table-footer-pagination,
    .page-master-config .unified-table-frame-footer,
    .bulk-payment-data-panel .unified-table-frame-header,
    .bulk-payment-data-panel .table-footer-pagination,
    .analysis-table-frame > .unified-table-frame-header,
    .analysis-data-table > .table-footer-pagination {
      background: ${settings.tableHeaderBg || "#E9D9DF"} !important;
      background-color: ${settings.tableHeaderBg || "#E9D9DF"} !important;
    }

    .table-footer-pagination,
    .table-footer-pagination *,
    .unified-table-frame-footer,
    .unified-table-frame-footer * {
      font-family: ${settings.tableFont || "var(--font-table, var(--font-main))"} !important;
      font-size: ${settings.fontSize || "13px"} !important;
    }

    button:not(.rounded-full):not(.rounded-none):not(.search-btn-exception),
    [role="button"]:not(.rounded-full):not(.rounded-none):not(.search-btn-exception) {
      border-radius: 20px !important;
    }

    span.rounded-full,
    div.rounded-full,
    input.rounded-full,
    button.rounded-full,
    .search-btn-exception,
    [class*="rounded-full"] {
      border-radius: 9999px !important;
    }

    .flex.bg-slate-200\\/30,
    div.flex.bg-slate-200\\/30,
    div[class*="bg-slate-200/30"] {
      background-color: transparent !important;
      border-width: 0px !important;
      box-shadow: none !important;
    }

    body, #root, .bg-background {
      background: radial-gradient(circle at 18% 14%, ${settings.stripeColor1 || "#FBF8FA"} 0%, transparent 58%),
                  radial-gradient(circle at 82% 86%, ${settings.stripeColor2 || "#F1E7EB"} 0%, transparent 62%),
                  linear-gradient(135deg, ${settings.stripeColor1 || "#FBF8FA"} 0%, ${settings.stripeColor2 || "#F1E7EB"} 100%) !important;
      background-attachment: fixed !important;
    }

    /* CARD BORDERS & THEMED BACKGROUNDS FOR ALL PAGES */
    .vintage-card,
    .stat-card,
    .stat-group,
    .payroll-theme-card,
    .bu-summary-card,
    .bu-amount-card,
    .master-info-card,
    .master-theme-panel,
    .unified-table-frame,
    .holding-card,
    .summary-card,
    .analytics-card,
    .metric-card,
    .filter-card,
    .side-panel-card,
    div[class*="theme-card"],
    div[class*="info-card"],
    div[class*="summary-card"],
    div[class*="amount-card"],
    div[class*="stat-card"] {
      border: 1px solid ${settings.border || "var(--border, #E7E5E4)"} !important;
      border-color: ${settings.border || "var(--border, #E7E5E4)"} !important;
      background-color: var(--card, ${card}) !important;
      color: var(--card-foreground, var(--foreground)) !important;
    }

    .payroll-theme-card {
      background-color: color-mix(in srgb, ${accent} 6%, var(--card, ${card})) !important;
      border: 1px solid color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
      border-color: color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
    }

    .bu-summary-card {
      background: linear-gradient(145deg, var(--card, ${card}) 0%, color-mix(in srgb, ${accent} 5%, var(--card, ${card})) 100%) !important;
      border: 1px solid color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
      border-color: color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
    }

    .bu-amount-card {
      background: linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--card, ${card})) 0%, color-mix(in srgb, ${accent} 4%, var(--card, ${card})) 100%) !important;
      border: 1px solid color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
      border-color: color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
    }

    .master-info-card {
      background: linear-gradient(145deg, color-mix(in srgb, ${accent} 6%, var(--card, ${card})), color-mix(in srgb, ${accent} 2%, var(--card, ${card}))) !important;
      border: 1px solid color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
      border-color: color-mix(in srgb, ${accent} 22%, ${settings.border || "var(--border, #E7E5E4)"}) !important;
    }
  `;

  css += `
    .pivot-table-container,
    .pivot-table-container table,
    .pivot-table-container th,
    .pivot-table-container td,
    .pivot-table-container input,
    .pivot-master-table,
    .pivot-master-table th,
    .pivot-master-table td,
    .pivot-master-table input,
    .master-ae-table-wrapper,
    .master-ae-table-wrapper table,
    .master-ae-table-wrapper th,
    .master-ae-table-wrapper td,
    .master-ae-table-wrapper input {
      font-family: var(--font-table, var(--font-main)) !important;
      font-size: ${settings.fontSize || "12px"} !important;
    }

    .pivot-table-container thead,
    .pivot-table-container thead tr,
    .pivot-table-container thead th,
    .pivot-master-table thead,
    .pivot-master-table thead tr,
    .pivot-master-table thead th {
      background-color: ${settings.tableColumnHeaderBg || "#F4ECD8"} !important;
    }

    .pivot-table-container tfoot,
    .pivot-table-container tfoot tr,
    .pivot-table-container tfoot td,
    .pivot-table-container .total-row,
    .pivot-table-container .total-row td,
    .pivot-master-table tfoot,
    .pivot-master-table tfoot tr,
    .pivot-master-table tfoot td {
      background-color: ${settings.tableColumnHeaderBg || "#F4ECD8"} !important;
    }

    .pivot-table-container thead input:not(:focus),
    .pivot-master-table thead input:not(:focus) {
      background-color: transparent !important;
    }
  `;

  if (settings.customRules && Array.isArray(settings.customRules)) {
    settings.customRules.forEach((rule) => {
      css += buildCustomRuleCss(rule);
    });
  }

  styleEl.innerHTML = css;

  // Keep live preview separate so an in-progress rule never becomes part of
  // the persisted stylesheet before the user applies it.
  let previewStyleEl = document.getElementById("custom-ui-preview");
  if (!previewStyleEl) {
    previewStyleEl = document.createElement("style");
    previewStyleEl.id = "custom-ui-preview";
    document.head.appendChild(previewStyleEl);
  }
  previewStyleEl.innerHTML = previewRule
    ? buildCustomRuleCss(previewRule, true)
    : "";
}

export async function loadUiSettings(): Promise<UiSettings> {
  const sanitize = (s: unknown): UiSettings => {
    const sObj = (s && typeof s === "object" ? s : {}) as Partial<UiSettings>;
    const result = { ...defaultSettings, ...sObj };
    // Move previous default accents to Lila Rose while preserving deliberate
    // custom colors and every other preset.
    if (
      result.preset === "systematic" &&
      typeof result.accent === "string" &&
      ["#8E659A", "#413644"].includes(result.accent.toUpperCase())
    ) {
      result.accent = defaultSettings.accent;
    }
    // Migrate only untouched values from the previous default palette. Custom
    // user colors and non-default presets remain unchanged.
    if (result.preset === "systematic") {
      const migrateDefaultColor = (
        key: keyof Pick<
          UiSettings,
          | "bg"
          | "text"
          | "border"
          | "stripeColor1"
          | "stripeColor2"
          | "gridLineColor"
          | "tableHeaderBg"
          | "tableFooterBg"
          | "tableColumnHeaderBg"
          | "tableDataBg"
        >,
        previousValue: string,
      ) => {
        const currentValue = result[key];
        if (
          typeof currentValue === "string" &&
          currentValue.toUpperCase() === previousValue.toUpperCase()
        ) {
          result[key] = defaultSettings[key] || "";
        }
      };

      migrateDefaultColor("bg", "#EAE7EE");
      migrateDefaultColor("bg", "#F6F7F7");
      migrateDefaultColor("text", "#4D3653");
      migrateDefaultColor("text", "#3A3129");
      migrateDefaultColor("border", "#D3CCD8");
      migrateDefaultColor("border", "#CFCDC2");
      migrateDefaultColor("stripeColor1", "#FFFFFF");
      migrateDefaultColor("stripeColor1", "#F6F7F7");
      migrateDefaultColor("stripeColor2", "#EFECE8");
      migrateDefaultColor("stripeColor2", "#DFD9DF");
      migrateDefaultColor("gridLineColor", "rgba(77, 54, 83, 0.06)");
      migrateDefaultColor("gridLineColor", "rgba(58, 49, 41, 0.08)");
      migrateDefaultColor("gridLineColor", "#CFCDC2");
      migrateDefaultColor("tableHeaderBg", "#CFC4D6");
      migrateDefaultColor("tableHeaderBg", "#DFD9DF");
      migrateDefaultColor("tableFooterBg", "#CFC4D6");
      migrateDefaultColor("tableFooterBg", "#DFD9DF");
      migrateDefaultColor("tableColumnHeaderBg", "#E3DBE8");
      migrateDefaultColor("tableColumnHeaderBg", "#C4CBD5");
      migrateDefaultColor("tableDataBg", "#FCFBFD");
      migrateDefaultColor("tableDataBg", "#F6F7F7");
    }
    // Force valid hex for specific fields
    if (!isValidColor(result.accent)) result.accent = defaultSettings.accent;
    if (!isValidColor(result.text)) result.text = defaultSettings.text;
    if (!isValidColor(result.border)) result.border = defaultSettings.border;
    if (!isValidColor(result.bg)) result.bg = defaultSettings.bg;
    if (result.stripeColor1 && !isValidColor(result.stripeColor1))
      result.stripeColor1 = defaultSettings.stripeColor1;
    if (result.stripeColor2 && !isValidColor(result.stripeColor2))
      result.stripeColor2 = defaultSettings.stripeColor2;
    if (result.gridLineColor && !isValidColor(result.gridLineColor))
      result.gridLineColor = defaultSettings.gridLineColor;
    if (result.tableHeaderBg && !isValidColor(result.tableHeaderBg))
      result.tableHeaderBg = defaultSettings.tableHeaderBg;
    if (result.tableFooterBg && !isValidColor(result.tableFooterBg))
      result.tableFooterBg = defaultSettings.tableFooterBg;
    if (result.tableColumnHeaderBg && !isValidColor(result.tableColumnHeaderBg))
      result.tableColumnHeaderBg = defaultSettings.tableColumnHeaderBg;
    if (result.tableDataBg && !isValidColor(result.tableDataBg))
      result.tableDataBg = defaultSettings.tableDataBg;
    if (!/^\d+(?:\.\d+)?(?:px|rem|em)$/.test(result.fontSize || ""))
      result.fontSize = defaultSettings.fontSize;

    // Validate bgImage URL (must start with http, https or data:)
    if (
      result.bgImage &&
      !result.bgImage.startsWith("http") &&
      !result.bgImage.startsWith("data:")
    ) {
      result.bgImage = "";
    }

    if (!result.customRules || !Array.isArray(result.customRules)) {
      result.customRules = [...defaultCustomRules];
    } else {
      // A custom rule is user-owned state. Never silently discard a valid
      // selector during hydration: doing so made a DIV jump back to its
      // original style after the next DIV was edited or after a reload.
      // Rules now return to the default state only through an explicit delete.
      result.customRules = result.customRules.filter(
        (rule) => rule && isSafeCustomSelector(rule.selector),
      );

      defaultCustomRules.forEach((defRule) => {
        const idx = result.customRules!.findIndex(
          (r) => r.selector === defRule.selector || r.id === defRule.id
        );
        if (idx === -1) {
          result.customRules!.push(defRule);
        }
      });
    }

    return result;
  };

  try {
    const saved = await localforage.getItem<UiSettings>(UI_SETTINGS_KEY);
    if (saved) return sanitize(saved);

    const legacySaved = localStorage.getItem(UI_SETTINGS_KEY);
    if (legacySaved) {
      try {
        const parsed = JSON.parse(legacySaved);
        return sanitize(parsed);
      } catch {
        // Ignore parsing errors
      }
    }
  } catch {
    // Ignore storage errors
  }
  return defaultSettings;
}

export function useUiSettings() {
  const [settings, setSettings] = useState<UiSettings>(defaultSettings);

  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        const s = await loadUiSettings();
        if (active) {
          setSettings(s);
        }
      } catch (err) {
        console.error("Failed to load reactive UI settings:", err);
      }
    };

    fetchSettings();

    const handleUpdate = () => {
      fetchSettings();
    };

    window.addEventListener("ui-settings-changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      active = false;
      window.removeEventListener("ui-settings-changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return settings;
}
