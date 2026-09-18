import { TASTE_PRESETS, type TastePreset } from "./ui-settings";

export const FRENCH_MATCHA_PALETTE = {
  canvas: "#F2F3F4",
  frenchTips: "#F7EDF0",
  veryButtery: "#F7F7EC",
  matchaCoded: "#DDE4E6",
  cloudyLatte: "#E4ECF3",
  deepPlum: "#27292C",
  matchaOrange: "#AFB0B0",
} as const;

export const FRENCH_MATCHA_PRESET_ID = "french_matcha_palette";

export const FRENCH_MATCHA_PRESET: TastePreset = {
  id: FRENCH_MATCHA_PRESET_ID,
  name: "Cloudy Pudding · Pastel Mist (Palette ảnh)",
  // The new preset follows the supplied cloudy pudding moodboard: soft grey,
  // blush, powder blue and cream surfaces with charcoal text for readability.
  bg: FRENCH_MATCHA_PALETTE.canvas,
  accent: FRENCH_MATCHA_PALETTE.deepPlum,
  text: FRENCH_MATCHA_PALETTE.deepPlum,
  border: FRENCH_MATCHA_PALETTE.matchaOrange,
  stripeColor1: FRENCH_MATCHA_PALETTE.frenchTips,
  stripeColor2: FRENCH_MATCHA_PALETTE.cloudyLatte,
  gridLineColor: "rgba(39, 41, 44, 0.16)",
  tableHeaderBg: FRENCH_MATCHA_PALETTE.matchaCoded,
  tableFooterBg: FRENCH_MATCHA_PALETTE.frenchTips,
  tableColumnHeaderBg: FRENCH_MATCHA_PALETTE.veryButtery,
  tableDataBg: FRENCH_MATCHA_PALETTE.canvas,
  tableFont: "var(--font-main)",
  tableRadius: "14px",
};

export function registerFrenchMatchaPaletteTheme() {
  TASTE_PRESETS[FRENCH_MATCHA_PRESET_ID] = FRENCH_MATCHA_PRESET;
}
