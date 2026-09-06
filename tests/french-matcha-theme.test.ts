import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("French Tips / Matcha palette registers every supplied colour", () => {
  const theme = readSource("src/app/lib/french-matcha-theme.ts");
  const main = readSource("src/main.tsx");

  for (const color of [
    "#F7F2EC",
    "#FFD6EC",
    "#FFF5B5",
    "#949E86",
    "#CAE5F0",
    "#601D40",
    "#FFA873",
  ]) {
    assert.ok(theme.includes(color), `missing palette colour ${color}`);
  }

  assert.match(theme, /stripeColor1: FRENCH_MATCHA_PALETTE\.frenchTips/);
  assert.match(theme, /stripeColor2: FRENCH_MATCHA_PALETTE\.cloudyLatte/);
  assert.match(theme, /tableHeaderBg: FRENCH_MATCHA_PALETTE\.matchaCoded/);
  assert.match(theme, /tableFooterBg: FRENCH_MATCHA_PALETTE\.matchaOrange/);
  assert.match(theme, /tableColumnHeaderBg: FRENCH_MATCHA_PALETTE\.veryButtery/);
  assert.match(main, /registerFrenchMatchaPaletteTheme\(\)/);
});
