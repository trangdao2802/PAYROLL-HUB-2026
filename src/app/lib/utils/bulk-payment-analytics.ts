/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  formatIdNumber,
  parseMoneyToNumber,
  getHoldRowAmount,
  removeVietnameseTones,
} from "./data-utils";
import { getBusinessFromL07, mapL07 } from "./center-utils";

export interface PayrollBuMonthSummaryRow {
  id: string;
  "Tháng HOLD": string;
  "Kỳ báo cáo": string;
  BU: string;
  "Tổng số dư HOLD": number;
  "HOLD phát sinh": number;
  "Số dư HOLD đầu kỳ": number;
  "Thanh toán HOLD tại kỳ": number;
  "Tháng thanh toán tại kỳ": string;
  "Các tháng đã thanh toán": string;
  "CANCEL tại kỳ": number;
  "BONUS tại kỳ"?: number;
  "Số dư HOLD còn lại": number;
  "Diễn biến tại kỳ": string;
  "Trạng thái HOLD": string;
}

export interface BulkPaymentAnalyticsResult {
  currentPeriod: string;
  businessUnits: string[];
  summaryRows: PayrollBuMonthSummaryRow[];
}

interface BuildBulkPaymentAnalyticsParams {
  /** Chỉ dùng để bổ sung BU/L07 khi dòng HOLD thiếu thông tin. */
  sheet1Rows: any[];
  holdRows: any[];
  /** Chỉ dùng để bổ sung BU/L07 khi dòng HOLD thiếu thông tin. */
  bankRows: any[];
  globalMonth: string;
}

export interface MonthPeriod {
  month: number;
  year: number;
  key: string;
}

type HoldOperation = "HOLD" | "ADD" | "CANCEL";

interface DimensionDescriptor {
  l07: string;
  business: string;
}

interface HoldEntry {
  reportPeriod: MonthPeriod;
  occurrencePeriod: MonthPeriod;
  operation: HoldOperation;
  amount: number;
  business: string;
}

interface HoldLifecycleBucket {
  business: string;
  occurrencePeriod: MonthPeriod;
  holdInOccurrencePeriod: number;
  holdInLaterPeriods: number;
  addBeforePeriod: number;
  addInPeriod: number;
  cancelBeforePeriod: number;
  cancelInPeriod: number;
  addPaymentPeriods: Map<string, MonthPeriod>;
}

export const readFirst = (row: any, keys: string[]): unknown => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

export const extractReportPeriod = (
  row: any,
  fallbackPeriod: MonthPeriod,
): MonthPeriod => {
  const explicitReportMonth = readFirst(row, [
    "Tháng báo cáo",
    "THÁNG BÁO CÁO",
    "Kỳ báo cáo",
    "KY BAO CAO",
    "_fileMonth",
    "Tháng",
    "Month",
    "Report Month",
  ]);
  const parsed = parseMonthPeriod(explicitReportMonth, fallbackPeriod);
  return parsed || fallbackPeriod;
};

const normalizeText = (value: unknown): string =>
  removeVietnameseTones(String(value ?? ""))
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeAccount = (value: unknown): string =>
  String(value ?? "").replace(/\s+/g, "").trim().toUpperCase();

export const periodFromParts = (month: number, year: number): MonthPeriod | null => {
  if (month < 1 || month > 12 || year < 1900 || year > 2200) return null;
  return {
    month,
    year,
    key: `${year}-${String(month).padStart(2, "0")}`,
  };
};

export const parseMonthPeriod = (
  value: unknown,
  fallback?: MonthPeriod,
): MonthPeriod | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return periodFromParts(value.getMonth() + 1, value.getFullYear());
  }

  const raw = String(value ?? "").trim();
  if (!raw) return fallback || null;

  const normalized = normalizeText(raw).replace(/NAM|YEAR/g, " ");
  
  // Year first: 2025.12, 2025/12, 2025-12
  const yearFirst = normalized.match(
    /\b(19\d{2}|20\d{2})\s*[./_\- ]\s*(0?[1-9]|1[0-2])\b/,
  );
  if (yearFirst) {
    return periodFromParts(Number(yearFirst[2]), Number(yearFirst[1]));
  }

  // Month first: 12.2025, 12/2025, 12-2025, T12.2025, THANG 12/2025
  const monthFirst = normalized.match(
    /(?:THANG|THG|T)?\s*(0?[1-9]|1[0-2])\s*[./_\- ]\s*(19\d{2}|20\d{2})\b/,
  );
  if (monthFirst) {
    return periodFromParts(Number(monthFirst[1]), Number(monthFirst[2]));
  }

  // Month only: T12, THANG 12, 12, 1, 01
  const monthOnly = normalized.match(/(?:^|[^0-9])(?:THANG|THG|T)?\s*(0?[1-9]|1[0-2])(?:\s*$|[^0-9])/);
  if (monthOnly) {
    const monthNum = Number(monthOnly[1]);
    const refYear = fallback?.year || new Date().getFullYear();
    const refMonth = fallback?.month || (new Date().getMonth() + 1);
    // If month > refMonth, it's typically from the previous year
    const year = monthNum > refMonth ? refYear - 1 : refYear;
    return periodFromParts(monthNum, year);
  }

  return fallback || null;
};

export const extractOccurrencePeriod = (row: any, fallbackPeriod: MonthPeriod): MonthPeriod => {
  // 1. Direct columns
  const directFields = [
    "Tháng phát sinh",
    "THÁNG PHÁT SINH",
    "Month of Occurrence",
    "Tháng lương",
    "Tháng chi trả",
    "Tháng PS",
    "Tháng nợ",
  ];
  for (const field of directFields) {
    const val = row?.[field];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      const parsed = parseMonthPeriod(val, fallbackPeriod);
      if (parsed) return parsed;
    }
  }

  // 2. Search in descriptive fields
  const searchFields = [
    "Nghiệp vụ",
    "Trạng thái",
    "Tình trạng thanh toán",
    "Ghi chú",
    "Note",
    "Nội dung",
    "Lý do",
    "Sheet Source",
    "Description",
  ];
  for (const field of searchFields) {
    const val = String(row?.[field] || "").trim();
    if (!val) continue;

    const parsed = parseMonthPeriod(val, fallbackPeriod);
    if (parsed) return parsed;
  }

  return fallbackPeriod;
};

export const comparePeriods = (left: MonthPeriod, right: MonthPeriod): number =>
  left.year === right.year ? left.month - right.month : left.year - right.year;

export const formatPeriod = (period: MonthPeriod): string =>
  `${String(period.month).padStart(2, "0")}.${period.year}`;

export const employeeIdOf = (row: any): string =>
  formatIdNumber(
    readFirst(row, [
      "ID Number",
      "Document ID",
      "Document ID / CCCD",
      "Mã nhân viên",
      "Mã NV",
      "Mã AE",
      "Mã ae",
      "CCCD",
      "CMND",
      "ID",
    ]),
  ).toUpperCase();

export const fullNameOf = (row: any): string =>
  String(
    readFirst(row, [
      "Full name",
      "Full Name",
      "Beneficiary Name",
      "Họ và tên",
      "Họ tên",
      "Name",
    ]),
  ).trim();

export const accountOf = (row: any): string =>
  normalizeAccount(
    readFirst(row, [
      "Bank Account Number",
      "Beneficiary Account No.",
      "Account Number",
      "Số tài khoản",
      "STK",
    ]),
  );

export const dimensionsOf = (row: any): DimensionDescriptor => {
  const rawL07 = String(
    readFirst(row, [
      "L07",
      "L07 Code",
      "Center Code",
      "Charge to center",
      "charge_to_center_mkt",
      "Center",
      "Mã trung tâm",
      "Mã AE",
      "Mã ae",
    ]),
  ).trim();
  const mappedL07 = rawL07 ? mapL07(rawL07) : "";
  const l07 = String(mappedL07 || rawL07).trim().toUpperCase();
  const rawBusiness = String(
    readFirst(row, ["BU", "Business", "Bộ phận", "Department", "BUS"]),
  )
    .trim()
    .toUpperCase()
    .replace(/^AHN_HP$/, "AHP");

  return {
    l07,
    business: rawBusiness || (l07 ? getBusinessFromL07(l07) : ""),
  };
};

export const moneyOf = (row: any): number => {
  const holdAmt = getHoldRowAmount(row);
  if (holdAmt !== 0) return holdAmt;
  return parseMoneyToNumber(
    readFirst(row, [
      "Payment Amount",
      "Amount",
      "Số tiền",
      "Thành tiền",
      "TOTAL PAYMENT",
      "Total Payment",
      "Grand Total",
      "GRAND TOTAL",
    ]),
  );
};

export const classifyHoldOperation = (row: any): HoldOperation | null => {
  const explicitCode = normalizeText(row?.["Nghiệp vụ"]);
  if (explicitCode === "B" || explicitCode === "BONUS") return null;
  if (explicitCode === "H" || explicitCode === "HOLD") return "HOLD";
  if (explicitCode === "A" || explicitCode === "ADD") return "ADD";
  if (explicitCode === "C" || explicitCode === "CANCEL") return "CANCEL";

  const source = normalizeText(row?.["Sheet Source"]);
  const status = normalizeText(
    readFirst(row, ["Trạng thái", "Tình trạng thanh toán"]),
  );
  const combined = `${explicitCode} ${source} ${status}`;

  if (
    combined.includes("BONUS") ||
    combined.includes("SUMMER") ||
    combined.includes("INSTRUCTOR") ||
    combined.includes("⏯") ||
    combined.includes("⏩")
  ) {
    return null;
  }

  if (combined.includes("CANCEL") || combined.includes("HUY")) return "CANCEL";
  if (
    combined.includes("ADD") ||
    combined.includes("RELEASE") ||
    combined.includes("UNHOLD") ||
    combined.includes("THANH TOAN") ||
    combined.includes("PAID")
  ) {
    return "ADD";
  }
  if (combined.includes("HOLD") || combined.includes("GIU LAI")) return "HOLD";

  return moneyOf(row) < 0 ? "HOLD" : "ADD";
};

export const isUsableHoldRow = (row: any): boolean => {
  if (!row) return false;
  return !normalizeText(row["Sheet Source"]).includes("SHEET 1");
};

const buildIdentityResolver = (rows: any[]) => {
  const nameToIdentity = new Map<string, string>();
  const accountToIdentity = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  const ambiguousAccounts = new Set<string>();

  const registerAlias = (
    alias: string,
    identityKey: string,
    target: Map<string, string>,
    ambiguous: Set<string>,
  ) => {
    if (!alias || ambiguous.has(alias)) return;
    const existing = target.get(alias);
    if (existing && existing !== identityKey) {
      target.delete(alias);
      ambiguous.add(alias);
      return;
    }
    target.set(alias, identityKey);
  };

  rows.forEach((row) => {
    const employeeId = employeeIdOf(row);
    if (!employeeId) return;
    const identityKey = `ID:${employeeId}`;
    registerAlias(
      normalizeText(fullNameOf(row)),
      identityKey,
      nameToIdentity,
      ambiguousNames,
    );
    registerAlias(
      accountOf(row),
      identityKey,
      accountToIdentity,
      ambiguousAccounts,
    );
  });

  return (row: any, fallbackIndex: number): string => {
    const employeeId = employeeIdOf(row);
    if (employeeId) return `ID:${employeeId}`;

    const account = accountOf(row);
    if (account && accountToIdentity.has(account)) {
      return accountToIdentity.get(account)!;
    }

    const normalizedName = normalizeText(fullNameOf(row));
    if (normalizedName && nameToIdentity.has(normalizedName)) {
      return nameToIdentity.get(normalizedName)!;
    }
    if (normalizedName) return `NAME:${normalizedName}`;
    if (account) return `ACCOUNT:${account}`;
    return `UNKNOWN:${String(row?.id || row?._recordId || fallbackIndex)}`;
  };
};

const createBucket = (
  business: string,
  occurrencePeriod: MonthPeriod,
): HoldLifecycleBucket => ({
  business,
  occurrencePeriod,
  holdInOccurrencePeriod: 0,
  holdInLaterPeriods: 0,
  addBeforePeriod: 0,
  addInPeriod: 0,
  cancelBeforePeriod: 0,
  cancelInPeriod: 0,
  addPaymentPeriods: new Map<string, MonthPeriod>(),
});

export function buildBulkPaymentAnalytics({
  sheet1Rows,
  holdRows,
  bankRows,
  globalMonth,
}: BuildBulkPaymentAnalyticsParams): BulkPaymentAnalyticsResult {
  const now = new Date();
  const currentPeriod =
    parseMonthPeriod(globalMonth) ||
    periodFromParts(now.getMonth() + 1, now.getFullYear())!;

  // Gross Pay/Transaction chỉ hỗ trợ nhận diện BU/L07. Số tiền ANALYS chỉ lấy
  // từ HOLD AE và bốn nghiệp vụ HOLD, ADD, CANCEL, BONUS.
  const referenceRows = [...sheet1Rows, ...holdRows, ...bankRows];
  const resolveIdentity = buildIdentityResolver(referenceRows);
  const dimensionHints = new Map<string, DimensionDescriptor>();

  referenceRows.forEach((row, index) => {
    const identityKey = resolveIdentity(row, index);
    const incoming = dimensionsOf(row);
    const existing = dimensionHints.get(identityKey);
    dimensionHints.set(identityKey, {
      l07: existing?.l07 || incoming.l07,
      business: existing?.business || incoming.business,
    });
  });

  const holdEntries: HoldEntry[] = holdRows.flatMap((row, index) => {
    if (!isUsableHoldRow(row)) return [];
    const operation = classifyHoldOperation(row);
    if (!operation) return [];

    const explicitReportMonth = readFirst(row, [
      "Tháng báo cáo",
      "_fileMonth",
      "Tháng",
      "Month",
      "Kỳ báo cáo",
      "Report Month",
    ]);

    const reportPeriod = parseMonthPeriod(
      explicitReportMonth,
      currentPeriod,
    ) || currentPeriod;

    const occurrencePeriod = extractOccurrencePeriod(row, reportPeriod);

    if (!reportPeriod || !occurrencePeriod) return [];

    const identityKey = resolveIdentity(
      row,
      sheet1Rows.length + bankRows.length + index,
    );
    const directDimensions = dimensionsOf(row);
    const hint = dimensionHints.get(identityKey);
    const l07 = directDimensions.l07 || hint?.l07 || "CHƯA XÁC ĐỊNH";
    
    // Fallback BU detection from all textual fields if still not found
    let business =
      directDimensions.business ||
      hint?.business ||
      (l07 !== "CHƯA XÁC ĐỊNH" ? getBusinessFromL07(l07) : "");

    if (!business || business === "OTHER" || business === "UNKNOWN") {
      const combinedText = [
        row["Sheet Source"],
        row["CENTER NOTE"],
        row["Center"],
        row["Center Code"],
        row["L07"],
        row["Mã AE"],
        row["Note"],
        row["Ghi chú"],
        row["Full name"],
      ]
        .map((v) => String(v || "").toUpperCase())
        .join(" ");

      if (combinedText.includes("AHP") || combinedText.includes("HAIPHONG") || combinedText.includes("HAI PHONG")) {
        business = "AHP";
      } else if (combinedText.includes("ATH") || combinedText.includes("THANH HOA") || combinedText.includes("THANH HÓA")) {
        business = "ATH";
      } else if (combinedText.includes("ATN") || combinedText.includes("THAI NGUYEN") || combinedText.includes("THÁI NGUYÊN")) {
        business = "ATN";
      } else if (combinedText.includes("APT") || combinedText.includes("PHU THO") || combinedText.includes("PHÚ THỌ")) {
        business = "APT";
      } else if (combinedText.includes("AHN") || combinedText.includes("HA NOI") || combinedText.includes("HÀ NỘI")) {
        business = "AHN";
      } else {
        business = "AHN";
      }
    }

    return [
      {
        reportPeriod,
        occurrencePeriod,
        operation,
        amount: Math.abs(moneyOf(row)),
        business,
      },
    ];
  });

  const buckets = new Map<string, HoldLifecycleBucket>();
  holdEntries.forEach((entry) => {
    const reportCompare = comparePeriods(entry.reportPeriod, currentPeriod);
    // Bỏ qua các bản ghi thuộc kỳ báo cáo tương lai sau kỳ hiện tại
    if (reportCompare > 0) return;

    const occurrenceCompare = comparePeriods(
      entry.occurrencePeriod,
      currentPeriod,
    );
    // Bỏ qua các tháng phát sinh trong tương lai
    if (occurrenceCompare > 0) return;

    const key = `${entry.business}|${entry.occurrencePeriod.key}`;
    const bucket =
      buckets.get(key) || createBucket(entry.business, entry.occurrencePeriod);

    if (entry.operation === "HOLD") {
      const relToOccurrence = comparePeriods(
        entry.reportPeriod,
        entry.occurrencePeriod,
      );
      if (relToOccurrence <= 0) {
        // Dòng HOLD gốc phát sinh tại đúng tháng phát sinh (R <= M)
        bucket.holdInOccurrencePeriod += entry.amount;
      } else {
        // Dòng HOLD của tháng cũ được liệt kê lại trong file kỳ sau (R > M)
        bucket.holdInLaterPeriods += entry.amount;
      }
    } else if (entry.operation === "ADD") {
      if (reportCompare < 0) {
        bucket.addBeforePeriod += entry.amount;
      } else {
        bucket.addInPeriod += entry.amount;
      }
      bucket.addPaymentPeriods.set(entry.reportPeriod.key, entry.reportPeriod);
    } else if (entry.operation === "CANCEL") {
      if (reportCompare < 0) {
        bucket.cancelBeforePeriod += entry.amount;
      } else {
        bucket.cancelInPeriod += entry.amount;
      }
    }

    buckets.set(key, bucket);
  });

  const reportLabel = formatPeriod(currentPeriod);
  const summaryRows = Array.from(buckets.values())
    .map((bucket): PayrollBuMonthSummaryRow => {
      const isCurrentMonthOccurrence =
        comparePeriods(bucket.occurrencePeriod, currentPeriod) === 0;

      // 3. Thanh toán & Cancel tại kỳ hiện tại:
      const paidInPeriod = bucket.addInPeriod;
      const cancelInPeriod = bucket.cancelInPeriod;

      let initialHold = 0;
      let openingBalance = 0;
      let remainingBalance = 0;

      if (isCurrentMonthOccurrence) {
        if (bucket.holdInOccurrencePeriod > 0) {
          initialHold = bucket.holdInOccurrencePeriod;
        } else {
          initialHold = Math.max(
            bucket.holdInLaterPeriods,
            bucket.addBeforePeriod +
              bucket.addInPeriod +
              bucket.cancelBeforePeriod +
              bucket.cancelInPeriod,
          );
        }
        openingBalance = 0;
        remainingBalance = Math.max(
          0,
          initialHold - paidInPeriod - cancelInPeriod,
        );
      } else {
        // Tháng phát sinh < Tháng báo cáo (Tháng cũ)
        const baseHold = Math.max(
          bucket.holdInOccurrencePeriod,
          bucket.holdInLaterPeriods,
        );
        initialHold = Math.max(
          baseHold,
          bucket.addBeforePeriod +
            paidInPeriod +
            bucket.cancelBeforePeriod +
            cancelInPeriod,
        );
        openingBalance = Math.max(
          0,
          initialHold - bucket.addBeforePeriod - bucket.cancelBeforePeriod,
        );
        remainingBalance = Math.max(
          0,
          openingBalance - paidInPeriod - cancelInPeriod,
        );
      }

      const holdInPeriod = isCurrentMonthOccurrence ? initialHold : 0;
      // Phần II chỉ phản ánh số dư đã tồn tại trước kỳ báo cáo. HOLD phát sinh
      // đúng kỳ hiện tại phải nằm ở Phần III và không được cộng vào tổng đầu kỳ.
      const totalPriorPeriodHold = isCurrentMonthOccurrence ? 0 : initialHold;
      
      const paymentMonths = Array.from(bucket.addPaymentPeriods.values())
        .sort(comparePeriods)
        .map(formatPeriod);
      const movements: string[] = [];
      if (holdInPeriod > 0) movements.push("HOLD mới");
      if (paidInPeriod > 0) movements.push("Thanh toán HOLD");
      if (cancelInPeriod > 0) movements.push("CANCEL");

      let status = "Chưa thanh toán";
      if (initialHold <= 0) {
        status =
          cancelInPeriod > 0 || bucket.cancelBeforePeriod > 0
            ? "Đã hủy"
            : "Không có HOLD";
      } else if (remainingBalance <= 0) {
        status =
          bucket.cancelBeforePeriod + cancelInPeriod > 0 &&
          bucket.addBeforePeriod + paidInPeriod === 0
            ? "Đã hủy"
            : "Đã tất toán";
      } else if (bucket.addBeforePeriod + paidInPeriod > 0) {
        status = "Thanh toán một phần";
      } else if (bucket.cancelBeforePeriod + cancelInPeriod > 0) {
        status = "Đã hủy một phần";
      }

      return {
        id: `${bucket.business}|${bucket.occurrencePeriod.key}`,
        "Tháng HOLD": formatPeriod(bucket.occurrencePeriod),
        "Kỳ báo cáo": reportLabel,
        BU: bucket.business,
        "Tổng số dư HOLD": totalPriorPeriodHold,
        "HOLD phát sinh": holdInPeriod,
        "Số dư HOLD đầu kỳ": openingBalance,
        "Thanh toán HOLD tại kỳ": paidInPeriod,
        "Tháng thanh toán tại kỳ":
          paidInPeriod > 0 ? reportLabel : "",
        // Preserve every payment period as a distinct line. This keeps the
        // history readable in the table and in exported spreadsheet cells.
        "Các tháng đã thanh toán": paymentMonths.join("\n"),
        "CANCEL tại kỳ": cancelInPeriod,
        "Số dư HOLD còn lại": remainingBalance,
        "Diễn biến tại kỳ": movements.join(" + ") || "Không phát sinh",
        "Trạng thái HOLD": status,
      };
    })
    .filter(
      (row) =>
        // Hiển thị tất cả các tháng chứa khoản HOLD (kể cả đã được thanh toán hoặc hủy về 0)
        true,
    )
    .sort((left, right) => {
      const businessCompare = left.BU.localeCompare(right.BU, "vi");
      if (businessCompare !== 0) return businessCompare;
      const leftPeriod = parseMonthPeriod(left["Tháng HOLD"], currentPeriod)!;
      const rightPeriod = parseMonthPeriod(right["Tháng HOLD"], currentPeriod)!;
      return comparePeriods(leftPeriod, rightPeriod);
    });

  const businessUnits = Array.from(
    new Set(summaryRows.map((row) => row.BU).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "vi"));

  return {
    currentPeriod: reportLabel,
    businessUnits,
    summaryRows,
  };
}
