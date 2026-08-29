interface TableInitialMarkProps {
  label: string;
  className?: string;
}

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
      <span aria-hidden="true">{getTableTitleRemainder(label)}</span>
    </>
  );
}

/** A compact, theme-aware Modak first character used in table titles and toggles. */
export function TableInitialMark({
  label,
  className = "",
}: TableInitialMarkProps) {
  const initial = getTitleCharacters(label)[0]?.toLocaleUpperCase("vi-VN") || "";
  const classes = `app-table-initial-mark app-table-initial-mark--modak ${className}`.trim();

  return (
    <span aria-hidden="true" className={classes}>
      <span className="app-table-initial-mark__glyph">{initial}</span>
    </span>
  );
}
