interface TableInitialMarkProps {
  label: string;
  className?: string;
}

/** A compact, theme-aware table initial used in headers and panel toggles. */
export function TableInitialMark({
  label,
  className = "",
}: TableInitialMarkProps) {
  const initial = Array.from(label.trim())[0]?.toLocaleUpperCase("vi-VN") || "";

  return (
    <span
      aria-hidden="true"
      className={`app-table-initial-mark ${className}`.trim()}
    >
      {initial}
    </span>
  );
}
