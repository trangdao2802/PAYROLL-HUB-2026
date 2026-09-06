import { TASTE_PRESETS, type TastePreset } from "./ui-settings";

export const FRENCH_MATCHA_PALETTE = {
  canvas: "#F7F2EC",
  frenchTips: "#FFD6EC",
  veryButtery: "#FFF5B5",
  matchaCoded: "#949E86",
  cloudyLatte: "#CAE5F0",
  deepPlum: "#601D40",
  matchaOrange: "#FFA873",
} as const;

export const FRENCH_MATCHA_PRESET_ID = "french_matcha_palette";

export const FRENCH_MATCHA_PRESET: TastePreset = {
  id: FRENCH_MATCHA_PRESET_ID,
  name: "French Tips · Matcha Coded (Palette ảnh)",
  // Every colour sampled from the supplied palette is mapped to an active UI role.
  bg: FRENCH_MATCHA_PALETTE.canvas,
  accent: FRENCH_MATCHA_PALETTE.deepPlum,
  text: FRENCH_MATCHA_PALETTE.deepPlum,
  border: FRENCH_MATCHA_PALETTE.matchaCoded,
  stripeColor1: FRENCH_MATCHA_PALETTE.frenchTips,
  stripeColor2: FRENCH_MATCHA_PALETTE.cloudyLatte,
  gridLineColor: "rgba(96, 29, 64, 0.14)",
  tableHeaderBg: FRENCH_MATCHA_PALETTE.matchaCoded,
  tableFooterBg: FRENCH_MATCHA_PALETTE.matchaOrange,
  tableColumnHeaderBg: FRENCH_MATCHA_PALETTE.veryButtery,
  tableDataBg: FRENCH_MATCHA_PALETTE.canvas,
  tableFont: "var(--font-main)",
  tableRadius: "14px",
};

export function registerFrenchMatchaPaletteTheme() {
  TASTE_PRESETS[FRENCH_MATCHA_PRESET_ID] = FRENCH_MATCHA_PRESET;
}
