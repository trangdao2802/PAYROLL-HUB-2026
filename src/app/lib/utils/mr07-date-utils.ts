import { parseAnyDate } from "./data-utils";

/**
 * MR.07 / Class Hour Session Reports exports Session Date as MM/DD/YYYY.
 * Keep this parser separate from parseAnyDate because the shared parser
 * intentionally reads slash dates as DD/MM/YYYY for the other payroll files.
 */
export function parseMr07SessionDate(
  value: unknown,
  preferredYear?: number,
): Date | null {
  if (value instanceof Date || typeof value === "number") {
    return parseAnyDate(value, preferredYear);
  }

  const raw = String(value ?? "").trim();
  const usDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (usDate) {
    const month = Number(usDate[1]);
    const day = Number(usDate[2]);
    let year = Number(usDate[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
    return null;
  }

  return parseAnyDate(value, preferredYear);
}
