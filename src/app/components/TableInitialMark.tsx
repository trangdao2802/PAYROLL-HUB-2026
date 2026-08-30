import type { CSSProperties } from "react";

interface TableInitialMarkProps {
  label: string;
  className?: string;
}

const REFERENCE_GLYPHS = {
  A: ["a", 77], B: ["b", 78], C: ["c", 78], D: ["d", 78], E: ["e", 75], F: ["f", 76],
  G: ["g", 81], H: ["h", 84], I: ["i", 45], J: ["j", 71], K: ["k", 80], L: ["l", 68], M: ["m", 93],
  N: ["n", 80], O: ["o", 81], P: ["p", 81], Q: ["q", 79], R: ["r", 76], S: ["s", 75], T: ["t", 70],
  U: ["u", 77], V: ["v", 79], W: ["w", 90], X: ["x", 83], Y: ["y", 77], Z: ["z", 76],
} as const;

type ReferenceGlyph = keyof typeof REFERENCE_GLYPHS;
const REFERENCE_CELL_HEIGHT = 106;
// 31px at the 16px root size: three pixels larger than the previous mark.
const DISPLAY_GLYPH_HEIGHT_REM = 1.9375;

function getTitleCharacters(label: string): string[] {
  return Array.from(label.trim());
}

/** Returns the title copy that follows the branded first character. */
function getTableTitleRemainder(label: string): string {
  return getTitleCharacters(label).slice(1).join("");
}

/** Keeps the complete title for assistive technology while replacing its first visible character. */
export function TableTitleRemainder({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="app-table-title-remainder">
        {getTableTitleRemainder(label)}
      </span>
    </>
  );
}

/** An exact, theme-aware crop of the supplied A–Z reference alphabet. */
export function TableInitialMark({
  label,
  className = "",
}: TableInitialMarkProps) {
  const initial = getTitleCharacters(label)[0]?.toLocaleUpperCase("vi-VN") || "";
  const normalizedInitial = initial
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
  const glyphKey = (normalizedInitial in REFERENCE_GLYPHS ? normalizedInitial : "A") as ReferenceGlyph;
  const [assetName, sourceWidth] = REFERENCE_GLYPHS[glyphKey];
  const glyphStyle = {
    "--table-initial-mask": `url("/fonts/rare-alphabet/${assetName}.png")`,
    "--table-initial-glyph-width": `${((sourceWidth / REFERENCE_CELL_HEIGHT) * DISPLAY_GLYPH_HEIGHT_REM).toFixed(3)}rem`,
  } as CSSProperties;
  const classes = `app-table-initial-mark app-table-initial-mark--reference ${className}`.trim();

  return (
    <span aria-hidden="true" className={classes} data-glyph={glyphKey}>
      <span className="app-table-initial-mark__glyph" style={glyphStyle}>
        {initial}
      </span>
    </span>
  );
}
