/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseMoneyToNumber } from "./data-utils";

/**
 * Supported Bank Type definitions for Bulk Payment operations.
 * Forces explicit declaration of the processing institution.
 */
export type BankType = "BANK_NORTH" | "BANK_TINH" | "OTHER";


/**
 * Strict mapping of Business Units (BU) to their corresponding Bank Type.
 * Prevents logic leaks between BANK_NORTH and BANK_TINH.
 */
export const BANK_BU_MAPPING: Record<string, BankType> = {
  AHN: "BANK_NORTH",
  AHP: "BANK_NORTH",
  ATH: "BANK_NORTH",
  ATN: "BANK_NORTH",
  APT: "BANK_NORTH",
};

/**
 * Normalizes and determines the Bank Type for a given Business Unit (BU).
 * Ensures "AHN_HP" is correctly mapped to "AHP" first, then categorized.
 */
export function getBankTypeForBU(bu: string): BankType {
  let cleanBU = String(bu || "").trim().toUpperCase();
  if (cleanBU === "AHN_HP") {
    cleanBU = "AHP";
  }
  return BANK_BU_MAPPING[cleanBU] || "OTHER";
}

/**
 * Validates if a Business Unit belongs strictly to the requested Bank Type.
 * Used to enforce strict segregation in bulk payment loops.
 */
export function isBUOfBankType(bu: string, bankType: BankType): boolean {
  return getBankTypeForBU(bu) === bankType;
}

/**
 * Parameters required for running a secure, isolated payment processor run.
 */
export interface PaymentProcessorParams {
  bankType: BankType;
  sheet1Rows: any[];
  holdRows: any[];
  globalMonth: string;
  currentMonthNum: number;
  currentYearNum: number;
  targetMonthLabelComp: string;
  monMatchComp: (s: string) => string | null;
  isMonthInStrComp: (s: string) => boolean;
  isSameMonthForSumIf: (rowMonthStr: string, currentMonthVal: string) => boolean;
  isPastMonthHold: (row: any, currentMonthNum: number, currentYearNum: number) => boolean;
  removeVietnameseTones: (str: string) => string;
}

/**
 * Structured outputs from the payment processor run.
 */
export interface ProcessedBankTotals {
  sheet1Total: number;
  holdTotal: number;
  grandTotal: number;
  buBreakdown: Record<string, { sheet1: number; hold: number; total: number }>;
}

/**
 * Executes a secure bulk calculation run for a declared BankType.
 * Guaranteed to only process BUs belonging strictly to the declared bankType.
 */
export function processBulkPaymentTotals(params: PaymentProcessorParams): ProcessedBankTotals {
  const {
    bankType,
    sheet1Rows,
    holdRows,
    currentMonthNum,
    currentYearNum,
    targetMonthLabelComp,
    monMatchComp,
    isMonthInStrComp,
    isPastMonthHold,
    removeVietnameseTones,
  } = params;

  // Track ID/Name/Acc mappings to BUs for Hold table fallbacks
  const idToSheet1: Record<string, string> = {};
  const nameToSheet1: Record<string, string> = {};
  const accToSheet1: Record<string, string> = {};

  // First pass over Sheet 1 rows to populate lookups & sum sheet 1 totals
  let sheet1Total = 0;
  const buBreakdown: Record<string, { sheet1: number; hold: number; total: number }> = {};

  sheet1Rows.forEach((row) => {
    // For Sheet 1, we are more inclusive. If the month is missing, we assume it belongs to the current batch.
    // We only skip if the row explicitly belongs to a DIFFERENT month.
    const rowMonthRaw = String(row["Tháng báo cáo"] || row["_fileMonth"] || row["Tháng"] || "").trim();
    if (rowMonthRaw) {
      const extracted = monMatchComp(rowMonthRaw);
      if (extracted && extracted !== targetMonthLabelComp) return;
      if (!extracted && !isMonthInStrComp(rowMonthRaw)) return;
    }

    let biz = String(row["Business"] || row["BU"] || "").trim().toUpperCase();
    if (biz === "AHN_HP") biz = "AHP";

    const id = String(row["ID Number"] || row["Mã AE"] || row["Mã ae"] || "").trim();
    const name = removeVietnameseTones(row["Full name"] || row["Beneficiary Name"] || "").toUpperCase();
    const acc = String(row["Bank Account Number"] || row["Beneficiary Account No."] || "").trim();

    // Enhanced BU detection for Sheet 1
    if (!biz || biz === "UNKNOWN" || biz === "") {
      const textToMatch = [
        String(row["Sheet Source"] || ""),
        String(row["CENTER NOTE"] || ""),
        String(row["Center"] || ""),
        String(row["Center Code"] || ""),
        id,
        name,
        String(row["Note"] || ""),
      ]
        .map((v) => v.toUpperCase())
        .join(" ");

      if (textToMatch.includes("AHP") || textToMatch.includes("HAIPHONG") || textToMatch.includes("HAI PHONG")) {
        biz = "AHP";
      } else if (textToMatch.includes("ATH") || textToMatch.includes("THANH HOA") || textToMatch.includes("THANH HÓA")) {
        biz = "ATH";
      } else if (textToMatch.includes("ATN") || textToMatch.includes("THAI NGUYEN") || textToMatch.includes("THÁI NGUYÊN")) {
        biz = "ATN";
      } else if (textToMatch.includes("APT") || textToMatch.includes("PHU THO") || textToMatch.includes("PHÚ THỌ")) {
        biz = "APT";
      } else if (textToMatch.includes("AHN") || textToMatch.includes("HA NOI") || textToMatch.includes("HÀ NỘI")) {
        biz = "AHN";
      } else {
        biz = "AHN";
      }
    }

    if (id) idToSheet1[id] = biz;
    if (name) nameToSheet1[name] = biz;
    if (acc) accToSheet1[acc] = biz;

    // Enforce bankType separation
    if (isBUOfBankType(biz, bankType)) {
      const amount = parseMoneyToNumber(
        row["TOTAL PAYMENT"] ||
          row["Total Payment"] ||
          row["Grand Total"] ||
          row["GRAND TOTAL"] ||
          row["Payment Amount"] ||
          row["PAYMENT AMOUNT"] ||
          row["Số tiền"] ||
          row["Sale Incentive Amount"] ||
          row["Final Amount"] ||
          row["Net Amount"] ||
          0
      );
      sheet1Total += amount;

      if (!buBreakdown[biz]) {
        buBreakdown[biz] = { sheet1: 0, hold: 0, total: 0 };
      }
      buBreakdown[biz].sheet1 += amount;
      buBreakdown[biz].total += amount;
    }
  });

  // Second pass over Hold rows
  let holdTotal = 0;

  holdRows.forEach((row) => {
    // Filter by month
    const rowMonthRaw = String(row["Tháng báo cáo"] || row["_fileMonth"] || row["Tháng"] || "").trim();
    const extracted = monMatchComp(rowMonthRaw);
    if (extracted && extracted !== targetMonthLabelComp) return;
    if (!extracted && rowMonthRaw && !isMonthInStrComp(rowMonthRaw)) return;

    // Filter controls
    const command = String(row["Lệnh"] || "").trim().toUpperCase();
    if (command === "-") return;

    const sheetSource = String(row["Sheet Source"] || "").toLowerCase();
    if (sheetSource.includes("sheet 1 ae") || sheetSource.includes("sheet 1")) return;

    if (row._dimmed) return;

    const nghiepVu = String(row["Nghiệp vụ"] || "").toLowerCase();

    // Determine BU (with sheet1 lookups)
    let biz = String(row["BU"] || row["Business"] || "").trim().toUpperCase();
    if (biz === "AHN_HP") biz = "AHP";

    const id = String(row["ID Number"] || row["Mã AE"] || row["Mã ae"] || "").trim();
    const name = removeVietnameseTones(row["Full name"] || row["Beneficiary Name"] || "").toUpperCase();
    const acc = String(row["Bank Account Number"] || row["Beneficiary Account No."] || "").trim();

    if (!biz || biz === "UNKNOWN") biz = idToSheet1[id];
    if ((!biz || biz === "UNKNOWN") && acc) biz = accToSheet1[acc];
    if ((!biz || biz === "UNKNOWN") && name) biz = nameToSheet1[name];

    // fallback mapping if still unknown
    if (!biz || biz === "UNKNOWN") {
      const textToMatch = [
        row["Sheet Source"],
        row["CENTER NOTE"],
        row["Center"],
        row["Center Code"],
        row["L07"],
        row["Mã ae"],
        row["Note"],
        row["Full name"],
      ]
        .map((v) => String(v || "").toUpperCase())
        .join(" ");

      if (textToMatch.includes("AHP") || textToMatch.includes("HAIPHONG") || textToMatch.includes("HAI PHONG")) {
        biz = "AHP";
      } else if (textToMatch.includes("ATH") || textToMatch.includes("THANH HOA") || textToMatch.includes("THANH HÓA")) {
        biz = "ATH";
      } else if (textToMatch.includes("ATN") || textToMatch.includes("THAI NGUYEN") || textToMatch.includes("THÁI NGUYÊN")) {
        biz = "ATN";
      } else if (textToMatch.includes("APT") || textToMatch.includes("PHU THO") || textToMatch.includes("PHÚ THỌ")) {
        biz = "APT";
      } else if (textToMatch.includes("AHN") || textToMatch.includes("HA NOI") || textToMatch.includes("HÀ NỘI")) {
        biz = "AHN";
      } else {
        biz = "AHN";
      }
    }

    if (biz === "AHN_HP") biz = "AHP";

    // Enforce bankType separation
    if (isBUOfBankType(biz, bankType)) {
      let val = parseMoneyToNumber(
        row["TOTAL PAYMENT"] ||
          row["Grand Total"] ||
          row["GRAND TOTAL"] ||
          row["Payment Amount"] ||
          0
      );

      const nvCode = String(row["Nghiệp vụ"] || "").trim().toUpperCase();
      const isPastMonth = isPastMonthHold(row, currentMonthNum, currentYearNum);

      const phatSinhStr = String(row["Tháng phát sinh"] || "").trim().replace(/[-_/]/g, ".");
      const [mStr, yStr] = phatSinhStr.split(".");
      const mPhatSinh = parseInt(mStr, 10);
      const yPhatSinh = parseInt(yStr, 10);
      const isDiffMonth =
        !isNaN(mPhatSinh) &&
        !isNaN(yPhatSinh) &&
        (yPhatSinh !== currentYearNum || mPhatSinh !== currentMonthNum);

      let isAdd = nvCode === "A" && isDiffMonth;
      let isBonus = nvCode === "B" && !isPastMonth;

      if (nvCode !== "H" && nvCode !== "A" && nvCode !== "B" && nvCode !== "C") {
        const label = String(row["Sheet Source"] || "").toUpperCase();
        isBonus =
          label.includes("BONUS") ||
          label.includes("SUMMER") ||
          label.includes("INSTRUCTORS") ||
          nghiepVu.includes("bonus") ||
          nghiepVu.includes("⏯") ||
          nghiepVu.includes("⏩");
        isAdd =
          label.includes("ADD") ||
          nghiepVu.includes("add") ||
          nghiepVu.includes("release") ||
          nghiepVu.includes("unhold") ||
          nghiepVu.includes("thanh toán") ||
          nghiepVu.includes("paid") ||
          isBonus;
      }

      if (isAdd || isBonus) {
        val = Math.abs(val);
      } else {
        val = -Math.abs(val);
      }

      if (val !== 0) {
        holdTotal += val;

        if (!buBreakdown[biz]) {
          buBreakdown[biz] = { sheet1: 0, hold: 0, total: 0 };
        }
        buBreakdown[biz].hold += val;
        buBreakdown[biz].total += val;
      }
    }
  });

  const grandTotal = sheet1Total + holdTotal;

  return {
    sheet1Total,
    holdTotal,
    grandTotal,
    buBreakdown,
  };
}
