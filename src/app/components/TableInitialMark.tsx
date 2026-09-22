import type { CSSProperties } from "react";

interface TableInitialMarkProps {
  label: string;
  className?: string;
}

const REFERENCE_GLYPHS = {
  A: ["a", 77, 0], B: ["b", 78, 0], C: ["c", 78, 0], D: ["d", 78, 0], E: ["e", 75, 0], F: ["f", 76, 0],
  G: ["g", 81, 0], H: ["h", 84, 0], I: ["i", 45, 0], J: ["j", 71, 0], K: ["k", 80, 0], L: ["l", 68, 0], M: ["m", 93, 0],
  N: ["n", 80, 0], O: ["o", 81, 0], P: ["p", 90, 0], Q: ["q", 79, 0], R: ["r", 76, 0], S: ["s", 75, 0], T: ["t", 70, 0],
  U: ["u", 77, 0], V: ["v", 79, 0], W: ["w", 90, 0], X: ["x", 83, 0], Y: ["y", 77, 0], Z: ["z", 76, 0],
} as const;

type ReferenceGlyph = keyof typeof REFERENCE_GLYPHS;
const REFERENCE_CELL_HEIGHT = 106;
// 31px at the 16px root size: three pixels larger than the previous mark.
const DISPLAY_GLYPH_HEIGHT_EM = 1.35;

function getTitleCharacters(label: string): string[] {
  return Array.from(label.trim());
}

/** Returns the title copy that follows the branded first character. */
function getTableTitleRemainder(label: string): string {
  return getTitleCharacters(label).slice(1).join("").toLocaleLowerCase("vi-VN");
}

/** Keeps the complete title for assistive technology while replacing its first visible character. */
export function TableTitleRemainder({
  label,
  className = "",
  style,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className={`app-table-title-remainder ${className}`.trim()}
        style={style}
      >
        {getTableTitleRemainder(label)}
      </span>
    </>
  );
}

interface TableInitialMarkProps {
  label: string;
  className?: string;
  style?: CSSProperties;
  glyphStyle?: CSSProperties;
}

/** An exact, theme-aware crop of the supplied A–Z reference alphabet. */
export function TableInitialMark({
  label,
  className = "",
  style,
  glyphStyle: customGlyphStyle,
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
    "--table-initial-glyph-width": `${((sourceWidth / REFERENCE_CELL_HEIGHT) * DISPLAY_GLYPH_HEIGHT_EM).toFixed(3)}em`,
    ...customGlyphStyle,
  } as CSSProperties;
  const classes = `app-table-initial-mark app-table-initial-mark--reference ${className}`.trim();

  return (
    <span aria-hidden="true" className={classes} data-glyph={glyphKey} style={style}>
      <span className="app-table-initial-mark__glyph" style={glyphStyle} />
    </span>
  );
}
