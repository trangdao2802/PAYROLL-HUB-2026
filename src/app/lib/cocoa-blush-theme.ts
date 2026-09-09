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
  // Cocoa is the readable UI accent. The powder blue remains part of the
  // palette through the page surface so the pastel reference is preserved
  // without making labels, controls, and table headings disappear.
  bg: COCOA_BLUSH_PALETTE.canvas,
  accent: COCOA_BLUSH_PALETTE.cocoa,
  text: COCOA_BLUSH_PALETTE.ink,
  border: COCOA_BLUSH_PALETTE.taupe,
  stripeColor1: COCOA_BLUSH_PALETTE.blush,
  stripeColor2: COCOA_BLUSH_PALETTE.powderBlue,
  gridLineColor: "rgba(90, 69, 66, 0.16)",
  tableHeaderBg: COCOA_BLUSH_PALETTE.dustyPink,
  tableFooterBg: COCOA_BLUSH_PALETTE.blush,
  tableColumnHeaderBg: COCOA_BLUSH_PALETTE.warmBeige,
  tableDataBg: COCOA_BLUSH_PALETTE.canvas,
  tableFont: "var(--font-main)",
  tableRadius: "14px",
};

export function registerCocoaBlushPaletteTheme() {
  TASTE_PRESETS[COCOA_BLUSH_PRESET_ID] = COCOA_BLUSH_PRESET;
}
