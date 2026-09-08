import { TASTE_PRESETS, type TastePreset } from "./ui-settings";

export const COCOA_BLUSH_PALETTE = {
  canvas: "#F8F4EE",
  cocoa: "#5A4542",
  ink: "#433837",
  blush: "#E6CED6",
  dustyPink: "#D2B6BD",
  powderBlue: "#DCDDE8",
  warmBeige: "#EBCEAA",
  taupe: "#A38E96",
} as const;

export const COCOA_BLUSH_PRESET_ID = "cocoa_blush_palette";

export const COCOA_BLUSH_PRESET: TastePreset = {
  id: COCOA_BLUSH_PRESET_ID,
  name: "Cocoa Blush · Nâu, xanh, hồng & be (Palette ảnh)",
  // The powder blue is sampled from the supplied accent swatch. Cocoa remains
  // the header surface so the pale accent stays readable in dense tables.
  bg: COCOA_BLUSH_PALETTE.canvas,
  accent: COCOA_BLUSH_PALETTE.powderBlue,
  text: COCOA_BLUSH_PALETTE.ink,
  border: COCOA_BLUSH_PALETTE.taupe,
  stripeColor1: COCOA_BLUSH_PALETTE.blush,
  stripeColor2: COCOA_BLUSH_PALETTE.warmBeige,
  gridLineColor: "rgba(90, 69, 66, 0.12)",
  tableHeaderBg: COCOA_BLUSH_PALETTE.cocoa,
  tableFooterBg: COCOA_BLUSH_PALETTE.dustyPink,
  tableColumnHeaderBg: COCOA_BLUSH_PALETTE.cocoa,
  tableDataBg: COCOA_BLUSH_PALETTE.canvas,
  tableFont: "var(--font-main)",
  tableRadius: "14px",
};

export function registerCocoaBlushPaletteTheme() {
  TASTE_PRESETS[COCOA_BLUSH_PRESET_ID] = COCOA_BLUSH_PRESET;
}
