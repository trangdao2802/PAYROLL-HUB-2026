/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

/**
 * Zod Schema for Excel Roster / Timesheet Row Data
 * Validates Charge to Center, Duration, Type, and related fields to prevent runtime errors.
 */
export const ExcelRowSchema = z.object({
  /**
   * Charge to Center / Center Code
   */
  chargeToCenter: z
    .string({
      invalid_type_error: "Charge to Center phải là chuỗi văn bản",
    })
    .trim()
    .min(1, "Charge to Center không được để trống"),

  /**
   * Duration in hours or Excel fractional day value
   */
  duration: z.preprocess(
    (val) => parseDurationToHours(val),
    z.number({
      invalid_type_error: "Duration phải là số",
    }).min(0, "Duration không được âm")
  ),

  /**
   * Category / Type classification (e.g., L01, L02, Active, Main, etc.)
   */
  type: z
    .union([z.string(), z.number()])
    .transform((val) => String(val ?? "N/A").trim())
    .pipe(z.string().min(1, "Type không được để trống")),

  /**
   * Bank or Unit Code (e.g. MKT LOCAL NORTH)
   */
  bank: z.string().optional().default(""),

  /**
   * Employee Name
   */
  name: z.string().optional().default(""),

  /**
   * Month / Period
   */
  month: z.union([z.string(), z.number()]).optional().default(""),
});

export type ValidatedExcelRow = z.infer<typeof ExcelRowSchema>;

const MAX_ROSTER_DURATION_HOURS = 24 * 7;
const EXCEL_LOCAL_EPOCH_MS = new Date(1899, 11, 30, 0, 0, 0, 0).getTime();
const EXCEL_ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/i;

function normalizeDurationHours(hours: number): number {
  return Number.isFinite(hours) &&
    hours > 0 &&
    hours <= MAX_ROSTER_DURATION_HOURS
    ? hours
    : 0;
}

function parseExcelEpochDuration(value: Date | string): number | null {
  if (
    typeof value === "string" &&
    !EXCEL_ISO_DATE_PATTERN.test(value.trim())
  ) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;

  // SheetJS creates Date values with local wall-clock fields. Comparing with
  // the local Excel epoch also survives historical timezone offsets after the
  // worker value has been converted to/from an ISO string.
  const hours = (date.getTime() - EXCEL_LOCAL_EPOCH_MS) / 3_600_000;
  return normalizeDurationHours(hours);
}

/**
 * Utility to strip Vietnamese diacritics / accents
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Normalizes an Excel header string:
 * 1. Trims whitespace, tabs, newlines & non-breaking spaces (\u00A0)
 * 2. Strips Vietnamese accents
 * 3. Lowercases string
 * 4. Replaces underscores, hyphens, dots, slashes, brackets with single spaces
 * 5. Collapses multiple spaces to a single space
 */
export function normalizeHeaderString(header: string): string {
  if (!header || typeof header !== "string") return "";
  
  let cleaned = header
    .replace(/[\u00A0\r\n\t]/g, " ")
    .trim();

  cleaned = removeVietnameseAccents(cleaned);
  
  // Replace symbols/punctuation with spaces
  // eslint-disable-next-line no-useless-escape
  cleaned = cleaned.replace(/[_.\-\/\(\)\[\]:]/g, " ");
  
  // Lowercase & collapse spaces
  return cleaned.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Compact header normalization (removes all spaces & punctuation)
 * e.g., "Charge to Center" -> "chargetocenter"
 */
export function compactHeaderString(header: string): string {
  return normalizeHeaderString(header).replace(/\s+/g, "");
}

/**
 * Expected Core Headers Configuration (with expanded normalized aliases)
 */
export const CORE_EXCEL_HEADERS = {
  CHARGE_TO_CENTER: [
    "charge to center",
    "charge center",
    "chargetocenter",
    "center charge",
    "charge to center mkt",
    "l07 = charge to center mkt",
    "l07 charge to center mkt",
    "center",
    "l07",
    "center code",
    "ma trung tam",
    "trung tam",
    "tinh vao trung tam",
  ],
  DURATION: [
    "duration",
    "duration hours",
    "hours",
    "hour",
    "time",
    "thoi gian",
    "gio",
    "so gio",
    "thoi gian gio",
  ],
  TYPE: [
    "type",
    "loai",
    "category",
    "classification",
    "nhom",
    "loai hinh",
    "loai hinh cong viec",
  ],
} as const;

/**
 * Normalizes an entire raw Excel row object keys to standardized, cleaned key names
 */
export function normalizeRowHeaders(rawRow: Record<string, any>): Record<string, any> {
  if (!rawRow || typeof rawRow !== "object") return {};
  
  const normalizedRow: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const normKey = normalizeHeaderString(key);
    normalizedRow[normKey] = value;
    // Also store original key if not conflicting to preserve raw lookup
    if (!normalizedRow[key]) {
      normalizedRow[key] = value;
    }
  }
  return normalizedRow;
}

/**
 * Standardizes key names from raw Excel row object with advanced normalization
 */
export function extractCanonicalExcelFields(rawRow: Record<string, any>) {
  if (!rawRow || typeof rawRow !== "object") {
    return { chargeToCenter: "", duration: 0, type: "N/A", bank: "", name: "", month: "" };
  }

  const normalizedRowKeys = Object.keys(rawRow).map((k) => ({
    original: k,
    normalized: normalizeHeaderString(k),
    compact: compactHeaderString(k),
  }));

  const findValueByAliases = (aliases: readonly string[]): any => {
    // 1. Try exact normalized match
    for (const item of normalizedRowKeys) {
      for (const alias of aliases) {
        const normAlias = normalizeHeaderString(alias);
        if (item.normalized === normAlias) {
          return rawRow[item.original];
        }
      }
    }

    // 2. Fallback to compact match (ignores all spaces)
    for (const item of normalizedRowKeys) {
      for (const alias of aliases) {
        const compactAlias = compactHeaderString(alias);
        if (item.compact === compactAlias || item.compact.includes(compactAlias)) {
          return rawRow[item.original];
        }
      }
    }

    return undefined;
  };

  const chargeToCenterRaw =
    findValueByAliases(CORE_EXCEL_HEADERS.CHARGE_TO_CENTER) ??
    rawRow["chargeToCenter"] ??
    rawRow["Center"] ??
    "";

  const durationRaw =
    findValueByAliases(CORE_EXCEL_HEADERS.DURATION) ??
    rawRow["duration"] ??
    0;

  const typeRaw =
    findValueByAliases(CORE_EXCEL_HEADERS.TYPE) ??
    rawRow["type"] ??
    "N/A";

  const bankRaw =
    findValueByAliases(["bank", "ngan hang", "don vi", "unit"]) ??
    rawRow["Bank"] ??
    rawRow["BANK"] ??
    "";

  const nameRaw =
    findValueByAliases(["name", "ten", "ho va ten", "nhan vien", "employee"]) ??
    rawRow["Name"] ??
    rawRow["NAME"] ??
    "";

  const monthRaw =
    findValueByAliases(["month", "thang", "period", "ky"]) ??
    rawRow["Month"] ??
    rawRow["month"] ??
    "";

  return {
    chargeToCenter: String(chargeToCenterRaw ?? "").trim(),
    duration: durationRaw,
    type: String(typeRaw ?? "N/A").trim(),
    bank: String(bankRaw ?? "").trim(),
    name: String(nameRaw ?? "").trim(),
    month: String(monthRaw ?? "").trim(),
  };
}

/**
 * Validates array of Excel header strings with normalization
 */
export function validateExcelHeaders(
  headers: string[],
  requiredHeaderAliases: Record<string, readonly string[]> = CORE_EXCEL_HEADERS
): {
  isValid: boolean;
  missingFields: string[];
  matchedHeaders: Record<string, string>;
  errors: string[];
} {
  const normalizedInputHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeHeaderString(h),
    compact: compactHeaderString(h),
  }));

  const matchedHeaders: Record<string, string> = {};
  const missingFields: string[] = [];
  const errors: string[] = [];

  for (const [fieldKey, aliases] of Object.entries(requiredHeaderAliases)) {
    let foundHeader = "";
    
    // Check normalized matches first
    for (const alias of aliases) {
      const normAlias = normalizeHeaderString(alias);
      const match = normalizedInputHeaders.find(
        (item) => item.normalized === normAlias || item.compact === compactHeaderString(alias)
      );
      if (match) {
        foundHeader = match.original;
        break;
      }
    }

    if (foundHeader) {
      matchedHeaders[fieldKey] = foundHeader;
    } else {
      missingFields.push(fieldKey);
      errors.push(
        `Thiếu cột bắt buộc: "${aliases[0]}" (đã hỗ trợ chuẩn hóa tên cột không phân biệt hoa/thường, dấu tiếng Việt hoặc khoảng trắng)`
      );
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    matchedHeaders,
    errors,
  };
}

/**
 * Validates a single Excel row object using Zod
 */
export function parseAndValidateExcelRow(rawRow: Record<string, any>): {
  success: boolean;
  data?: ValidatedExcelRow;
  errors?: string[];
} {
  const extracted = extractCanonicalExcelFields(rawRow);
  const result = ExcelRowSchema.safeParse(extracted);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const formattedErrors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return { success: false, errors: formattedErrors };
  }
}

export interface ExcelValidationSummary {
  isValid: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  headerValidation: ReturnType<typeof validateExcelHeaders>;
  invalidRowsDetails: Array<{ rowIndex: number; rowData: Record<string, any>; errors: string[] }>;
}

/**
 * Validates an entire Excel dataset before processing
 */
export function validateExcelDataset(
  rows: Record<string, any>[],
  options?: { requiredHeaderAliases?: Record<string, readonly string[]> }
): {
  summary: ExcelValidationSummary;
  validRows: ValidatedExcelRow[];
} {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const headerValidation = validateExcelHeaders(headers, options?.requiredHeaderAliases);

  const validRows: ValidatedExcelRow[] = [];
  const invalidRowsDetails: Array<{ rowIndex: number; rowData: Record<string, any>; errors: string[] }> = [];

  rows.forEach((row, index) => {
    const parsed = parseAndValidateExcelRow(row);
    if (parsed.success && parsed.data) {
      validRows.push(parsed.data);
    } else {
      invalidRowsDetails.push({
        rowIndex: index + 1,
        rowData: row,
        errors: parsed.errors || ["Dữ liệu dòng không hợp lệ"],
      });
    }
  });

  const isValid = headerValidation.isValid && invalidRowsDetails.length === 0;

  return {
    summary: {
      isValid,
      totalRows: rows.length,
      validRowsCount: validRows.length,
      invalidRowsCount: invalidRowsDetails.length,
      headerValidation,
      invalidRowsDetails,
    },
    validRows,
  };
}

/**
 * Helper to parse Duration value to hours (handles Excel fractional day, HH:MM format, and numeric hours)
 * Returns hours. Excel fractional-day values are converted with `* 24` once;
 * callers then multiply the returned hours by the payroll rate.
 */
export function parseDurationToHours(rawDuration: any): number {
  if (rawDuration === null || rawDuration === undefined || rawDuration === "") return 0;

  // With `cellDates: true`, SheetJS converts an Excel time-formatted value
  // (for example 0.083333 = 02:00) to a Date around Excel's 1899-12-30
  // epoch. The Master worker serializes its payload as JSON, so the same value
  // can also arrive here as an ISO string. Reading that string with parseFloat
  // returns 1899 and inflates Pivot salary hundreds of times.
  if (rawDuration instanceof Date) {
    return parseExcelEpochDuration(rawDuration) ?? 0;
  }
  
  if (typeof rawDuration === "number") {
    if (!Number.isFinite(rawDuration) || rawDuration <= 0) return 0;
    // If Excel fractional day (0 < duration < 1, e.g. 0.208333333 = 5h), convert to hours (* 24)
    return normalizeDurationHours(
      rawDuration > 0 && rawDuration < 1
        ? rawDuration * 24
        : rawDuration,
    );
  }

  const rawString = String(rawDuration).trim();
  const excelEpochHours = parseExcelEpochDuration(rawString);
  if (excelEpochHours !== null) return excelEpochHours;

  // A calendar date is not a duration. Reject it before any numeric parsing,
  // otherwise values such as 2026-01-15 would become 2026 hours.
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(rawString)) return 0;

  const str = rawString.replace(/,/g, ".");
  if (!str) return 0;

  const timeMatch = str.match(
    /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d(?:\.\d+)?))?$/,
  );
  if (timeMatch) {
    const h = Number(timeMatch[1]) || 0;
    const m = Number(timeMatch[2]) || 0;
    const s = Number(timeMatch[3] || "0") || 0;
    return normalizeDurationHours(h + m / 60 + s / 3600);
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(str)) return 0;
  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) return 0;

  return normalizeDurationHours(num > 0 && num < 1 ? num * 24 : num);
}

/**
 * Calculates row amount with support for:
 * 1. Direct Payment/Amount/Salary column if provided in row
 * 2. Standard Master/Pivot formula: duration hours * rate
 */
export function calculateRowAmount(row: Record<string, any> | ValidatedExcelRow, defaultRate = 20000): number {
  const rawObj = row as Record<string, any>;
  
  // 1. Check for explicit payment/amount fields in raw object
  const explicitAmountKeys = [
    "payment", "amount", "so tien", "sotien", "thanh tien", "thanhtien",
    "total salary", "totalsalary", "luong", "tong luong", "tong tien"
  ];
  
  for (const key of Object.keys(rawObj)) {
    const normKey = normalizeHeaderString(key);
    if (explicitAmountKeys.some((k) => normKey.includes(k))) {
      const val = parseFloat(String(rawObj[key]).replace(/,/g, ""));
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  // 2. Duration calculation: parse to hours (Duration * 24 if fractional day) * rate (20,000)
  const durationVal = rawObj.duration !== undefined ? rawObj.duration : rawObj["Duration"] ?? rawObj["duration"] ?? 0;
  const hours = parseDurationToHours(durationVal);
  if (hours <= 0) return 0;

  const customRate = parseFloat(String(rawObj.rate || rawObj.don_gia || rawObj.dongia || defaultRate));
  const finalRate = isNaN(customRate) || customRate <= 0 ? defaultRate : customRate;

  return Math.round(hours * finalRate);
}

/**
 * Safely calculates Pivot values after Zod validation
 * Formula: calculatedValue = calculateRowAmount(row)
 */
export function processValidatedPivotData(rawData: Record<string, any>[], fileName = "") {
  const validation = validateExcelDataset(rawData);

  const fileNameUpper = String(fileName || "").toUpperCase();
  const isMKTFile = fileNameUpper.includes("MKT") || fileNameUpper.includes("MARKETING");

  const pivotResult: Record<string, Record<string, number>> = {};

  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i];
    const originalChargeCenter = String(
      rawRow["Charge to Center MKT"] ||
      rawRow["Charge to Center"] ||
      rawRow["CHARGE TO CENTER"] ||
      rawRow["Charge Code Centre"] ||
      rawRow["chargeToCenter"] ||
      ""
    ).trim();

    const bankVal = String(
      rawRow["Bank"] ||
      rawRow["BANK"] ||
      rawRow["Center"] ||
      rawRow["CENTER"] ||
      rawRow["Center Code"] ||
      ""
    ).trim().toUpperCase();

    const l07Val = String(
      rawRow["L07"] ||
      rawRow["l07"] ||
      rawRow["cột L07"] ||
      rawRow["L07 = Charge to Center MKT"] ||
      ""
    ).trim();

    let finalChargeCenter = originalChargeCenter;

    const isMktNorthBank =
      bankVal === "MKT LOCAL NORTH" ||
      bankVal.includes("MKT LOCAL NORTH") ||
      bankVal.includes("MKT NORTH") ||
      fileNameUpper.includes("MKT LOCAL NORTH") ||
      fileNameUpper.includes("MKT_LOCAL_NORTH") ||
      fileNameUpper.includes("LOCAL NORTH");

    if (isMKTFile && isMktNorthBank && !l07Val.toUpperCase().includes("MKT")) {
      if (l07Val) {
        finalChargeCenter = l07Val;
      }
    }

    let centerKey = "N/A";
    if (isMktNorthBank) {
      centerKey = finalChargeCenter || originalChargeCenter || l07Val || "MKT LOCAL NORTH";
    } else {
      centerKey = finalChargeCenter || originalChargeCenter || l07Val || bankVal || "N/A";
    }
    const typeKey = String(rawRow["Type"] || rawRow["TYPE"] || rawRow["type"] || rawRow["Task Type"] || "Khác").trim();
    
    // Calculate total amount using smart amount detection
    const rawDuration = rawRow["Duration"] ?? rawRow["DURATION"] ?? rawRow["duration"] ?? 0;
    const durHours = parseDurationToHours(rawDuration);
    const calculatedValue = durHours > 0 ? Math.round(durHours * 20000) : calculateRowAmount(rawRow);

    if (!pivotResult[centerKey]) {
      pivotResult[centerKey] = { Total: 0 };
    }

    pivotResult[centerKey][typeKey] = (pivotResult[centerKey][typeKey] || 0) + calculatedValue;
    pivotResult[centerKey]["Total"] += calculatedValue;
  }

  return {
    pivotResult,
    validationSummary: validation.summary,
    validRows: validation.validRows,
  };
}
