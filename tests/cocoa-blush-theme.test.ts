import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
    "#DADAE5",
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
