import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultSettings, migrateFrenchMatchaPalette, type UiSettings } from "../src/app/lib/ui-settings";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Cloudy Pudding palette registers every supplied colour", () => {
  const theme = readSource("src/app/lib/french-matcha-theme.ts");
  const main = readSource("src/main.tsx");

  for (const color of [
    "#F2F3F4",
    "#F7EDF0",
    "#F7F7EC",
    "#DDE4E6",
    "#E4ECF3",
    "#27292C",
    "#AFB0B0",
  ]) {
    assert.ok(theme.includes(color), `missing palette colour ${color}`);
  }

  assert.match(theme, /stripeColor1: FRENCH_MATCHA_PALETTE\.frenchTips/);
  assert.match(theme, /stripeColor2: FRENCH_MATCHA_PALETTE\.cloudyLatte/);
  assert.match(theme, /tableHeaderBg: FRENCH_MATCHA_PALETTE\.matchaCoded/);
  assert.match(theme, /tableFooterBg: FRENCH_MATCHA_PALETTE\.frenchTips/);
  assert.match(theme, /tableColumnHeaderBg: FRENCH_MATCHA_PALETTE\.veryButtery/);
  assert.match(main, /registerFrenchMatchaPaletteTheme\(\)/);
});

test("migrates saved French Tips/Matcha settings to the readable moodboard palette", () => {
  const legacy = {
    ...defaultSettings,
    preset: "french_matcha_palette",
    bg: "#F7F2EC",
    accent: "#601D40",
    text: "#601D40",
    border: "#949E86",
    stripeColor1: "#FFD6EC",
    stripeColor2: "#CAE5F0",
    gridLineColor: "rgba(96, 29, 64, 0.14)",
    tableHeaderBg: "#949E86",
    tableFooterBg: "#FFA873",
    tableColumnHeaderBg: "#FFF5B5",
    tableDataBg: "#F7F2EC",
  } satisfies UiSettings;

  const migrated = migrateFrenchMatchaPalette(legacy);

  assert.equal(migrated.bg, "#F2F3F4");
  assert.equal(migrated.accent, "#27292C");
  assert.equal(migrated.text, "#27292C");
  assert.equal(migrated.border, "#AFB0B0");
  assert.equal(migrated.stripeColor1, "#F7EDF0");
  assert.equal(migrated.stripeColor2, "#E4ECF3");
  assert.equal(migrated.tableHeaderBg, "#DDE4E6");
  assert.equal(migrated.tableFooterBg, "#F7EDF0");
  assert.equal(migrated.tableColumnHeaderBg, "#F7F7EC");
  assert.equal(migrated.tableDataBg, "#F2F3F4");
});
