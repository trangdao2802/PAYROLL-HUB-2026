import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("all branded table initials keep one optical baseline", () => {
  const styles = readSource("src/title-alignment.css");
  const main = readSource("src/main.tsx");

  assert.match(styles, /\.app-table-initial-mark\s*\{[\s\S]*?top:\s*-2px/);
  assert.match(
    styles,
    /:where\(button, a\):hover \.app-table-initial-mark\s*\{[\s\S]*?transform:\s*scale\(1\.025\) !important/,
  );
  assert.match(
    styles,
    /\.table-initial-toggle:hover \.app-table-initial-mark\s*\{[\s\S]*?transform:\s*scale\(1\.025\) !important/,
  );
  assert.match(
    main,
    /import "\.\/table-border-zero\.css";\nimport "\.\/title-alignment\.css";/,
  );
});

test("navbar page subtitle is sentence case", () => {
  const styles = readSource("src/title-alignment.css");

  assert.match(
    styles,
    /\.navbar-current-label\s*\{[\s\S]*?text-transform:\s*lowercase !important/,
  );
  assert.match(
    styles,
    /\.navbar-current-label::first-letter\s*\{[\s\S]*?text-transform:\s*uppercase !important/,
  );
});
