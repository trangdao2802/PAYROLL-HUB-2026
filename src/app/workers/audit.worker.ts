/* eslint-disable */
/**
 * audit.worker.ts
 * Toan bo logic doi soat GV / TA chay tren worker thread.
 * Import helpers tu data-utils (Vite worker supports imports).
 */
import { parseAnyDate, getVal, parseTimeStrToHours } from "../lib/utils/data-utils";

const RAW_MAPPINGS = [
  { l07: "BN0001.LTT", keys: ["NSL", "Ngo Si Lien", "BN01", "Ly Thai To", "Lý Thái Tổ", "BN1", "BN1.NSL"] },
  { l07: "BN0002.TSN", keys: ["TUS", "TSN", "Tu Son", "BN02", "BN2", "BN2.TUS"] },
  { l07: "HN0001.PHY", keys: ["HN1.PH", "PHY", "PH", "Pho Hue", "Pho Hue Junior", "HN01", "HN1"] },
  { l07: "HN0002.THA", keys: ["TH", "THA", "Thai Ha", "HN02", "HN2", "HN2.TH"] },
  { l07: "HN0003.HQV", keys: ["HQV", "Hoang Quoc Viet", "HN03", "HN3", "HN3.HQV"] },
  { l07: "HN0004.LGI", keys: ["LGI", "LG", "Lieu Giai", "HN04", "HN4", "HN4.LG"] },
  { l07: "HN0005.NVL", keys: ["NVL", "Nguyen Van Linh", "HN05", "HN5", "HN5.NVL"] },
  { l07: "HN0007.VQN", keys: ["VQ", "VQN", "Van Quan", "HN07", "HN7", "HN7.VQ"] },
  { l07: "HN0010.MDH", keys: ["MD", "MDH", "My Dinh", "The Garden", "HN10", "HN10.TG"] },
  { l07: "HN0012.NHT", keys: ["NHT", "HM", "Hoang Mai", "Nguyen Huu Tho", "Nguyễn Hữu Thọ", "HN12", "HN12.NHT"] },
  { l07: "HN0014.TMI", keys: ["TMI", "TM", "Tan Mai", "HN14", "HN14.TM"] },
  { l07: "HN0015.VPU", keys: ["VPU", "VP", "Van Phu", "HN15", "HN15.VP"] },
  { l07: "HN0016.PDP", keys: ["PDP", "Phan Dinh Phung", "HN16", "HN16.PDP"] },
  { l07: "HN0017.HNI", keys: ["HNI", "Ham Nghi", "HN17", "HN17.HNI"] },
  { l07: "HN0018.VTP", keys: ["VTP", "Vu Tong Phan", "HN18", "HN18.VTP"] },
  { l07: "HN0019.NTN", keys: ["NTN", "NT", "Nguyen Tuan", "HN19", "HN19.NT"] },
  { l07: "HN0021.NGD", keys: ["NGD", "Ngoai Giao Doan", "HN21", "HN21.NGD"] },
  { l07: "HN0022.NVO", keys: ["NVO", "Nguyen Van Loc", "Mo Lao", "Mỗ Lao", "HN22", "HN22.NVO"] },
  { l07: "HN0023.LDM", keys: ["LDM", "LD", "Linh Dam", "HN23", "HN23.LD"] },
  { l07: "HN0024.TCY", keys: ["TCY", "TC", "TIMES CITY", "HN24", "HN24.TC"] },
  { l07: "HN0025.LTT", keys: ["LTT", "Le Trong Tan", "HN25", "HN25.LTT"] },
  { l07: "HN0026.VHG", keys: ["VHG", "VH", "Viet Hung", "HN26", "HN26.VHG"] },
  { l07: "HN0027.OPK", keys: ["OPK", "OCP", "OP", "Ocepark", "Ocean Park", "HN27", "HN27.OP"] },
  { l07: "HN0028.PVD", keys: ["PVD", "Pham Van Dong", "HN28", "HN28.PVD"] },
  { l07: "HN0029.VPH", keys: ["VPH", "Vu Pham Ham", "HN29", "HN29.VPH"] },
  { l07: "HN0030.AKH", keys: ["AKH", "AK", "An Khanh", "HN30", "HN30.AKH"] },
  { l07: "HN0031.AHG", keys: ["AHG", "AH", "An Hung", "HN31", "HN31.AHG"] },
  { l07: "HN0032.LLQ", keys: ["LLQ", "Lac Long Quan", "Xuan Dieu", "Xuan Dieu (đổi thành Lạc Long Quân)", "HN32", "HN32.LLQ"] },
  { l07: "HN0033.DAH", keys: ["DAH", "DA", "Dong Anh", "HN33.DAH", "HN33"] },
  { l07: "HN0034.HTN", keys: ["HTN", "Hong Tien", "HN34.HTN", "HN34"] },
  { l07: "HY0001.ECP", keys: ["ECP", "Ecopark", "HY01", "HY01.ECP"] },
  { l07: "HP0001.LHP", keys: ["LHP", "HP1", "HP01", "Hai Phong 1", "HP1.LHP"] },
  { l07: "HP0002.HBT", keys: ["HBT", "HP2", "HP02", "Hai Phong 2", "HP2.HBT"] },
  { l07: "HP0003.VIN", keys: ["HP3", "HP03", "Hai Phong 3", "HP3.VIN"] },
  { l07: "QN0001.HLG", keys: ["HLG", "QN", "HL", "Ha Long", "QN01", "Quang Ninh", "Quảng Ninh", "QN1", "QN01.HL"] },
  { l07: "VIN001.CTG", keys: ["CTG", "VIN", "Vinh", "VIN01", "VIN1", "VIN01.CTG", "VIN01.CT"] },
  { l07: "VP0001.PCT", keys: ["PCT", "VP01", "VP1", "Vinh Phuc", "VP0001", "VP01.PCT"] },
  { l07: "TH0001.TPU", keys: ["TPU", "TH01.TPU", "MKT TH01.TPU", "Thanh Hoa", "TH01"] },
  { l07: "TN0001.LNQ", keys: ["LNQ", "TN01.LNQ", "MKT TN01.LNQ", "Thai Nguyen", "TN01"] },
  { l07: "PT0001.HVG", keys: ["HVG", "PT01.HVG", "MKT PT01.HVG", "Phu Tho", "PT01"] },
  { l07: "AA", keys: ["AA", "Apollo Advance -South"] },
  { l07: "HN0200.ASP", keys: ["HN0.ASP", "ASP", "ASP - HN", "HN0200"] },
  { l07: "MKT LOCAL NORTH", keys: ["NORTH.MKT INTERN", "MKT LOCAL NORTH", "NTW", "MKT NORTH", "NORTH"] },
  { l07: "ZHN0000.GY", keys: ["CAMBRIDGE", "CONTEST", "ZHN0000.GY"] },
  { l07: "MKT HP", keys: ["MKT HP"] },
];

const VALID_CENTERS = new Set(RAW_MAPPINGS.map((m) => m.l07));
const PRE_MAPPINGS = (RAW_MAPPINGS as any[]).flatMap((m: any) =>
  (m.keys as string[]).map((k: string) => ({
    l07: m.l07 as string,
    key: k.toUpperCase(),
    regex: new RegExp(
      "(?:^|[^A-Z0-9a-z\\xC0-\\u1EF9])" + k.replace(/[.*+?^{}()|[\]\\]/g, "\\$&") + "(?:[^A-Z0-9a-z\\xC0-\\u1EF9]|$)",
      "i"
    ),
  }))
).sort((a: any, b: any) => b.key.length - a.key.length);

function norm(s: string): string { return String(s).replace(/\s+/g, "").toUpperCase(); }

function normClass(clsStr: string): string {
  const clean = String(clsStr).toUpperCase().trim();
  if (!clean || clean === "KHÔNG CÓ LỚP HỌC") return "KHÔNG CÓ LỚP HỌC";

  // Level: KDG1, KDG2, KDG3, KIN1, KIN2, KIN3, PRI1, PRI2, PRI3, PRI4, PRI5, PRI6 etc.
  const levelMatch = clean.match(/(KDG\s*\d+|KIN\s*\d+|PRI\s*\d+|KINDY\s*\d+|PRIMARY\s*\d+)/i);
  let level = "";
  if (levelMatch) {
    level = levelMatch[0].replace(/\s+/g, "");
    // Normalize KINx -> KDGx, KINDYx -> KDGx, PRIMARYx -> PRIx
    level = level.replace(/^KIN(\d+)/i, "KDG$1");
    level = level.replace(/^KINDY(\d+)/i, "KDG$1");
    level = level.replace(/^PRIMARY(\d+)/i, "PRI$1");
  }

  // 4-digit STT
  const sttMatch = clean.match(/\d{4}/);
  const stt = sttMatch ? sttMatch[0] : "";

  // 3-letter center prefix
  let centerPrefix = "";
  const first3LettersMatch = clean.match(/^[A-Z]{3}\b/);
  if (first3LettersMatch) {
    centerPrefix = first3LettersMatch[0];
  } else {
    // Fallback: search for any 3-letter uppercase word
    const parts = clean.split(/[^A-Z0-9]/).filter(Boolean);
    for (const part of parts) {
      if (part.length === 3 && /^[A-Z]{3}$/.test(part)) {
        centerPrefix = part;
        break;
      }
    }
  }

  if (centerPrefix && level && stt) {
    return `${centerPrefix}-${level}-${stt}`;
  }

  return norm(clsStr);
}

function resolveCenter(input: string, cmap: Record<string,string>): string {
  const n = String(input).trim().toUpperCase(); if (!n) return "";
  if ((VALID_CENTERS as Set<string>).has(n)) return n;
  if (cmap[n]) return cmap[n];
  for (const m of PRE_MAPPINGS) { if (m.key === n) return m.l07; }
  for (const m of PRE_MAPPINGS) { if (m.regex.test(input)) return m.l07; }
  return input;
}

function getL07FromFile(name: string): string {
  for (const m of PRE_MAPPINGS) { if (m.regex.test(name)) return m.l07; }
  return "";
}

function getAllowedTAs(cls: string, students: number): number {
  let c = cls.toLowerCase().replace(/\s+/g, "");
  c = c.replace(/kindy/g, "kdg").replace(/kin/g, "kdg");
  if (c.includes("kdg1") || c.includes("kdg2")) return students < 15 ? 2 : 3;
  if (c.includes("kdg3")) return students < 13 ? 1 : 2;
  if (c.includes("pristarter") || c.includes("primarystarter")) return 2;
  if (c.includes("pri1") || c.includes("primary1")) return students < 15 ? 1 : 2;
  if (c.includes("pri") || c.includes("primary")) return 1;
  if (c.includes("secstarter") || c.includes("secondarystarter")) return 1;
  return 0;
}

function getBU(l07: string): string {
  if (!l07) return "AHN";
  const u = l07.toUpperCase().trim();
  if (u.includes("TN") || u.startsWith("TN")) return "ATN";
  if (u.includes("HP") || u.startsWith("HP") || u.startsWith("TH") || u.includes("TH")) return "ATH";
  return "AHN";
}

export function runAuditComputation(params: any) {
  const { fileAData, rosterData, fromDate, toDate, checkTAsDataRaw, fileNameA, centerMappingParam, bonusData, bonusSheetName } = params;
  const cmap: Record<string,string> = centerMappingParam || {};
  const validCls = /(KDG\s*[1-3]|PRI\s*[1-6]|PRI\s*STARTER|PRIMARY\s*STARTER|SEC\s*(STARTER|FOUND))/i;
  const INVALID_TEACHERS = ["\u1ed1 v\u1ea5n", "no teacher", "tba", "to be assigned", "kh\u00f4ng c\u00f3"];

  let fDate: Date | null = null, tDate: Date | null = null;
  if (fromDate) { const p = fromDate.split("-"); if (p.length === 3) fDate = new Date(+p[0], +p[1]-1, +p[2], 0, 0, 0); }
  if (toDate)   { const p = toDate.split("-");   if (p.length === 3) tDate = new Date(+p[0], +p[1]-1, +p[2], 23, 59, 59, 999); }

  let fbMon: number|null = null, fbYr: number|null = null;
  if (fileNameA) {
    let m = fileNameA.match(/_(\d{2})(\d{2})(\d{4})_/); if (m) { fbMon = +m[2]-1; fbYr = +m[3]; }
    else { m = fileNameA.match(/(\d{4})(\d{2})(\d{2})/); if (m) { fbYr = +m[1]; fbMon = +m[2]-1; } }
  }

  let minB: number|null = null, maxB: number|null = null;
  rosterData.forEach((row: any) => { 
    const dv = getVal(row, ["date","ng\u00E0y","tk_date","session date"]); 
    const d = parseAnyDate(dv, fbYr || new Date().getFullYear()); 
    if (d && !isNaN(d.getTime())) { 
      const ts = d.getTime(); 
      if (minB === null || ts < minB) minB = ts; 
      if (maxB === null || ts > maxB) maxB = ts; 
    } 
  });

  if (fbYr === null && minB !== null && maxB !== null) {
    const minD = new Date(minB);
    const maxD = new Date(maxB);
    fbYr = maxD.getFullYear();
    fbMon = maxD.getMonth();
  }

  const prefYr = fbYr || (fDate ? fDate.getFullYear() : new Date().getFullYear());

  // --- Scan header of File A ---
  let hRow = -1, dRow = -1;
  for (let i = 0; i < Math.min(30, fileAData.length); i++) {
    const row = fileAData[i]; if (!row) continue;
    const arr: any[] = Array.isArray(row) ? row : Object.values(row);
    const rs = arr.map((c) => String(c).toLowerCase()).join(" ");
    if (rs.includes("schedule date")) {
      if (hRow === -1) {
        for (let k = Math.max(0, i-2); k <= i; k++) {
          const hr = fileAData[k]; if (!hr) continue;
          const hs = (Array.isArray(hr) ? hr : Object.values(hr) as any[]).map((c: any) => String(c).toLowerCase()).join(" ");
          if ((hs.includes("class") || hs.includes("l\u1EDBp")) && (hs.includes("teacher") || hs.includes("gv"))) { hRow = k; break; }
        }
      }
      dRow = i + 1; if (hRow === -1) hRow = i; break;
    }
    let sc = 0;
    if (rs.includes("class") || rs.includes("l\u1EDBp")) sc++;
    if (rs.includes("teacher") || rs.includes("gi\u00E1o vi\u00EAn") || rs.includes("gv")) sc++;
    if (rs.includes("type") || rs.includes("lo\u1EA1i")) sc++;
    if (rs.includes("total") || rs.includes("t\u1ED5ng")) sc++;
    if (sc >= 2) { hRow = i; if (dRow === -1) dRow = i; }
  }

  const colM: any = { teacher:-1, center:-1, className:-1, type:-1, total:-1, numStudents:-1, dates:[] };
  if (hRow !== -1) {
    const mH: any[] = Array.isArray(fileAData[hRow]) ? fileAData[hRow] : Object.values(fileAData[hRow]);
    const uDR: any[] = dRow !== -1 ? (Array.isArray(fileAData[dRow]) ? fileAData[dRow] : Object.values(fileAData[dRow])) : mH;
    const sH: any[] = Array.isArray(fileAData[hRow+1]) ? fileAData[hRow+1] : Object.values(fileAData[hRow+1] || []);
    [mH, sH].forEach((ha) => ha.forEach((h: any, idx: number) => {
      const hs = String(h).trim().toLowerCase().replace(/\s+/g, " ");
      if (hs.includes("teacher") || hs === "gi\u00E1o vi\u00EAn" || hs === "t\u00EAn gv") { if (colM.teacher === -1) colM.teacher = idx; }
      else if (hs.includes("center") || hs.includes("cơ sở") || hs.includes("location") || hs.includes("trung tâm") || hs.includes("mã ae") || hs === "ae" || hs.includes("ae code")) { if (colM.center === -1) colM.center = idx; }
      else if (hs.includes("class") || hs === "l\u1EDBp" || hs === "m\u00E3 l\u1EDBp") { if (colM.className === -1) colM.className = idx; }
      else if (hs.includes("type") || hs.includes("lo\u1EA1i")) { if (colM.type === -1) colM.type = idx; }
      else if (hs === "total" || hs === "grand total" || hs === "t\u1ED5ng" || hs === "quy ra s\u1ED1 gi\u1EDD l\u00E0m") { if (colM.total === -1) colM.total = idx; }
      else if (hs.includes("student") || hs.includes("size") || hs.includes("s\u0129 s\u1ED1") || hs.includes("s\u1EF9 s\u1ED1") || hs.includes("s\u1ED1 l\u01B0\u1EE3ng") || hs.includes("s\u1ED1 hv")) { if (colM.numStudents === -1) colM.numStudents = idx; }
    }));
    const nC = Math.max(mH.length, uDR.length, sH.length, 36);
    for (let idx = 0; idx < nC; idx++) {
      if ([colM.teacher, colM.center, colM.className, colM.type, colM.total, colM.numStudents].includes(idx)) continue;
      if (idx >= 5 && idx <= 35) {
        const targetRowIdx = dRow !== -1 ? dRow : 12;
        const edr: any[] = fileAData[targetRowIdx] ? (Array.isArray(fileAData[targetRowIdx]) ? fileAData[targetRowIdx] : Object.values(fileAData[targetRowIdx])) : [];
        const dv = edr[idx]; const pd = parseAnyDate(dv, prefYr);
        if (pd && !isNaN(pd.getTime())) { colM.dates.push({ index: idx, dateObj: pd, isDayNum: false, keyStr: String(dv) }); continue; }
      }
      let cv: any = uDR[idx];
      if (cv == null || String(cv).trim() === "") cv = sH[idx];
      if (cv == null || String(cv).trim() === "") cv = mH[idx];
      const cd = parseAnyDate(cv, prefYr); const cs = String(cv || "").trim();
      const isDN = /^0?([1-9]|[12]\d|3[01])$/.test(cs);
      if (cd || isDN) {
        let fd: Date | null = cd;
        if (!fd && isDN && cs) {
          const dn = parseInt(cs, 10);
          if (fDate) fd = dn >= 21 ? new Date(fDate.getFullYear(), fDate.getMonth(), dn) : (() => { const nm = new Date(fDate!); nm.setMonth(nm.getMonth()+1); return new Date(nm.getFullYear(), nm.getMonth(), dn); })();
          else if (fbMon !== null && fbYr !== null) { if (dn >= 21) { const m2 = fbMon-1; const y2 = m2 < 0 ? fbYr-1 : fbYr; fd = new Date(y2, m2 < 0 ? 11 : m2, dn); } else fd = new Date(fbYr, fbMon, dn); } else { const now = new Date(); const cYr = now.getFullYear(); const cMo = now.getMonth(); if (dn >= 21) { const m2 = cMo-1; const y2 = m2 < 0 ? cYr-1 : cYr; fd = new Date(y2, m2 < 0 ? 11 : m2, dn); } else fd = new Date(cYr, cMo, dn); }
        }
        if (fd && !isNaN(fd.getTime())) colM.dates.push({ index: idx, dateObj: fd, isDayNum: isDN, keyStr: cs });
      }
    }
  }

  let minA: number|null = null, maxA: number|null = null;
  colM.dates.forEach((di: any) => { if (di.dateObj) { const ts = di.dateObj.getTime(); if (minA === null || ts < minA) minA = ts; if (maxA === null || ts > maxA) maxA = ts; } });

  if (minA !== null && maxA !== null && minB !== null && maxB !== null) {
    const cMin = Math.max(minA, minB); const cMax = Math.min(maxA, maxB);
    if (!fDate) { fDate = new Date(cMin); fDate.setHours(0,0,0,0); }
    if (!tDate) { tDate = new Date(cMax); tDate.setHours(23,59,59,999); }
  }
  // --- Build checkTAsMap + classSizeMap ---
  const ctaMap: Record<string,number> = {};
  const csMap: Record<string,number> = {};
  let cfgHdr = -1, cfgDt = -1, cfgMatrix = false;
  for (let i = 0; i < Math.min(20, checkTAsDataRaw.length); i++) {
    const row = checkTAsDataRaw[i]; if (!row) continue;
    const arr: any[] = Array.isArray(row) ? row : Object.values(row);
    const rs = arr.map((c) => String(c).toLowerCase()).join(" ");
    if (rs.includes("schedule date") || rs.includes("ng\u00E0y d\u1EA1y") || rs.includes("l\u1ECBch d\u1EA1y")) { cfgMatrix = true; cfgDt = i+1; if (cfgHdr === -1) cfgHdr = i; break; }
    let sc2 = 0; if (rs.includes("class") || rs.includes("l\u1EDBp")) sc2++; if (rs.includes("student") || rs.includes("s\u0129 s\u1ED1") || rs.includes("s\u1EF9 s\u1ED1") || rs.includes("s\u1ED1 h\u1ECDc vi\u00EAn")) sc2++;
    if (sc2 >= 2) { cfgHdr = i; const pdr: any[] = Array.isArray(checkTAsDataRaw[i]) ? checkTAsDataRaw[i] : Object.values(checkTAsDataRaw[i]); const ds = pdr.filter((c) => parseAnyDate(c, prefYr)).length; if (ds >= 1) { cfgMatrix = true; cfgDt = i; } }
  }
  if (cfgHdr !== -1) {
    const mH2: any[] = Array.isArray(checkTAsDataRaw[cfgHdr]) ? checkTAsDataRaw[cfgHdr] : Object.values(checkTAsDataRaw[cfgHdr]);
    const sH2: any[] = Array.isArray(checkTAsDataRaw[cfgHdr+1]) ? checkTAsDataRaw[cfgHdr+1] : Object.values(checkTAsDataRaw[cfgHdr+1] || []);
    const dR2: any[] = cfgDt !== -1 ? (Array.isArray(checkTAsDataRaw[cfgDt]) ? checkTAsDataRaw[cfgDt] : Object.values(checkTAsDataRaw[cfgDt])) : mH2;
    const cm: any = { class:-1, center:-1, students:-1, sessionDate:-1, dates:[] };
    [mH2, sH2].forEach((h) => h.forEach((v: any, idx: number) => {
      const s = String(v).toLowerCase();
      if (s.includes("class") || s.includes("l\u1EDBp")) { if (cm.class === -1) cm.class = idx; }
      else if (s.includes("center") || s.includes("c\u01A1 s\u1EDF") || s.includes("trung t\u00E2m")) { if (cm.center === -1) cm.center = idx; }
      else if (s.includes("student") || s.includes("s\u0129 s\u1ED1") || s.includes("s\u1EF9 s\u1ED1") || s.includes("size")) { if (cm.students === -1) cm.students = idx; }
      else if (s.includes("session date") || s.includes("ng\u00E0y d\u1EA1y") || s.includes("ng\u00E0y h\u1ECDc")) { if (cm.sessionDate === -1) cm.sessionDate = idx; }
    }));
    if (cfgMatrix) {
      for (let idx = 0; idx < dR2.length; idx++) { if ([cm.class, cm.center].includes(idx)) continue; const dt = parseAnyDate(dR2[idx], prefYr); if (dt) cm.dates.push({ index: idx, date: dt }); }
      const ds2 = Math.max(cfgHdr, cfgDt)+1;
      for (let i = ds2; i < checkTAsDataRaw.length; i++) {
        const ra: any[] = Array.isArray(checkTAsDataRaw[i]) ? checkTAsDataRaw[i] : Object.values(checkTAsDataRaw[i]);
        const cls = String(ra[cm.class] || "").trim(); const ctr = resolveCenter(String(ra[cm.center] || ""), cmap); if (!cls) continue;
        cm.dates.forEach((di: any) => {
          const val = parseInt(String(ra[di.index] || "").replace(/[^0-9]/g,""), 10) || 0;
          if (val > 0) {
            const ds3 = String(di.date.getDate()).padStart(2,"0")+"/"+String(di.date.getMonth()+1).padStart(2,"0")+"/"+di.date.getFullYear();
            ctaMap[norm(ctr)+"_"+normClass(cls)+"_"+ds3] = val; ctaMap[normClass(cls)+"_"+ds3] = val;
            const ck = norm(ctr)+"_"+normClass(cls); if (!csMap[ck] || csMap[ck] < val) csMap[ck] = val; if (!csMap[normClass(cls)] || csMap[normClass(cls)] < val) csMap[normClass(cls)] = val;
          }
        });
      }
    } else {
      for (let i = cfgHdr+1; i < checkTAsDataRaw.length; i++) {
        const rr: any[] = Array.isArray(checkTAsDataRaw[i]) ? checkTAsDataRaw[i] : Object.values(checkTAsDataRaw[i]);
        const cls = String(rr[cm.class] || "").trim(); const ctr = resolveCenter(String(rr[cm.center] || ""), cmap);
        const numS = parseInt(String(rr[cm.students] || "").replace(/[^0-9]/g,""), 10) || 0;
        const sDt = parseAnyDate(rr[cm.sessionDate], prefYr); if (!cls) continue;
        const nCls = normClass(cls), nCtr = norm(ctr);
        if (numS > 0) {
          const ck = nCtr+"_"+nCls; if (!csMap[ck] || csMap[ck] < numS) csMap[ck] = numS; if (!csMap[nCls] || csMap[nCls] < numS) csMap[nCls] = numS;
          if (sDt) { const ds4 = String(sDt.getDate()).padStart(2,"0")+"/"+String(sDt.getMonth()+1).padStart(2,"0")+"/"+sDt.getFullYear(); ctaMap[nCtr+"_"+nCls+"_"+ds4] = numS; ctaMap[nCls+"_"+ds4] = numS; }
        }
      }
    }
  }
  // --- BUOC 1: Scan Roster (File B) ---
  const combined: Record<string,any> = {};
  const cenB = new Set<string>(), cenOnlyA = new Set<string>();

  rosterData.forEach((row: any) => {
    let cL07 = getL07FromFile(row._sourceFile || "");
    if (!cL07) {
      const cc = String(row.l07 || getVal(row, ["l07", "trung tâm (l07)", "cơ sở (l07)", "mã l07", "ma l07", "center code", "office code", "center", "cơ sở", "trung tâm", "trung tam", "chi nhánh", "mã trung tâm", "ma trung tam", "location", "site", "branch", "region", "vùng", "miền", "khu vực", "campus", "office", "area", "ma co so", "mã ae", "ma ae", "ae", "ae code", "ae_code", "ae name", "ae_name", "ae-code"]) || "");
      cL07 = resolveCenter(cc, cmap);
    }
    if (!(VALID_CENTERS as Set<string>).has(cL07)) return;
    cenB.add(cL07);
    let cls = String(getVal(row, ["class", "lớp", "class name", "mã lớp"]) || "").trim().toUpperCase();
    if (!cls) cls = "KHÔNG CÓ LỚP HỌC";
    if (cls !== "KHÔNG CÓ LỚP HỌC" && !validCls.test(normClass(cls))) return;
    const rawType = String(getVal(row, ["type", "code", "task code", "activity code", "task type", "tk_type", "loại công việc"]) || "").trim();
    const typeUpper = rawType.toUpperCase();
    const typeLower = rawType.toLowerCase();
    const isMktLocal = cL07 === "MKT LOCAL NORTH" || cL07 === "MKT LOCAL SOUTH" || cL07.startsWith("MKT LOCAL NORTH_") || cL07.startsWith("MKT LOCAL SOUTH_");
    const isAllowedType = isMktLocal || 
                          typeUpper === "IN-CLASS" || 
                          typeUpper === "IN-CLASS ATLS" || 
                          typeLower.includes("in-class") || 
                          typeLower.includes("sms") || 
                          typeLower.includes("tutoring") || 
                          typeLower.includes("tutorial") || 
                          typeLower.includes("club") || 
                          typeLower.includes("demo") || 
                          typeLower.includes("waiting class") || 
                          typeLower.includes("parent meeting") || 
                          typeLower.includes("report") ||
                          typeLower.includes("intern");
    if (!isAllowedType) return;
    const dv2 = getVal(row, ["date", "ngày", "tk_date", "session date", "sessiondate", "ngày học", "ngày tháng"]);
    let rDB: Date | null = parseAnyDate(dv2, prefYr); if (!rDB) return;
    if (fDate && rDB < fDate) return; if (tDate && rDB > tDate) return;
    const ds = String(rDB.getDate()).padStart(2, "0") + "/" + String(rDB.getMonth() + 1).padStart(2, "0") + "/" + rDB.getFullYear();
    const dd = getVal(row, ["quy ra số giờ làm", "số giờ quy đổi", "workingHours", "converted hours", "hours", "giờ làm"]);
    let dur = 0;
    if (dd !== undefined && dd !== "" && !isNaN(parseFloat(String(dd).replace(",", ".")))) { const pv = parseFloat(String(dd).replace(",", ".")); dur = pv > 0 && pv <= 1 && String(dd).length > 5 ? pv * 24 : pv; }
    else {
      const fv = getVal(row, ["from", "từ"]), tv2 = getVal(row, ["to", "đến"]);
      if (fv && tv2) {
        const hF = parseTimeStrToHours(fv), hT = parseTimeStrToHours(tv2);
        // parseTimeStrToHours already returns hours-of-day. Multiplying the
        // difference by 24 inflated 09:00-11:00 from 2h to 48h.
        dur = hT >= hF ? hT - hF : hT + 24 - hF;
      }
      else { const dr = getVal(row, ["duration", "tk_duration", "thời lượng"]); if (typeof dr === "number") dur = dr > 0 && dr <= 1 ? dr * 24 : dr; else if (typeof dr === "string") { const sv = dr.trim().replace(",", "."); if (sv.includes(":")) { const p = sv.split(":"); dur = (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60; } else { const p2 = parseFloat(sv); if (!isNaN(p2)) dur = p2 > 0 && p2 <= 1 && sv.length > 4 ? p2 * 24 : p2; } } }
    }
    if (dur <= 0) return;
    if (String(getVal(row, ["check", "status"]) || "").toUpperCase().includes("DUPLICATE")) return;
    let inv2 = false; Object.keys(row).forEach((k) => { if (k.toLowerCase().startsWith("check") && String(row[k]).toUpperCase().includes("FALSE")) inv2 = true; }); if (inv2) return;
    const rid = String(getVal(row, ["id", "id number", "teacher id", "emp id", "mã nv", "manv", "id nv", "mã nhân viên", "staff id", "tk_id", "staff code", "emp code"]) || "").trim();
    const fn = String(getVal(row, ["full name", "name", "tên"]) || "").trim();
    const rU = rid.toUpperCase(); if (rU.includes("ATLS") || rU.includes("ECP") || rU.includes("KDG") || rU.includes("PRI") || rU.includes("TOTAL") || rU.includes("TỔNG")) return;
    const key = norm(cL07) + "_" + normClass(cls);
    if (!combined[key]) {
      combined[key] = { 
        center: cL07, 
        bu: getBU(cL07),
        className: cls, 
        teacherHours: 0, 
        actualTA: 0, 
        expectedTA: 0, 
        numStudents: 0, 
        isKDG: /(KDG)/i.test(normClass(cls)), 
        taDetails: [], 
        teacherDetails: [], 
        dailyMap: {} 
      };
    }
    combined[key].actualTA += dur;
    combined[key].taDetails.push({ dateObj: rDB.getTime(), dateStr: ds, id: rid, name: fn, type: rawType, hours: dur, numStudents: 0 });
    if (!combined[key].dailyMap[ds]) combined[key].dailyMap[ds] = { ta: [], teacher: [] };
    combined[key].dailyMap[ds].ta.push({ id: rid, name: fn, hours: dur, numStudents: 0 });
  });
  // --- BUOC 2: Scan File A ---
  if (hRow !== -1) {
    const startR = Math.max(hRow, dRow)+1;
    for (let i = startR; i < fileAData.length; i++) {
      const rr = fileAData[i]; if (!rr) continue;
      const row: any[] = Array.isArray(rr) ? rr : Object.values(rr); if (row.length === 0) continue;
      const cA = String(row[colM.center] || ""); const mCA = resolveCenter(cA, cmap);
      if (!(VALID_CENTERS as Set<string>).has(mCA)) continue;
      if (!cenB.has(mCA)) { cenOnlyA.add(mCA); continue; }
      const tr2 = colM.type !== -1 ? String(row[colM.type] || "") : "normal"; const tp = tr2.toLowerCase().replace(/[\s-]/g,"");
      if (tp && !tp.includes("normal")) continue;
      let cn = String(row[colM.className] || "").trim().toUpperCase(); if (!cn) cn = "KH\u00D4NG C\u00D3 L\u1EACP H\u1ECCC";
      if (cn !== "KH\u00D4NG C\u00D3 L\u1EACP H\u1ECCC" && !validCls.test(normClass(cn))) continue;
      const tc = String(row[colM.teacher] || "").trim().toLowerCase();
      if (!tc || tc === "total" || tc === "grand total" || INVALID_TEACHERS.some((inv) => tc.includes(inv))) continue;
      let numSA = 0;
      if (colM.numStudents !== -1) { numSA = parseInt(String(row[colM.numStudents] || "").trim(), 10) || 0; if (numSA > 0) { const ck2 = norm(mCA)+"_"+normClass(cn); if (!csMap[ck2] || csMap[ck2] < numSA) csMap[ck2] = numSA; } }
      let calcH = 0; const details: any[] = [];
      colM.dates.forEach((di: any) => {
        const cv2 = row[di.index]; const cv3 = parseTimeStrToHours(cv2); if (isNaN(cv3) || cv3 <= 0) return;
        let cd: Date|null = di.dateObj; let inRange = true;
        if (di.isDayNum && !cd) {
          const dn = parseInt(di.keyStr, 10);
          if (fDate) cd = dn >= 21 ? new Date(fDate!.getFullYear(), fDate!.getMonth(), dn) : (() => { const nm = new Date(fDate!); nm.setMonth(nm.getMonth()+1); return new Date(nm.getFullYear(), nm.getMonth(), dn); })();
          else if (fbMon !== null && fbYr !== null) { if (dn >= 21) { const m2 = fbMon-1; const y2 = m2 < 0 ? fbYr-1 : fbYr; cd = new Date(y2, m2 < 0 ? 11 : m2, dn); } else cd = new Date(fbYr, fbMon, dn); } else { const now = new Date(); const cYr = now.getFullYear(); const cMo = now.getMonth(); if (dn >= 21) { const m2 = cMo-1; const y2 = m2 < 0 ? cYr-1 : cYr; cd = new Date(y2, m2 < 0 ? 11 : m2, dn); } else cd = new Date(cYr, cMo, dn); }
        }
        if (cd) {
          if (fDate && cd < fDate) inRange = false; if (tDate && cd > tDate) inRange = false;
        }
        if (inRange) {
          const dsf = cd ? String(cd.getDate()).padStart(2,"0")+"/"+String(cd.getMonth()+1).padStart(2,"0")+"/"+cd.getFullYear() : di.keyStr;
          const kNT = norm(mCA)+"_"+normClass(cn)+"_"+dsf; const kWT = kNT+"_"+norm(tc);
          let ns: number = numSA > 0 ? numSA : (ctaMap[kWT] || ctaMap[kNT] || csMap[norm(mCA)+"_"+normClass(cn)] || 0);
          const aTAs = getAllowedTAs(cn, ns || 0);
          calcH += cv3; details.push({ dateObj:cd?cd.getTime():0, dateStr:dsf, name:tc, hours:cv3, allowedTAs:aTAs, numStudents:ns||0 });
        }
      });
      if (colM.dates.length === 0 && !fDate && !tDate) { const tv3 = parseFloat(String(row[colM.total]||"").replace(",",".")); if (tv3 > 0) { calcH += tv3; details.push({ dateObj:0, dateStr:"T\u1ED5ng h\u1EE3p", name:tc, hours:tv3, allowedTAs:0, numStudents:0 }); } }
      if (calcH <= 0) continue;
      const key2 = norm(mCA)+"_"+normClass(cn);
      if (!combined[key2]) {
        combined[key2] = { 
          center: mCA, 
          bu: getBU(mCA),
          className: cn, 
          teacherHours: 0, 
          actualTA: 0, 
          expectedTA: 0, 
          numStudents: 0, 
          isKDG: /(KDG)/i.test(normClass(cn)), 
          taDetails: [], 
          teacherDetails: [], 
          dailyMap: {} 
        };
      }
      combined[key2].teacherHours += calcH;
      details.forEach((d: any) => {
        if (d.numStudents > combined[key2].numStudents) combined[key2].numStudents = d.numStudents;
        if (!combined[key2].dailyMap[d.dateStr]) combined[key2].dailyMap[d.dateStr] = { ta:[], teacher:[] };
        combined[key2].expectedTA += d.hours*d.allowedTAs;
        combined[key2].teacherDetails.push(d);
        combined[key2].dailyMap[d.dateStr].teacher.push({ name:d.name, hours:d.hours, allowedTAs:d.allowedTAs, numStudents:d.numStudents });
      });
    }
  }

  // --- BUOC 2.1: Scan Bonus Data ---
  if (bonusData && Array.isArray(bonusData)) {
    let bHdr = -1;
    for (let i = 0; i < Math.min(20, bonusData.length); i++) {
      const row = bonusData[i]; if (!row) continue;
      const arr: any[] = Array.isArray(row) ? row : Object.values(row);
      const rs = arr.map((c) => String(c).toLowerCase()).join(" ");
      if (rs.includes("center") || rs.includes("department") || rs.includes("full name")) { bHdr = i; break; }
    }
    if (bHdr !== -1) {
      const bH: any[] = Array.isArray(bonusData[bHdr]) ? bonusData[bHdr] : Object.values(bonusData[bHdr]);
      let bCenCol = -1, bNameCol = -1, bPaymentCol = 24; // Column Y is index 24 default
      bH.forEach((h, idx) => {
        const s = String(h).toLowerCase();
        if (s.includes("center") || s.includes("department")) { if (bCenCol === -1) bCenCol = idx; }
        else if (s.includes("full name") || s.includes("tên")) { if (bNameCol === -1) bNameCol = idx; }
        else if (s.includes("payment") || s.includes("thanh toán") || s.includes("thành tiền") || s.includes("số tiền") || s.includes("bonus")) { bPaymentCol = idx; }
      });
      for (let i = bHdr + 1; i < bonusData.length; i++) {
        const ra: any[] = Array.isArray(bonusData[i]) ? bonusData[i] : Object.values(bonusData[i]);
        if (!ra || ra.length === 0) continue;
        const bCen = String(ra[bCenCol] || "");
        const mCen = resolveCenter(bCen, cmap);
        if (!(VALID_CENTERS as Set<string>).has(mCen)) continue;
        const bName = String(ra[bNameCol] || "").trim().toLowerCase();
        if (!bName || INVALID_TEACHERS.some(inv => bName.includes(inv))) continue;
        
        let bRaw = String(ra[bPaymentCol] || "0").trim();
        // Robust number parsing: remove thousand separators, handle decimal comma/dot
        let bPayment = 0;
        if (bRaw) {
          let clean = bRaw.replace(/\s/g, "");
          const lastComma = clean.lastIndexOf(",");
          const lastDot = clean.lastIndexOf(".");
          if (lastComma > lastDot) {
            // VN style: 1.000.000,00 -> remove dots, replace comma with dot
            clean = clean.replace(/\./g, "").replace(",", ".");
          } else if (lastDot > lastComma) {
            // US style: 1,000,000.00 -> remove commas
            clean = clean.replace(/,/g, "");
          } else if (lastComma !== -1 && lastComma === clean.indexOf(",")) {
             // Only one comma, no dot. Is it 1,000 (thousand) or 1,0 (decimal)?
             // If it's followed by 3 digits, likely thousand.
             if (clean.length - lastComma === 4) clean = clean.replace(",", "");
             else clean = clean.replace(",", ".");
          } else if (lastDot !== -1 && lastDot === clean.indexOf(".")) {
             // Only one dot, no comma. Is it 1.000 (thousand) or 1.0 (decimal)?
             if (clean.length - lastDot === 4) clean = clean.replace(".", "");
          }
          bPayment = parseFloat(clean) || 0;
        }

        if (bPayment <= 0) continue;

        const bu = getBU(mCen);
        const key = norm(mCen) + "_BONUS_" + i; // Unique key per bonus row
        if (!combined[key]) {
          combined[key] = { 
            center: mCen, 
            bu: bu,
            className: "BONUS", 
            teacherHours: 0, 
            actualTA: 0, 
            expectedTA: 0, 
            numStudents: 0, 
            isKDG: false, 
            taDetails: [], 
            teacherDetails: [], 
            dailyMap: {},
            sourceSheet: bonusSheetName || "Bonus"
          };
        }
        
        combined[key].teacherHours += bPayment;
        const dsBonus = "Bonus";
        if (!combined[key].dailyMap[dsBonus]) combined[key].dailyMap[dsBonus] = { ta: [], teacher: [] };
        const bDetail = { 
          dateObj: 0, 
          dateStr: dsBonus, 
          name: bName, 
          hours: bPayment, 
          allowedTAs: 0, 
          numStudents: 0, 
          type: "Bonus",
          sourceSheet: bonusSheetName || "Bonus"
        };
        combined[key].teacherDetails.push(bDetail);
        combined[key].dailyMap[dsBonus].teacher.push({ 
          name: bDetail.name, 
          hours: bDetail.hours, 
          allowedTAs: 0, 
          numStudents: 0, 
          type: "Bonus",
          sourceSheet: bDetail.sourceSheet
        });
      }
    }
  }

  // --- BUOC 2.5: Re-check numStudents ---
  Object.keys(combined).forEach((key3) => {
    const data = combined[key3];
    Object.keys(data.dailyMap).forEach((ds5) => {
      const dd2 = data.dailyMap[ds5]; let fn2 = 0;
      dd2.teacher.forEach((t: any) => { if (t.numStudents > fn2) fn2 = t.numStudents; });
      dd2.ta.forEach((ta: any) => { if (ta.numStudents > fn2) fn2 = ta.numStudents; });
      if (!fn2) { const sk = norm(data.center)+"_"+normClass(data.className)+"_"+ds5; const sk2 = normClass(data.className)+"_"+ds5; fn2 = ctaMap[sk]||ctaMap[sk2]||0; }
      if (!fn2) { const nCls2 = normClass(data.className); const ck3 = norm(data.center)+"_"+nCls2; fn2 = csMap[ck3]||csMap[nCls2]||0; }
      if (fn2 > 0) {
        if (fn2 > data.numStudents) data.numStudents = fn2;
        dd2.teacher.forEach((t: any) => { if (!t.numStudents) { t.numStudents = fn2; t.allowedTAs = getAllowedTAs(data.className, fn2); } });
        dd2.ta.forEach((ta: any) => { if (!ta.numStudents) ta.numStudents = fn2; ta.allowedTAs = getAllowedTAs(data.className, fn2); });
      }
    });
  });
  // --- BUOC 3: Build results ---
  const results: any[] = []; let sumT = 0, sumA2 = 0, sumE = 0;
  Object.keys(combined).forEach((k) => {
    const data = combined[k];
    if (data.teacherDetails.length === 0) return; if (data.teacherHours === 0 && data.actualTA === 0) return;
    sumT += data.teacherHours; sumA2 += data.actualTA;
    let exp = 0; Object.keys(data.dailyMap).forEach((dk) => { data.dailyMap[dk].teacher.forEach((t: any) => { exp += t.hours*(t.allowedTAs !== undefined ? t.allowedTAs : 0); }); }); sumE += exp;
    let status = "Kh\u1EDBp", sc2 = "emerald", diff = "";
    const ratio = exp > 0 ? data.actualTA/exp : 0; const d1 = data.actualTA-exp;
    if (data.teacherHours === 0) { status = "Th\u1EEBa gi\u1EDD (Kh\u00F4ng c\u00F3 L\u1ECBch GV)"; sc2 = "rose"; diff = "+"+data.actualTA.toFixed(2); }
    else if (exp === 0) { if (data.actualTA === 0) { status = "Kh\u1EDBp"; sc2 = "emerald"; diff = "0,00"; } else { status = "Th\u1EEBa gi\u1EDD TA"; sc2 = "rose"; diff = "+"+data.actualTA.toFixed(2); } }
    else if (data.actualTA === 0) { status = "Thi\u1EBFu TA ho\u00E0n to\u00E0n"; sc2 = "rose"; diff = "-"+exp.toFixed(2); }
    else { if (ratio >= 0.8 && ratio <= 1.2) diff = d1 > 0 ? "+"+d1.toFixed(2) : d1.toFixed(2); else if (ratio < 0.8) { status = "Thi\u1EBFu gi\u1EDD TA"; sc2 = "rose"; diff = d1.toFixed(2); } else { status = "Th\u1EEBa gi\u1EDD TA"; sc2 = "rose"; diff = "+"+d1.toFixed(2); } }
    data.taDetails.sort((a: any, b: any) => a.dateObj-b.dateObj); data.teacherDetails.sort((a: any, b: any) => a.dateObj-b.dateObj);
    const dIds = [...new Set<string>(data.taDetails.map((td: any) => td.id).filter(Boolean))].join(", ");
    const sDates = Object.keys(data.dailyMap).sort((a: string, b: string) => { const d1t = parseAnyDate(a)?.getTime()||0; const d2t = parseAnyDate(b)?.getTime()||0; return d1t-d2t; });
    const aligned: any[] = [];
    sDates.forEach((date: string) => { const dd3 = data.dailyMap[date]; const mx = Math.max(dd3.ta.length, dd3.teacher.length); for (let i = 0; i < mx; i++) aligned.push({ date:i===0?date:"", fullDate:date, isFirstOfDay:i===0, rowSpan:mx, teacher:dd3.teacher[i]||null, ta:dd3.ta[i]||null }); });
    const oATAs = getAllowedTAs(data.className, data.numStudents||0);
    results.push({ ...data, expected:exp, allowedTAs:oATAs, displayCenter:data.center, displayIds:dIds, diffText:diff, status, statusColor:sc2, compareKey:k, alignedRows:aligned });
  });
  results.sort((a: any, b: any) => { const rank: Record<string,number> = { rose:1, amber:2, emerald:3 }; if (rank[a.statusColor] !== rank[b.statusColor]) return rank[a.statusColor]-rank[b.statusColor]; return a.center.localeCompare(b.center); });
  return { results, summary:{ sumTeacher:sumT, sumActualTA:sumA2, sumExpected:sumE }, missingCenters:[...cenOnlyA], fileDateRangeA:{ min:minA, max:maxA }, error:null, isCalculating:false };
}

// --- Worker message handler ---
self.onmessage = (e: MessageEvent) => {
  try { (self as any).postMessage(runAuditComputation(e.data)); }
  catch (err: any) { (self as any).postMessage({ results:[], summary:{ sumTeacher:0, sumActualTA:0, sumExpected:0 }, missingCenters:[], fileDateRangeA:{ min:null, max:null }, error:err?.message||"L\u1ED7i t\u00EDnh to\u00E1n", isCalculating:false }); }
};
