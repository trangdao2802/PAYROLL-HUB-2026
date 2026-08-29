export interface AuditTeacherEntry {
  name?: unknown;
  hours?: unknown;
  allowedTAs?: unknown;
  numStudents?: unknown;
  [key: string]: unknown;
}

export interface AuditTaEntry {
  id?: unknown;
  name?: unknown;
  hours?: unknown;
  allowedTAs?: unknown;
  numStudents?: unknown;
  [key: string]: unknown;
}

export interface AuditDailyEntries {
  teacher?: AuditTeacherEntry[];
  ta?: AuditTaEntry[];
}

export interface AuditDaySummary {
  date: string;
  month: string;
  teacherName: string;
  teacherHours: number;
  numStudents: number;
  allowedTAs: number;
  actualTAs: number;
  totalTaHours: number;
  overBy: number;
  isOverAllowed: boolean;
  uniqueTaIds: string[];
}

export interface AuditMonthSummary {
  month: string;
  teacherHours: number;
  classDays: number;
  overAllowedDays: number;
  withinAllowedDays: number;
  maxAllowedTAs: number;
  maxActualTAs: number;
  totalTaHours: number;
  days: AuditDaySummary[];
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizedIdentity(value: unknown): string {
  return cleanText(value)
    .toLocaleUpperCase("vi-VN")
    .replace(/\s+/g, " ");
}

export function getAuditMonthKey(dateValue: unknown): string {
  const value = cleanText(dateValue);
  const dayFirst = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dayFirst) {
    const month = Number(dayFirst[2]);
    if (month >= 1 && month <= 12) {
      return `${String(month).padStart(2, "0")}.${dayFirst[3]}`;
    }
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) {
      return `${String(month).padStart(2, "0")}.${iso[1]}`;
    }
  }

  return "";
}

function getTaIdentity(entry: AuditTaEntry, index: number): string {
  const id = normalizedIdentity(entry.id);
  if (id && id !== "-") return `ID:${id}`;

  const name = normalizedIdentity(entry.name);
  if (name && name !== "-") return `NAME:${name}`;

  return nonNegativeNumber(entry.hours) > 0 ? `UNIDENTIFIED:${index}` : "";
}

function selectSessionTeacher(entries: AuditTeacherEntry[]): AuditTeacherEntry | null {
  let selected: AuditTeacherEntry | null = null;
  let selectedHours = -1;

  entries.forEach((entry) => {
    const hours = nonNegativeNumber(entry.hours);
    const hasTeacher = normalizedIdentity(entry.name) !== "";
    if (!hasTeacher && hours <= 0) return;
    if (hours > selectedHours) {
      selected = entry;
      selectedHours = hours;
    }
  });

  return selected;
}

/**
 * One class on one date is one teaching session. Teacher hours therefore come
 * from one teacher entry only, while actual TAs are distinct people rather than
 * roster row count. TA hours never determine whether a session exceeded its
 * Allowed TAs limit.
 */
export function summarizeAuditDay(
  date: string,
  entries: AuditDailyEntries,
  fallbackAllowedTAs = 0,
): AuditDaySummary {
  const teachers = Array.isArray(entries.teacher) ? entries.teacher : [];
  const tas = Array.isArray(entries.ta) ? entries.ta : [];
  const selectedTeacher = selectSessionTeacher(teachers);

  const uniqueTaIds = Array.from(
    new Set(tas.map(getTaIdentity).filter(Boolean)),
  );
  const allowedTAs = Math.max(
    nonNegativeNumber(fallbackAllowedTAs),
    ...teachers.map((entry) => nonNegativeNumber(entry.allowedTAs)),
    ...tas.map((entry) => nonNegativeNumber(entry.allowedTAs)),
  );
  const numStudents = Math.max(
    0,
    ...teachers.map((entry) => nonNegativeNumber(entry.numStudents)),
    ...tas.map((entry) => nonNegativeNumber(entry.numStudents)),
  );
  const actualTAs = uniqueTaIds.length;
  const overBy = Math.max(0, actualTAs - allowedTAs);

  return {
    date,
    month: getAuditMonthKey(date),
    teacherName: cleanText(selectedTeacher?.name),
    teacherHours: nonNegativeNumber(selectedTeacher?.hours),
    numStudents,
    allowedTAs,
    actualTAs,
    totalTaHours: tas.reduce(
      (total, entry) => total + nonNegativeNumber(entry.hours),
      0,
    ),
    overBy,
    isOverAllowed: overBy > 0,
    uniqueTaIds,
  };
}

function monthSortValue(month: string): number {
  const match = month.match(/^(\d{2})\.(\d{4})$/);
  return match ? Number(match[2]) * 12 + Number(match[1]) - 1 : 0;
}

export function aggregateAuditDaysByMonth(
  days: AuditDaySummary[],
): AuditMonthSummary[] {
  const byMonth = new Map<string, AuditDaySummary[]>();

  days.forEach((day) => {
    if (!day.month) return;
    const current = byMonth.get(day.month) || [];
    current.push(day);
    byMonth.set(day.month, current);
  });

  return Array.from(byMonth.entries())
    .map(([month, monthDays]) => {
      const sortedDays = [...monthDays].sort((a, b) => a.date.localeCompare(b.date));
      const overAllowedDays = sortedDays.filter((day) => day.isOverAllowed).length;
      return {
        month,
        teacherHours: sortedDays.reduce((total, day) => total + day.teacherHours, 0),
        classDays: sortedDays.length,
        overAllowedDays,
        withinAllowedDays: sortedDays.length - overAllowedDays,
        maxAllowedTAs: Math.max(0, ...sortedDays.map((day) => day.allowedTAs)),
        maxActualTAs: Math.max(0, ...sortedDays.map((day) => day.actualTAs)),
        totalTaHours: sortedDays.reduce((total, day) => total + day.totalTaHours, 0),
        days: sortedDays,
      };
    })
    .sort((a, b) => monthSortValue(a.month) - monthSortValue(b.month));
}
