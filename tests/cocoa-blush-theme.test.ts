import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultSettings, migrateCocoaBlushContrast, type UiSettings } from "../src/app/lib/ui-settings";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Cocoa Blush palette registers the supplied brown, blue, pink and beige theme", () => {
  const theme = readSource("src/app/lib/cocoa-blush-theme.ts");
  const main = readSource("src/main.tsx");

  for (const color of [
    "#F8F4EE",
    "#5A4542",
    "#433837",
    "#E6CED6",
    "#D2B6BD",
    "#DCDDE8",
    "#EBCEAA",
    "#A38E96",
  ]) {
    assert.ok(theme.includes(color), `missing palette colour ${color}`);
  }

  assert.match(theme, /accent: COCOA_BLUSH_PALETTE\.cocoa/);
  assert.match(theme, /stripeColor1: COCOA_BLUSH_PALETTE\.blush/);
  assert.match(theme, /stripeColor2: COCOA_BLUSH_PALETTE\.powderBlue/);
  assert.match(theme, /tableHeaderBg: COCOA_BLUSH_PALETTE\.dustyPink/);
  assert.match(theme, /tableColumnHeaderBg: COCOA_BLUSH_PALETTE\.warmBeige/);
  assert.match(main, /registerCocoaBlushPaletteTheme\(\)/);
});

test("migrates the saved low-contrast Cocoa Blush preset", () => {
  const legacy = {
    ...defaultSettings,
    preset: "cocoa_blush_palette",
    bg: "#F8F4EE",
    accent: "#DCDDE8",
    text: "#433837",
    border: "#A38E96",
    stripeColor1: "#E6CED6",
    stripeColor2: "#EBCEAA",
    gridLineColor: "rgba(90, 69, 66, 0.12)",
    tableHeaderBg: "#5A4542",
    tableFooterBg: "#D2B6BD",
    tableColumnHeaderBg: "#5A4542",
    tableDataBg: "#F8F4EE",
  } satisfies UiSettings;

  const migrated = migrateCocoaBlushContrast(legacy);

  assert.equal(migrated.accent, "#5A4542");
  assert.equal(migrated.stripeColor2, "#DCDDE8");
  assert.equal(migrated.tableHeaderBg, "#D2B6BD");
  assert.equal(migrated.tableFooterBg, "#E6CED6");
  assert.equal(migrated.tableColumnHeaderBg, "#EBCEAA");
  assert.equal(migrated.gridLineColor, "rgba(90, 69, 66, 0.16)");
});
