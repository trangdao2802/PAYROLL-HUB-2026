const DAY_MS = 24 * 60 * 60 * 1000;

export type TimesheetSyncDateStatus =
  | "none"
  | "unknown"
  | "fresh"
  | "recent"
  | "warning"
  | "outdated";

export interface TimesheetSyncDateInfo {
  status: TimesheetSyncDateStatus;
  label: string;
  isOutdated: boolean;
  diffDays: number | null;
}

const normalizeYear = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const year = Number(value);
  return year < 100 ? year + 2000 : year;
};

function createValidatedLocalDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date | null {
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hour, minute, second);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day &&
    parsed.getHours() === hour &&
    parsed.getMinutes() === minute &&
    parsed.getSeconds() === second
    ? parsed
    : null;
}

export function parseTimesheetSyncDate(
  value?: string,
  referenceDate = new Date(),
): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "---") return null;

  // vi-VN can render a timestamp as "16:23 02/09/2026". Parse that shape
  // explicitly so the browser cannot reinterpret 02/09 as US month/day.
  const timeFirst = raw.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/,
  );
  if (timeFirst) {
    return createValidatedLocalDate(
      normalizeYear(timeFirst[6], referenceDate.getFullYear()),
      Number(timeFirst[5]),
      Number(timeFirst[4]),
      Number(timeFirst[1]),
      Number(timeFirst[2]),
      Number(timeFirst[3] || 0),
    );
  }

  const dateFirst = raw.match(
    /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (dateFirst) {
    return createValidatedLocalDate(
      normalizeYear(dateFirst[3], referenceDate.getFullYear()),
      Number(dateFirst[2]),
      Number(dateFirst[1]),
      Number(dateFirst[4] || 0),
      Number(dateFirst[5] || 0),
      Number(dateFirst[6] || 0),
    );
  }

  // Stored ISO timestamps are unambiguous and remain supported for forward
  // compatibility. Do not pass other slash-based strings to Date.parse.
  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function formatTimesheetSyncDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(value.getHours())}:${pad(value.getMinutes())} ${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
}

export function getTimesheetSyncDateInfo(
  value?: string,
  now = new Date(),
): TimesheetSyncDateInfo {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "---") {
    return {
      status: "none",
      label: "Chưa đồng bộ",
      isOutdated: false,
      diffDays: null,
    };
  }

  const parsed = parseTimesheetSyncDate(raw, now);
  if (!parsed) {
    return {
      status: "unknown",
      label: raw,
      isOutdated: false,
      diffDays: null,
    };
  }

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const sourceDay = Date.UTC(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
  const diffDays = Math.round((today - sourceDay) / DAY_MS);

  if (diffDays <= 0) {
    return {
      status: "fresh",
      label: "Mới (Hôm nay)",
      isOutdated: false,
      diffDays: 0,
    };
  }
  if (diffDays === 1) {
    return {
      status: "recent",
      label: "Hôm qua (1 ngày)",
      isOutdated: false,
      diffDays,
    };
  }
  if (diffDays <= 3) {
    return {
      status: "warning",
      label: `${diffDays} ngày trước (Cũ)`,
      isOutdated: true,
      diffDays,
    };
  }
  return {
    status: "outdated",
    label: `Cũ (${diffDays} ngày trước)`,
    isOutdated: true,
    diffDays,
  };
}
