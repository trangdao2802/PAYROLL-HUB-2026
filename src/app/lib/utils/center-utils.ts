/**
 * Center Mapping Utilities
 * Provides mappings and resolution functions for converting center names,
 * AE Codes, and raw strings into standardized L07 center codes and Business Units (BU).
 */

export interface CenterInfo {
  l07: string;
  aeCode: string;
  bus: string;
  keys: string[];
}

export const CENTER_DATA: CenterInfo[] = [
  { l07: "BN0001.LTT", aeCode: "Ngo Si Lien", bus: "AHN", keys: ["BN0001.LTT", "BN0001", "NGO SI LIEN", "NSL", "BN01", "BN1", "LY THAI TO", "LÝ THÁI TỔ", "BN1.NSL"] },
  { l07: "BN0002.TSN", aeCode: "Tu Son", bus: "AHN", keys: ["BN0002.TSN", "BN0002", "TU SON", "TUS", "TSN", "BN02", "BN2", "BN2.TUS"] },
  { l07: "HN0001.PHY", aeCode: "Pho Hue Junior", bus: "AHN", keys: ["HN0001.PHY", "HN0001", "PHO HUE", "PHO HUE JUNIOR", "PHỐ HUẾ", "HN1.PH", "PHY", "PH", "HN01", "HN1"] },
  { l07: "HN0002.THA", aeCode: "Thai Ha (center Láng Hạ)", bus: "AHN", keys: ["HN0002.THA", "HN0002", "THAI HA", "THÁI HÀ", "THAI HA CENTER LANG HA", "THAI HA (CENTER LÁNG HẠ)", "LANG HA", "LÁNG HẠ", "TH", "THA", "HN02", "HN2", "HN2.TH"] },
  { l07: "HN0003.HQV", aeCode: "Hoang Quoc Viet", bus: "AHN", keys: ["HN0003.HQV", "HN0003", "HOANG QUOC VIET", "HOÀNG QUỐC VIỆT", "HQV", "HN03", "HN3", "HN3.HQV"] },
  { l07: "HN0004.LGI", aeCode: "Lieu Giai", bus: "AHN", keys: ["HN0004.LGI", "HN0004", "LIEU GIAI", "LIỄU GIAI", "LGI", "LG", "HN04", "HN4", "HN4.LG"] },
  { l07: "HN0005.NVL", aeCode: "Nguyen Van Linh", bus: "AHN", keys: ["HN0005.NVL", "HN0005", "NGUYEN VAN LINH", "NGUYỄN VĂN LINH", "NVL", "HN05", "HN5", "HN5.NVL"] },
  { l07: "HN0007.VQN", aeCode: "Van Quan", bus: "AHN", keys: ["HN0007.VQN", "HN0007", "VAN QUAN", "VĂN QUÁN", "VQ", "VQN", "HN07", "HN7", "HN7.VQ"] },
  { l07: "HN0010.MDH", aeCode: "My Dinh", bus: "AHN", keys: ["HN0010.MDH", "HN0010", "MY DINH", "MỸ ĐÌNH", "THE GARDEN", "MD", "MDH", "HN10", "HN10.TG"] },
  { l07: "HN0012.NHT", aeCode: "Nguyen Huu Tho", bus: "AHN", keys: ["HN0012.NHT", "HN0012", "NGUYEN HUU THO", "NGUYỄN HỮU THỌ", "HOANG MAI", "HOÀNG MAI", "NHT", "HM", "HN12", "HN12.NHT"] },
  { l07: "HN0014.TMI", aeCode: "Tan Mai", bus: "AHN", keys: ["HN0014.TMI", "HN0014", "TAN MAI", "TÂN MAI", "TMI", "TM", "HN14", "HN14.TM"] },
  { l07: "HN0015.VPU", aeCode: "Van Phu", bus: "AHN", keys: ["HN0015.VPU", "HN0015", "VAN PHU", "VĂN PHÚ", "VPU", "VP", "HN15", "HN15.VP"] },
  { l07: "HN0016.PDP", aeCode: "Phan Dinh Phung", bus: "AHN", keys: ["HN0016.PDP", "HN0016", "PHAN DINH PHUNG", "PHAN ĐÌNH PHÙNG", "PDP", "HN16", "HN16.PDP"] },
  { l07: "HN0017.HNI", aeCode: "Ham Nghi", bus: "AHN", keys: ["HN0017.HNI", "HN0017", "HAM NGHI", "HÀM NGHI", "HNI", "HN17", "HN17.HNI"] },
  { l07: "HN0018.VTP", aeCode: "Vu Tong Phan", bus: "AHN", keys: ["HN0018.VTP", "HN0018", "VU TONG PHAN", "VŨ TÔNG PHAN", "VTP", "HN18", "HN18.VTP"] },
  { l07: "HN0019.NTN", aeCode: "Nguyen Tuan", bus: "AHN", keys: ["HN0019.NTN", "HN0019", "NGUYEN TUAN", "NGUYỄN TUÂN", "NTN", "NT", "HN19", "HN19.NT"] },
  { l07: "HN0021.NGD", aeCode: "Ngoai Giao Doan", bus: "AHN", keys: ["HN0021.NGD", "HN0021", "NGOAI GIAO DOAN", "NGOẠI GIAO ĐOÀN", "NGD", "HN21", "HN21.NGD"] },
  { l07: "HN0022.NVO", aeCode: "Nguyen Van Loc", bus: "AHN", keys: ["HN0022.NVO", "HN0022", "NGUYEN VAN LOC", "NGUYỄN VĂN LỘC", "MO LAO", "MỖ LAO", "NVO", "HN22", "HN22.NVO"] },
  { l07: "HN0023.LDM", aeCode: "Linh Dam", bus: "AHN", keys: ["HN0023.LDM", "HN0023", "LINH DAM", "LINH ĐÀM", "LDM", "LD", "HN23", "HN23.LD"] },
  { l07: "HN0024.TCY", aeCode: "TIMES CITY", bus: "AHN", keys: ["HN0024.TCY", "HN0024", "TIMES CITY", "TCY", "TC", "HN24", "HN24.TC"] },
  { l07: "HN0025.LTT", aeCode: "Le Trong Tan", bus: "AHN", keys: ["HN0025.LTT", "HN0025", "LE TRONG TAN", "LÊ TRỌNG TẤN", "LTT", "HN25", "HN25.LTT"] },
  { l07: "HN0026.VHG", aeCode: "Viet Hung", bus: "AHN", keys: ["HN0026.VHG", "HN0026", "VIET HUNG", "VIỆT HƯNG", "VHG", "VH", "HN26", "HN26.VHG"] },
  { l07: "HN0027.OPK", aeCode: "Ocepark", bus: "AHN", keys: ["HN0027.OPK", "HN0027", "OCEAN PARK", "OCEPARK", "OPK", "OCP", "OP", "HN27", "HN27.OP"] },
  { l07: "HN0028.PVD", aeCode: "Pham Van Dong", bus: "AHN", keys: ["HN0028.PVD", "HN0028", "PHAM VAN DONG", "PHẠM VĂN ĐỒNG", "PVD", "HN28", "HN28.PVD"] },
  { l07: "HN0029.VPH", aeCode: "Vu Pham Ham", bus: "AHN", keys: ["HN0029.VPH", "HN0029", "VU PHAM HAM", "VŨ PHẠM HÀM", "VPH", "HN29", "HN29.VPH"] },
  { l07: "HN0030.AKH", aeCode: "An Khanh", bus: "AHN", keys: ["HN0030.AKH", "HN0030", "AN KHANH", "AN KHÁNH", "AKH", "AK", "HN30", "HN30.AKH"] },
  { l07: "HN0031.AHG", aeCode: "An Hung", bus: "AHN", keys: ["HN0031.AHG", "HN0031", "AN HUNG", "AN HƯNG", "AHG", "AH", "HN31", "HN31.AHG"] },
  { l07: "HN0032.LLQ", aeCode: "Xuan Dieu (đổi thành Lạc Long Quân)", bus: "AHN", keys: ["HN0032.LLQ", "HN0032", "LAC LONG QUAN", "LẠC LONG QUÂN", "XUAN DIEU", "XUÂN DIỆU", "LLQ", "HN32", "HN32.LLQ"] },
  { l07: "HN0033.DAH", aeCode: "HN33.DAH", bus: "AHN", keys: ["HN0033.DAH", "HN0033", "DONG ANH", "ĐÔNG ANH", "DAH", "DA", "HN33", "HN33.DAH"] },
  { l07: "HN0034.HTN", aeCode: "HN34.HTN", bus: "AHN", keys: ["HN0034.HTN", "HN0034", "HONG TIEN", "HỒNG TIẾN", "HTN", "HN34", "HN34.HTN"] },
  { l07: "HY0001.ECP", aeCode: "Ecopark", bus: "AHN", keys: ["HY0001.ECP", "HY0001", "ECOPARK", "ECP", "HY01", "HY01.ECP"] },
  { l07: "HP0001.LHP", aeCode: "Hai Phong 1", bus: "AHP", keys: ["HP0001.LHP", "HP0001", "HAI PHONG 1", "HẢI PHÒNG 1", "LHP", "HP1", "HP01", "HP1.LHP"] },
  { l07: "HP0002.HBT", aeCode: "Hai Phong 2", bus: "AHP", keys: ["HP0002.HBT", "HP0002", "HAI PHONG 2", "HẢI PHÒNG 2", "HBT", "HP2", "HP02", "HP2.HBT"] },
  { l07: "HP0003.VIN", aeCode: "Hai Phong 3", bus: "AHP", keys: ["HP0003.VIN", "HP0003", "HAI PHONG 3", "HẢI PHÒNG 3", "HP3", "HP03", "HP3.VIN"] },
  { l07: "QN0001.HLG", aeCode: "Quang Ninh", bus: "AHN", keys: ["QN0001.HLG", "QN0001", "QUANG NINH", "QUẢNG NINH", "HA LONG", "HẠ LONG", "HLG", "QN", "HL", "QN01", "QN1", "QN01.HL"] },
  { l07: "VIN001.CTG", aeCode: "Vinh", bus: "AHN", keys: ["VIN001.CTG", "VIN001", "VINH", "CTG", "VIN", "VIN01", "VIN1", "VIN01.CTG", "VIN01.CT"] },
  { l07: "VP0001.PCT", aeCode: "Vinh Phuc", bus: "AHN", keys: ["VP0001.PCT", "VP0001", "VINH PHUC", "VĨNH PHÚC", "PCT", "VP01", "VP1", "VP01.PCT"] },
  { l07: "TH0001.TPU", aeCode: "TH01.TPU", bus: "ATH", keys: ["TH0001.TPU", "TH0001", "TPU", "TH01", "TH01.TPU"] },
  { l07: "TN0001.LNQ", aeCode: "TN01.LNQ", bus: "ATN", keys: ["TN0001.LNQ", "TN0001", "LNQ", "TN01", "TN01.LNQ"] },
  { l07: "PT0001.HVG", aeCode: "PT01.HVG", bus: "APT", keys: ["PT0001.HVG", "PT0001", "HVG", "PT01", "PT01.HVG"] },
  { l07: "AA", aeCode: "Apollo Advance -South", bus: "AHN", keys: ["AA", "APOLLO ADVANCE -SOUTH", "APOLLO ADVANCE SOUTH"] },
  { l07: "AA_HP", aeCode: "Apollo Advance -South_HP", bus: "AHP", keys: ["AA_HP", "APOLLO ADVANCE -SOUTH_HP"] },
  { l07: "HN0200.ASP", aeCode: "ASP - HN", bus: "AHN", keys: ["HN0200.ASP", "HN0200", "ASP - HN", "ASP", "HN0.ASP"] },
  { l07: "MKT LOCAL NORTH", aeCode: "MKT LOCAL NORTH", bus: "AHN", keys: ["MKT LOCAL NORTH", "NTW", "NORTH.MKT INTERN", "MKT NORTH", "NORTH MKT", "NORTH","MKT HN","MKT HY","MKT BN", "MKT NA", "MKT VP","MKT QN"] },
  { l07: "ZHN0000.GY", aeCode: "Cambridge", bus: "AHN", keys: ["ZHN0000.GY", "CAMBRIDGE", "CONTEST"] },
  { l07:  "MKT LOCAL NORTH_HP", aeCode: "MKT HP", bus: "AHP", keys: ["MKT HP"] },
  { l07:  "MKT LOCAL NORTH_TN", aeCode: "MKT TN01.LNQ", bus: "ATN", keys: ["MKT TN01.LNQ","MKT TN1.LNQ"]},
  { l07:  "MKT LOCAL NORTH_TH", aeCode: "MKT TH01.TPU", bus: "ATH", keys: ["MKT TH01.TPU","MKT TH1.TPU"]},
  { l07:  "MKT LOCAL NORTH_PT", aeCode: "MKT PT01.HVG", bus: "APT", keys: ["MKT PT01.HVG","MKT PT1.HVG"]},

];

export const CENTER_MAPPING: Record<string, { l07: string; aeCode: string; bus: string }> = {};

function normalizeCenterKey(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function tokenizeFileName(fileName: string): string[] {
  return String(fileName || "")
    .replace(/\.(xlsx?|xls|csv|gsheet|txt)$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Resolve a center from a Timesheet filename without ever treating an
 * unknown filename as an L07. Besides full center names/codes, this supports
 * the compact folder convention used by TA Roster files, for example
 * `HN-NVL-TA Roster` and `HN-TH-TA Roster`.
 */
export function getCenterInfoFromFileName(fileName: string): CenterInfo | null {
  if (!fileName) return null;

  const tokens = tokenizeFileName(fileName);
  if (tokens.length === 0) return null;
  const tokenSet = new Set(tokens);
  const compactName = tokens.join("");
  let bestMatch: { info: CenterInfo; score: number } | null = null;
  let hasTie = false;

  for (const info of CENTER_DATA) {
    let score = 0;
    const compactL07 = normalizeCenterKey(info.l07);
    if (compactL07 && compactName.includes(compactL07)) {
      score = 2000 + compactL07.length;
    }

    const codeMatch = info.l07.toUpperCase().match(/^([A-Z]+)0*(\d+)(?:\.([A-Z0-9]+))?$/);
    const regionTokens = new Set<string>();
    if (codeMatch) {
      const [, region, sequence, suffix] = codeMatch;
      const sequenceNumber = String(Number(sequence));
      regionTokens.add(region);
      regionTokens.add(`${region}${sequenceNumber}`);
      regionTokens.add(`${region}${sequenceNumber.padStart(2, "0")}`);
      regionTokens.add(`${region}${sequence}`);

      const hasRegion = Array.from(regionTokens).some((token) => tokenSet.has(token));
      if (suffix && tokenSet.has(suffix) && hasRegion) {
        score = Math.max(score, 1500 + suffix.length);
      }
    }

    const hasRegion = Array.from(regionTokens).some((token) => tokenSet.has(token));
    const aliases = [info.aeCode, ...info.keys];
    aliases.forEach((alias) => {
      const normalizedAlias = normalizeCenterKey(alias);
      if (!normalizedAlias) return;

      if (normalizedAlias.length >= 4 && compactName.includes(normalizedAlias)) {
        score = Math.max(score, 900 + normalizedAlias.length);
        return;
      }

      // Short aliases such as TH, PH or VP are only safe when the filename
      // also carries the center region (HN-TH, HN-PH, HN-VP, ...).
      if (
        normalizedAlias.length >= 2 &&
        normalizedAlias.length <= 3 &&
        tokenSet.has(normalizedAlias) &&
        (hasRegion ||
          compactName === normalizedAlias ||
          (info.l07 === "AA" && normalizedAlias === "AA"))
      ) {
        score = Math.max(score, 700 + normalizedAlias.length);
      }
    });

    if (score <= 0) continue;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { info, score };
      hasTie = false;
    } else if (score === bestMatch.score && bestMatch.info.l07 !== info.l07) {
      hasTie = true;
    }
  }

  return bestMatch && !hasTie ? bestMatch.info : null;
}

const LOOKUP_MAP = new Map<string, CenterInfo>();

CENTER_DATA.forEach((info) => {
  const normL07 = normalizeCenterKey(info.l07);
  if (normL07) LOOKUP_MAP.set(normL07, info);

  const normAE = normalizeCenterKey(info.aeCode);
  if (normAE) LOOKUP_MAP.set(normAE, info);

  info.keys.forEach((k) => {
    const normK = normalizeCenterKey(k);
    if (normK) LOOKUP_MAP.set(normK, info);
  });

  CENTER_MAPPING[info.l07] = { l07: info.l07, aeCode: info.aeCode, bus: info.bus };
});

export function mapL07(l07OrAeCode: string): string {
  if (!l07OrAeCode) return "";
  const cleaned = String(l07OrAeCode).trim();
  const norm = normalizeCenterKey(cleaned);
  if (!norm) return cleaned;

  const found = LOOKUP_MAP.get(norm);
  if (found) return found.l07;

  // Substring/pattern matching fallbacks
  if (norm.includes("THAIHA") || norm.includes("LANGHA")) return "HN0002.THA";
  if (norm.includes("PHOHUE")) return "HN0001.PHY";
  if (norm.includes("HOANGQUOCVIET")) return "HN0003.HQV";
  if (norm.includes("LIEUGIAI")) return "HN0004.LGI";
  if (norm.includes("NGUYENVANLINH")) return "HN0005.NVL";
  if (norm.includes("VANQUAN")) return "HN0007.VQN";
  if (norm.includes("MYDINH") || norm.includes("THEGARDEN")) return "HN0010.MDH";
  if (norm.includes("NGUYENHUUTHO") || norm.includes("HOANGMAI")) return "HN0012.NHT";
  if (norm.includes("TANMAI")) return "HN0014.TMI";
  if (norm.includes("VANPHU")) return "HN0015.VPU";
  if (norm.includes("PHANDINHPHUNG")) return "HN0016.PDP";
  if (norm.includes("HAMNGHI")) return "HN0017.HNI";
  if (norm.includes("VUTONGPHAN")) return "HN0018.VTP";
  if (norm.includes("NGUYENTUAN")) return "HN0019.NTN";
  if (norm.includes("NGOAIGIAODOAN")) return "HN0021.NGD";
  if (norm.includes("NGUYENVANLOC") || norm.includes("MOLAO")) return "HN0022.NVO";
  if (norm.includes("LINHDAM")) return "HN0023.LDM";
  if (norm.includes("TIMESCITY")) return "HN0024.TCY";
  if (norm.includes("LETRONGTAN")) return "HN0025.LTT";
  if (norm.includes("VIETHUNG")) return "HN0026.VHG";
  if (norm.includes("OCEANPARK") || norm.includes("OCEPARK")) return "HN0027.OPK";
  if (norm.includes("PHAMVANDONG")) return "HN0028.PVD";
  if (norm.includes("VUPHAMHAM")) return "HN0029.VPH";
  if (norm.includes("ANKHANH")) return "HN0030.AKH";
  if (norm.includes("ANHUNG")) return "HN0031.AHG";
  if (norm.includes("LACLONGQUAN") || norm.includes("XUANDIEU")) return "HN0032.LLQ";
  if (norm.includes("DONGANH")) return "HN0033.DAH";
  if (norm.includes("HONGTIEN")) return "HN0034.HTN";
  if (norm.includes("NGOSILIEN") || norm.includes("LYTHAITO")) return "BN0001.LTT";
  if (norm.includes("TUSON")) return "BN0002.TSN";
  if (norm.includes("ECOPARK")) return "HY0001.ECP";
  if (norm.includes("QUANGNINH") || norm.includes("HALONG")) return "QN0001.HLG";
  if (norm.includes("THANHHOA")) return "TH0001.TPU";
  if (norm.includes("THAINGUYEN")) return "TN0001.LNQ";
  if (norm.includes("PHUTHO")) return "PT0001.HVG";
  if (norm.includes("VINHPHUC")) return "VP0001.PCT";
  if (norm === "VINH" || norm.includes("VINHCTG")) return "VIN001.CTG";
  if (norm.includes("MKTLOCALNORTH") || norm.includes("NORTHMKT") || norm.includes("MKTLOCAL")) return "MKT LOCAL NORTH";

  return cleaned;
}

export function getCenterInfoByAECode(aeCode: string): { l07: string; aeCode: string; bus: string } | null {
  if (!aeCode) return null;
  const cleaned = String(aeCode).trim();
  const norm = normalizeCenterKey(cleaned);
  let found = LOOKUP_MAP.get(norm);

  if (!found) {
    const mapped = mapL07(cleaned);
    if (mapped) {
      found = LOOKUP_MAP.get(normalizeCenterKey(mapped));
    }
  }

  if (found) {
    return { l07: found.l07, aeCode: found.aeCode, bus: found.bus };
  }

  return { l07: cleaned, aeCode: cleaned, bus: getBusinessFromL07(cleaned) };
}

export function getCenterInfoByL07(l07: string): { l07: string; aeCode: string; bus: string } | null {
  if (!l07) return null;
  const cleaned = String(l07).trim();
  const norm = normalizeCenterKey(cleaned);
  const found = LOOKUP_MAP.get(norm);

  if (found) {
    return { l07: found.l07, aeCode: found.aeCode, bus: found.bus };
  }

  return null;
}

export function resolveL07BuFromAeCode(code: string): { l07: string; bu: string } | null {
  if (!code) return null;
  const info = getCenterInfoByAECode(code);
  if (info) {
    return { l07: info.l07, bu: info.bus };
  }
  return { l07: code, bu: getBusinessFromL07(code) };
}

export function getBusinessFromL07(l07: string): string {
  if (!l07) return "AHN";
  const rawUpper = String(l07).trim().toUpperCase();
  const rawSpecial = rawUpper.replace(/[\s-]+/g, "_");

  if (rawSpecial === "MKT_LOCAL_NORTH_HP" || rawSpecial === "HAI_PHONG") return "AHP";
  if (rawSpecial === "MKT_LOCAL_NORTH_TH") return "ATH";
  if (rawSpecial === "MKT_LOCAL_NORTH_PT") return "APT";
  if (rawSpecial === "MKT_LOCAL_NORTH_TN") return "ATN";
  if (["NTW", "CAMBRIDGE", "CONTEST", "JOB_FAIR", "MKT_LOCAL_NORTH"].includes(rawSpecial)) return "AHN";

  const mapped = mapL07(l07);
  const info = getCenterInfoByL07(mapped);
  if (info?.bus) return info.bus;

  const upper = String(mapped || l07).trim().toUpperCase();
  const special = upper.replace(/[\s-]+/g, "_");

  // Regional MKT aliases must be checked before the generic North bucket.
  if (special === "MKT_LOCAL_NORTH_HP" || special === "HAI_PHONG") return "AHP";
  if (special === "MKT_LOCAL_NORTH_TH") return "ATH";
  if (special === "MKT_LOCAL_NORTH_PT") return "APT";
  if (special === "MKT_LOCAL_NORTH_TN") return "ATN";
  if (["NTW", "CAMBRIDGE", "CONTEST", "JOB_FAIR", "MKT_LOCAL_NORTH"].includes(special)) return "AHN";

  // Standard L07 codes are identified only by their leading region code.
  // Never inspect suffixes such as HN0002.THA or HN0019.NTN.
  const prefix = upper.slice(0, 2);
  if (prefix === "HP") return "AHP";
  if (prefix === "TH") return "ATH";
  if (prefix === "PT") return "APT";
  if (prefix === "TN") return "ATN";
  if (["HN", "BN", "HY", "VP", "VI", "QN", "AA"].includes(prefix)) return "AHN";

  return "AHN";
}

export function resolveMktAndCenterL07(
  rawCenter: string,
  rawChargeToCenter = "",
  sheetSource = "",
  currentL07 = ""
): { isMktLocal: boolean; l07: string; business: string } {
  const combined = `${rawCenter} ${rawChargeToCenter} ${sheetSource} ${currentL07}`.toUpperCase();
  const isMktLocal = combined.includes("MKT") || combined.includes("MARKETING");

  let targetString = rawCenter || rawChargeToCenter || currentL07;
  if (isMktLocal && (!targetString || targetString.toUpperCase().includes("MKT"))) {
    // Attempt to retain the specific MKT suffix before forcing "MKT LOCAL NORTH"
    const resolvedNorthMkt = resolveNorthMktLocalL07(targetString);
    if (resolvedNorthMkt) {
      targetString = resolvedNorthMkt;
    } else {
      targetString = "MKT LOCAL NORTH";
    }
  }

  const l07 = mapL07(targetString) || targetString;
  const info = getCenterInfoByL07(l07) || getCenterInfoByAECode(targetString);
  const business = info?.bus || getBusinessFromL07(l07) || "AHN";

  return {
    isMktLocal,
    l07,
    business,
  };
}

export function getL07FromFileName(fileName: string): string {
  if (!fileName) return "";
  const name = fileName.toUpperCase();
  const fileTokens = new Set(tokenizeFileName(fileName));

  // Explicit Timesheet filename rules supplied by payroll. These aliases are
  // intentionally limited to complete filename tokens so short codes such as
  // HL cannot accidentally match an unrelated word.
  if (fileTokens.has("NSL")) return "BN0001.LTT";
  if (fileTokens.has("TUS")) return "BN0002.TSN";
  if (fileTokens.has("HL")) return "QN0001.HLG";
  if (fileTokens.has("ECP")) return "HY0001.ECP";
  if (name.includes("NORTH.MKT ROSTER") || name.includes("NORTH MKT ROSTER")) {
    return "MKT LOCAL NORTH";
  }
  if (name.includes("MKT")) {
    const resolvedNorthMkt = resolveNorthMktLocalL07(name);
    return resolvedNorthMkt || "MKT LOCAL NORTH";
  }
  return getCenterInfoFromFileName(fileName)?.l07 || "";
}

export function getL07FromChargeToCenterMkt(chargeToCenter: string): string {
  if (!chargeToCenter) return "";
  const cleaned = String(chargeToCenter).trim();
  const upper = cleaned.toUpperCase();
  if (upper.includes("MKT LOCAL NORTH_HP") || upper.includes("MKT HP")) return "MKT LOCAL NORTH_HP";
  if (upper.includes("MKT LOCAL NORTH_TN") || upper.includes("MKT TN")) return "MKT LOCAL NORTH_TN";
  if (upper.includes("MKT LOCAL NORTH_PT") || upper.includes("MKT PT")) return "MKT LOCAL NORTH_PT";
  if (upper.includes("MKT LOCAL NORTH_TH") || upper.includes("MKT TH")) return "MKT LOCAL NORTH_TH";
  if (upper.includes("MKT SOUTH") || upper.includes("MKT LOCAL SOUTH")) return "MKT LOCAL SOUTH";
  if (upper.includes("MKT")) return "MKT LOCAL NORTH";
  return mapL07(cleaned);
}

export function getAeCodeFromL07(l07: string): string {
  if (!l07) return "";
  const info = getCenterInfoByL07(l07);
  if (info?.aeCode) return info.aeCode;
  return l07;
}

export function extractCenterNameFromFileName(fileName: string): string {
  if (!fileName) return "";
  const l07 = getL07FromFileName(fileName);
  const info = getCenterInfoByL07(l07);
  return info ? info.aeCode : l07;
}
export const NORTH_MKT_LOCAL_L07_CODES = [
  "MKT LOCAL NORTH",
  "MKT LOCAL NORTH_HP",
  "MKT LOCAL NORTH_TH",
  "MKT LOCAL NORTH_TN",
  "MKT LOCAL NORTH_PT",
] as const;

/**
 * Resolve the MKT Center values used by Sheet 1 / Gross Pay. This mapping is
 * deliberately opt-in and is not called by Pivot Master processing.
 */
export function resolveNorthMktLocalL07(rawCenter: string): string {
  const normalized = normalizeCenterKey(rawCenter);
  if (!normalized.includes("MKT")) return "";

  if (
    normalized.includes("MKTLOCALNORTHHP") ||
    normalized.includes("MKTHAIPHONG") ||
    normalized.includes("MKTHP") ||
    normalized.includes("HAIPHONG")
  ) {
    return "MKT LOCAL NORTH_HP";
  }

  // Check Thai Nguyen before the generic MKT TH prefix.
  if (
    normalized.includes("MKTLOCALNORTHTN") ||
    normalized.includes("MKTTHAINGUYEN") ||
    normalized.includes("MKTTN") ||
    normalized.includes("THAINGUYEN")
  ) {
    return "MKT LOCAL NORTH_TN";
  }

  if (
    normalized.includes("MKTLOCALNORTHTH") ||
    normalized.includes("MKTTHANHHOA") ||
    normalized.includes("MKTTH") ||
    normalized.includes("THANHHOA")
  ) {
    return "MKT LOCAL NORTH_TH";
  }

  if (
    normalized.includes("MKTLOCALNORTHPT") ||
    normalized.includes("MKTPHUTHO") ||
    normalized.includes("MKTPT") ||
    normalized.includes("PHUTHO")
  ) {
    return "MKT LOCAL NORTH_PT";
  }

  // MKT HN, BN, NA, HY, VIN, VINH, VP and other North MKT aliases.
  return "MKT LOCAL NORTH";
}

export function isNorthMktLocalL07(value: string): boolean {
  const upper = String(value || "").trim().toUpperCase();
  return (NORTH_MKT_LOCAL_L07_CODES as readonly string[]).includes(upper);
}

/** Resolve raw CHARGE TO CENTER from MKT Local Roster/Q_Roster to its real L07. */
export function resolveMktRosterCenter(rawChargeToCenter: string): {
  chargeToCenterMkt: string;
  l07: string;
  business: string;
} {
  const cleaned = String(rawChargeToCenter || "").trim();
  if (!cleaned) {
    return { chargeToCenterMkt: "", l07: "", business: "" };
  }

  const normalized = normalizeCenterKey(cleaned);

  // Preserve the two allocation destinations used by the reference ZIP.
  if (normalized === "NTW") {
    return { chargeToCenterMkt: "NTW", l07: "NTW", business: "AHN" };
  }
  if (normalized === "HAIPHONG") {
    return {
      chargeToCenterMkt: "Hai Phong",
      l07: "Hai Phong",
      business: "AHP",
    };
  }

  let l07 = "";
  if (normalized.includes("MKT") || normalized.includes("MARKETING")) {
    l07 = resolveNorthMktLocalL07(cleaned) || mapL07(cleaned) || cleaned;
  } else {
    l07 = mapL07(cleaned) || cleaned;
  }

  return {
    chargeToCenterMkt: l07,
    l07,
    business: getBusinessFromL07(l07),
  };
}
