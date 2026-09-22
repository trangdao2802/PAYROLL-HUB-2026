import {
  getCenterInfoByL07,
  getL07FromFileName,
  mapL07,
} from "./center-utils";

export interface TimesheetCenterConfig {
  id: string;
  l07?: string;
  aeCode?: string;
  bus?: string;
}

function compact(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function shouldSkipTimesheetSource(...sourceParts: unknown[]): boolean {
  const normalized = sourceParts
    .map((part) => {
      const value = String(part || "");
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    })
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return /(?:^|[^A-Z0-9])MKT[\s._-]*HP(?:[^A-Z0-9]|$)/.test(normalized);
}

/**
 * Match a Timesheet file against the user's configured center list first.
 * The generic filename map is only a fallback for files that are not yet in
 * that list, so manually configured L07/BU values stay authoritative.
 */
export function resolveTimesheetCenterFromFileName<T extends TimesheetCenterConfig>(
  fileName: string,
  configuredRows: T[],
): T | undefined {
  const fileBase = fileName.replace(/\.(xlsx?|xls|csv|gsheet|txt)$/i, "");
  const normalizedFileName = compact(fileBase);
  const fileTokens = new Set(
    fileBase
      .split(/[^a-zA-Z0-9À-ỹĐđ]+/)
      .map(compact)
      .filter(Boolean),
  );
  let bestMatch: { row: T; score: number } | undefined;

  configuredRows.forEach((row) => {
    const l07 = compact(row.l07);
    const aeCode = compact(row.aeCode);
    let score = 0;

    if (l07.length >= 5 && normalizedFileName.includes(l07)) {
      score = Math.max(score, 200 + l07.length);
    }
    if (aeCode.length >= 4 && normalizedFileName.includes(aeCode)) {
      score = Math.max(score, 100 + aeCode.length);
    }
    if (aeCode.length >= 3 && fileTokens.has(aeCode)) {
      score = Math.max(score, 180 + aeCode.length);
    }

    if (score > (bestMatch?.score || 0)) bestMatch = { row, score };
  });

  if (bestMatch) return bestMatch.row;

  const detectedL07 = getL07FromFileName(fileName);
  if (!detectedL07) return undefined;
  const normalizedDetectedL07 = compact(mapL07(detectedL07));
  return configuredRows.find(
    (row) => compact(mapL07(row.l07 || "")) === normalizedDetectedL07,
  );
}

/** Detect rows created by the old bug where L07 was copied from fileName. */
export function isFileNameStoredAsL07(
  row: Pick<TimesheetCenterConfig, "l07"> & { fileName?: string },
): boolean {
  if (!row.l07 || !row.fileName) return false;
  const l07 = compact(row.l07);
  const fileBase = compact(row.fileName.replace(/\.(xlsx?|xls|csv|gsheet|txt)$/i, ""));
  return Boolean(
    l07 &&
      fileBase &&
      l07 === fileBase &&
      !getCenterInfoByL07(row.l07),
  );
}
