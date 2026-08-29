import { useId } from "react";

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

function CatLetterArtwork({ initial }: { initial: string }) {
  const maskId = `cat-letter-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className="app-table-initial-mark__artwork"
      viewBox="0 0 34 38"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <mask
          id={maskId}
          x="0"
          y="0"
          width="34"
          height="38"
          maskUnits="userSpaceOnUse"
        >
          <rect width="34" height="38" fill="#000" />
          <text
            className="app-table-initial-mark__letter-shape"
            x="14.5"
            y="33"
            fill="#fff"
            textAnchor="middle"
          >
            {initial}
          </text>

          {/* Cat head fused into the letter, mirroring the supplied P mark. */}
          <path
            d="M14.4 10.8 16.8 4.4l5 3.4 4.6-3.4 2.5 6.4c2 2.2 2 7.7-.1 10.1-2.5 3-10.1 3.2-13.1.4-2.5-2.3-2.8-8.2-1.3-10.5Z"
            fill="#fff"
          />
          <path
            d="M16.8 14.2c.6-3 2.1-4.6 3.9-2.6 1.9 2 4.3 2.1 6.1-.2l.7 4.2"
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.15"
          />
          <circle cx="19.3" cy="17.6" r="1.35" fill="#000" />
          <circle cx="25.5" cy="17.6" r="1.35" fill="#000" />
        </mask>
      </defs>

      <rect
        width="34"
        height="38"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

/** A compact, theme-aware first character used in table titles and toggles. */
export function TableInitialMark({
  label,
  className = "",
}: TableInitialMarkProps) {
  const initial = getTitleCharacters(label)[0]?.toLocaleUpperCase("vi-VN") || "";
  const classes = `app-table-initial-mark ${
    initial === "P"
      ? "app-table-initial-mark--logo-p"
      : "app-table-initial-mark--cat-letter"
  } ${className}`.trim();

  return (
    <span aria-hidden="true" className={classes}>
      {initial === "P" ? null : <CatLetterArtwork initial={initial} />}
    </span>
  );
}
