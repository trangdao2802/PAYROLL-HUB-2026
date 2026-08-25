/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  mapL07,
  getL07FromFileName,
  getL07FromChargeToCenterMkt,
  getCenterInfoByAECode,
  getCenterInfoByL07,
  getAeCodeFromL07,
  getBusinessFromL07,
  resolveMktAndCenterL07,
  resolveNorthMktLocalL07,
} from "./center-utils";
import { getVal } from "./data-utils";

export interface ResolveL07Input {
  rawCenter: string;
  rawChargeToCenter: string;
  sourceFile: string;
  rawType: string;
  rawClassCode: string; // Added to differentiate Cost Type from Class
  rawAeCode: string; // Used to override mapped AE Code
  empId: string;
  staffLookup: Map<string, any>;
  normCenterCache?: Map<string, string>;
}

export interface ResolveL07Result {
  l07: string;
  originalL07: string;
  isMktLocal: boolean;
  mktRegion?: "NORTH" | "SOUTH";
  chargeToCenterMkt: string;
  taskField: string;
  aeCode: string;
  centerBusiness?: string;
  correctedType?: string;
  correctedClass?: string;
}

export function getNormCenter(rCen: string, cache?: Map<string, string>) {
  if (cache?.has(rCen)) return cache.get(rCen)!;
  const l07 = mapL07(rCen);
  if (cache) cache.set(rCen, l07);
  return l07;
}

/**
 * Gross Pay rule for rows read from Sheet 1:
 * every CENTER containing MKT belongs to the MKT Local charge bucket, while
 * L07 is limited to the North regional codes requested by payroll.
 *
 * This helper is intentionally kept out of Pivot Master processing.
 */
export function resolveGrossPayMktL07(rawCenter: string): string {
  return resolveNorthMktLocalL07(rawCenter);
}

export function resolveL07Logic(
  input: ResolveL07Input,
  TASK_COLUMNS: any
): ResolveL07Result {
  const { rawChargeToCenter } = input;
  const {
    rawCenter: rCen,
    sourceFile,
    rawType,
    rawClassCode,
    rawAeCode,
    empId,
    staffLookup,
    normCenterCache,
  } = input;

  const fileUpperName = String(sourceFile).toUpperCase();
  const hasMktInFile =
    fileUpperName.includes("MKT") || fileUpperName.includes("MARKETING");
  const grossPayMktL07 = resolveGrossPayMktL07(rCen);

  let l07 = "";
  let originalL07 = "";
  let mktRegion: "NORTH" | "SOUTH" | undefined = undefined;

  if (hasMktInFile) {
    // 1. NẾU LÀ FILE MKT LOCAL: l07 CHỈ lấy từ tên file (không lấy từ rCen)
    const fileL07 = getL07FromFileName(sourceFile);
    if (fileL07) {
      originalL07 = fileL07;
    } else {
      if (fileUpperName.includes("SOUTH")) {
        originalL07 = "MKT LOCAL SOUTH";
      } else {
        originalL07 = "MKT";
      }
    }
  } else {
    // 1. ĐỌC DỮ LIỆU TỪ CỘT "CƠ SỞ" / "TRUNG TÂM"
    if (rCen) {
      if (
        rCen.toUpperCase() === "MKT NORTH"
      ) {
        originalL07 = "MKT";
      } else if (
        rCen.toUpperCase() === "MKT SOUTH" ||
        rCen.toUpperCase() === "MKT LOCAL SOUTH"
      ) {
        originalL07 = "MKT LOCAL SOUTH";
      } else {
        originalL07 = getNormCenter(rCen, normCenterCache);
      }
    }

    // 2. DỰ PHÒNG THEO TÊN FILE
    if (!originalL07) {
      const fileL07 = getL07FromFileName(sourceFile);
      if (fileL07) {
        originalL07 = fileL07;
      }
    }

    // 3. DỰ PHÒNG THEO CỘT "CHARGE TO CENTER MKT"
    if (!originalL07 && rawChargeToCenter) {
      if (
        rawChargeToCenter.toUpperCase() === "MKT NORTH"
      ) {
        originalL07 = "MKT";
      } else if (
        rawChargeToCenter.toUpperCase() === "MKT SOUTH" ||
        rawChargeToCenter.toUpperCase() === "MKT LOCAL SOUTH"
      ) {
        originalL07 = "MKT LOCAL SOUTH";
      } else {
        originalL07 = getNormCenter(rawChargeToCenter, normCenterCache);
      }
    }
  }

  l07 = originalL07;

  // Pre-resolve MKT so that isMktLocal and l07 are authoritative before taskField mapping!
  const mktResolved = resolveMktAndCenterL07(rCen, rawChargeToCenter, sourceFile, l07);

  // 4. KIỂM TRA ĐIỀU KIỆN MKT LOCAL
  const hasMktInCenter =
    l07 &&
    (l07.toUpperCase().includes("MKT") ||
      l07.toUpperCase().includes("LOCAL"));

  const isChargeColMkt =
    rawChargeToCenter !== "" &&
    rawChargeToCenter !== "-" &&
    (rawChargeToCenter.toUpperCase().includes("MKT") ||
      rawChargeToCenter.toUpperCase().includes("LOCAL") ||
      rawChargeToCenter.toUpperCase().includes("NORTH") ||
      rawChargeToCenter.toUpperCase().includes("SOUTH") ||
      rawChargeToCenter.toUpperCase().includes("AHN") ||
      rawChargeToCenter.toUpperCase().includes("ASH") ||
      rawChargeToCenter.toUpperCase() === "NTW" ||
      !!getL07FromChargeToCenterMkt(rawChargeToCenter));

  const centerIsMkt = hasMktInCenter || hasMktInFile || mktResolved.isMktLocal;
  let isMktLocal = !!(centerIsMkt || isChargeColMkt);

  if (centerIsMkt) {
    l07 = grossPayMktL07 || mktResolved.l07 || l07;
    originalL07 = grossPayMktL07 || mktResolved.l07 || originalL07;
    mktRegion = l07.toUpperCase().includes("SOUTH") ? "SOUTH" : "NORTH";
  }

  // AE CODE logic
  let aeCode = rawAeCode;
  if (!isMktLocal) {
    const centerByAe = getCenterInfoByAECode(l07);
    if (centerByAe) {
      l07 = centerByAe.l07;
    }
  }

  // TASK FIELD Logic
  let correctedType = rawType;
  let correctedClass = rawClassCode;
  let effectiveType = (correctedType || "").toLowerCase().trim();
  const effectiveClass = (correctedClass || "").toLowerCase().trim();

  // If Type is missing but Class has value, swap them
  if (!effectiveType && effectiveClass) {
    correctedType = correctedClass;
    correctedClass = "";
    effectiveType = correctedType.toLowerCase().trim();
  } else if (!effectiveType.startsWith("lpar") && !effectiveType.startsWith("lret") && !effectiveType.startsWith("ldem") && !effectiveType.startsWith("ldec") && !effectiveType.startsWith("moth")) {
    if (effectiveClass.startsWith("lpar") || effectiveClass.startsWith("lret") || effectiveClass.startsWith("ldem") || effectiveClass.startsWith("ldec") || effectiveClass.startsWith("moth")) {
      correctedType = correctedClass;
      correctedClass = "";
      effectiveType = correctedType.toLowerCase().trim();
    }
  }

  let taskField = "adminHours";
  if (effectiveType.startsWith("lpar")) { taskField = "lpar01"; correctedType = "LPAR01"; }
  else if (effectiveType.startsWith("lret")) { taskField = "lret01"; correctedType = "LRET01"; }
  else if (effectiveType.startsWith("ldem")) { taskField = "ldem01"; correctedType = "LDEM01"; }
  else if (effectiveType.startsWith("ldec")) { taskField = "ldec01"; correctedType = "LDEC01"; }
  else if (effectiveType.startsWith("moth")) { taskField = "moth01"; correctedType = "MOTH01"; }
  else if (isMktLocal) { taskField = "supportMkt"; correctedType = correctedType || "supportMkt"; }
  else { taskField = TASK_COLUMNS[effectiveType] || "adminHours"; }

  // CHARGE TO CENTER MKT
  let chargeToCenterMkt = "";
  if (isMktLocal) {
    // For MKT Local files, the raw "Center" column (rCen) actually contains the Charge To Center MKT raw values (e.g., Van Quan, An Hung)
    // OR it could be in the explicit rawChargeToCenter column.
    let rawMktCharge = rawChargeToCenter || rCen;
    if (rawMktCharge.toUpperCase() === "MKT NORTH") rawMktCharge = "MKT";
    if (rawMktCharge.toUpperCase() === "MKT SOUTH") rawMktCharge = "MKT LOCAL SOUTH";

    let mappedMktCharge = getL07FromChargeToCenterMkt(rawMktCharge);
    if (!mappedMktCharge) {
      let normalL07 = getNormCenter(rawMktCharge, normCenterCache);
      const chargeCenterByAe = getCenterInfoByAECode(normalL07);
      if (chargeCenterByAe) {
        normalL07 = chargeCenterByAe.l07;
      }
      mappedMktCharge = normalL07;

      if (!getCenterInfoByL07(mappedMktCharge) && mappedMktCharge !== "MKT LOCAL SOUTH" && !mappedMktCharge.includes("MKT")) {
        mappedMktCharge = l07;
      }
    }
    chargeToCenterMkt = mappedMktCharge;
  } else {
    if (rawChargeToCenter) {
      const mappedMktCharge = getL07FromChargeToCenterMkt(rawChargeToCenter);
      if (mappedMktCharge) {
        chargeToCenterMkt = mappedMktCharge;
      } else {
        let normalizedCharge = rawChargeToCenter;
        if (normalizedCharge.toUpperCase() === "MKT NORTH")
          normalizedCharge = "MKT";
        if (normalizedCharge.toUpperCase() === "MKT SOUTH")
          normalizedCharge = "MKT LOCAL SOUTH";
        let chargeL07 = getNormCenter(normalizedCharge, normCenterCache);
        const chargeCenterByAe = getCenterInfoByAECode(chargeL07);
        if (chargeCenterByAe) {
          chargeL07 = chargeCenterByAe.l07;
        }
        chargeToCenterMkt = chargeL07;
      }
    }
  }

  // STAFF LOOKUP FALLBACK
  if ((!l07 || l07 === "UNKNOWN") && !isMktLocal) {
    const matchStaff = staffLookup.get(empId);
    if (matchStaff) {
      const staffRawCen = String(
        getVal(matchStaff, ["l07", "center"])
      ).trim();
      if (staffRawCen) {
        const sL07 = getNormCenter(staffRawCen, normCenterCache);
        const staffCenterAe =
          getCenterInfoByAECode(sL07) || getCenterInfoByL07(sL07);
        l07 = staffCenterAe ? staffCenterAe.l07 : sL07;
      }
    }
  }

  if (!l07) {
    l07 = "UNKNOWN";
  }

  const finalCenterInfo = getCenterInfoByL07(l07);
  if (finalCenterInfo) {
    aeCode = finalCenterInfo.aeCode;
  }

  // Override for MKT Local Mã AE
  if (
    l07 &&
    (l07 === "MKT LOCAL SOUTH" ||
      l07.startsWith("MKT LOCAL NORTH_") ||
      l07 === "MKT")
  ) {
    aeCode = getAeCodeFromL07(l07);
  }

  // Also optionally extract centerBusiness mapping if requested
  let centerBusiness = "";
  centerBusiness = getBusinessFromL07(l07);

  // Use already pre-resolved MKT fields
  if (isMktLocal) {
    l07 = grossPayMktL07 || mktResolved.l07 || l07;
    originalL07 = grossPayMktL07 || mktResolved.l07 || originalL07;
    isMktLocal = true;
    chargeToCenterMkt = mktResolved.chargeToCenterMkt || chargeToCenterMkt || rCen;
    aeCode = mktResolved.aeCode || aeCode;
    centerBusiness = mktResolved.business || centerBusiness;
  } else {
    centerBusiness = getBusinessFromL07(l07);
  }

  return {
    l07,
    originalL07,
    isMktLocal,
    mktRegion,
    chargeToCenterMkt,
    taskField,
    aeCode,
    centerBusiness,
    correctedType,
    correctedClass
  };
}
