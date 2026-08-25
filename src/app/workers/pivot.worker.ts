/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import {
  isSheetOneMasterSheetName,
  normalizeMasterSheetName,
} from "../lib/utils/master-sheet-utils";

function extractBankName(filename: string, fallbackBank?: string): string {
  const upper = filename.toUpperCase();
  if (upper.includes("MKT") || upper.includes("MARKETING")) return "MKT LOCAL";
  if (upper.includes("NORTH")) return "NORTH";
  if (upper.includes(" TN") || upper.includes(" THAI NGUYEN") || upper.includes("_TN_") || upper.includes("TN.")) return "THAI NGUYEN";
  if (upper.includes(" TH") || upper.includes(" THANH HOA") || upper.includes("_TH_") || upper.includes("TH.")) return "THANH HOA";
  if (upper.includes(" PT") || upper.includes(" PHU THO") || upper.includes("_PT_") || upper.includes("PT.")) return "PHU THO";
  return fallbackBank || "UNKNOWN";
}

const rawCenterToMktMap: Record<string, string> = {
  "Ly Thai To": "BN0001.LTT", "Tu Son": "BN0002.TSN", "Pho Hue": "HN0001.PHY",
  "Thai Ha": "HN0002.THA", "Hoang Quoc Viet": "HN0003.HQV", "Lieu Giai": "HN0004.LGI",
  "Nguyen Van Linh": "HN0005.NVL", "Van Quan": "HN0007.VQN", "The Garden": "HN0010.MDH",
  "Nguyen Huu Tho": "HN0012.NHT", "Tan Mai": "HN0014.TMI", "Van Phu": "HN0015.VPU",
  "Phan Dinh Phung": "HN0016.PDP", "Ham Nghi": "HN0017.HNI", "Vu Tong Phan": "HN0018.VTP",
  "Nguyen Tuan": "HN0019.NTN", "Ngoai Giao Doan": "HN0021.NGD", "Mo Lao": "HN0022.NVO",
  "Linh Dam": "HN0023.LDM", "Times City": "HN0024.TCY", "Le Trong Tan": "HN0025.LTT",
  "Viet Hung": "HN0026.VHG", "Ocean Park": "HN0027.OPK", "Pham Van Dong": "HN0028.PVD",
  "Vu Pham Ham": "HN0029.VPH", "An Khanh": "HN0030.AKH", "An Hung": "HN0031.AHG",
  "Lac Long Quan": "HN0032.LLQ", "Dong Anh": "HN0033.DAH", "Hong Tien": "HN0034.HTN",
  "Ecopark": "HY0001.ECP", "Hai Phong": "Hai Phong", "Quang Ninh": "QN0001.HLG",
  "Vinh": "VIN001.CTG", "Vinh Phuc": "VP0001.PCT", "Thanh Hoa": "TH0001.TPU",
  "Thai Nguyen": "TN0001.LNQ", "Phu Tho": "PT0001.HVG", "NTW": "NTW"
};

const aeCodeToL07Map: Record<string, string> = {
  "Ngo Si Lien": "BN0001.LTT", "Tu Son": "BN0002.TSN", "Pho Hue Junior": "HN0001.PHY",
  "Pho Hue": "HN0001.PHY", "Thai Ha": "HN0002.THA", "Thai Ha (center Láng Hạ)": "HN0002.THA",
  "Thai Ha (center Lang Ha)": "HN0002.THA", "Hoang Quoc Viet": "HN0003.HQV",
  "Lieu Giai": "HN0004.LGI", "Nguyen Van Linh": "HN0005.NVL", "Van Quan": "HN0007.VQN",
  "My Dinh": "HN0010.MDH", "The Garden": "HN0010.MDH", "Hoang Mai": "HN0012.NHT",
  "Nguyen Huu Tho": "HN0012.NHT", "Tan Mai": "HN0014.TMI", "Van Phu": "HN0015.VPU",
  "Phan Dinh Phung": "HN0016.PDP", "Ham Nghi": "HN0017.HNI", "Vu Tong Phan": "HN0018.VTP",
  "Nguyen Tuan": "HN0019.NTN", "Ngoai Giao Doan": "HN0021.NGD", "Mo Lao": "HN0022.NVO",
  "Linh Dam": "HN0023.LDM", "Times City": "HN0024.TCY", "Le Trong Tan": "HN0025.LTT",
  "Viet Hung": "HN0026.VHG", "Ocean Park": "HN0027.OPK", "Pham Van Dong": "HN0028.PVD",
  "Vu Pham Ham": "HN0029.VPH", "An Khanh": "HN0030.AKH", "An Hung": "HN0031.AHG",
  "Lac Long Quan": "HN0032.LLQ", "Dong Anh": "HN0033.DAH", "Hong Tien": "HN0034.HTN",
  "Ecopark": "HY0001.ECP", "Hai Phong": "Hai Phong", "Quang Ninh": "QN0001.HLG",
  "Vinh": "VIN001.CTG", "Vinh Phuc": "VP0001.PCT", "Thanh Hoa": "TH0001.TPU",
  "Thai Nguyen": "TN0001.LNQ", "Phu Tho": "PT0001.HVG", "NTW": "NTW"
};

const L07_TO_BU_MAP: Record<string, string> = {
  "BN0001.LTT": "AHN", "BN0002.TSN": "AHN", "HN0001.PHY": "AHN", "HN0002.THA": "AHN",
  "HN0003.HQV": "AHN", "HN0004.LGI": "AHN", "HN0005.NVL": "AHN", "HN0007.VQN": "AHN",
  "HN0010.MDH": "AHN", "HN0012.NHT": "AHN", "HN0014.TMI": "AHN", "HN0015.VPU": "AHN",
  "HN0016.PDP": "AHN", "HN0017.HNI": "AHN", "HN0018.VTP": "AHN", "HN0019.NTN": "AHN",
  "HN0021.NGD": "AHN", "HN0022.NVO": "AHN", "HN0023.LDM": "AHN", "HN0024.TCY": "AHN",
  "HN0025.LTT": "AHN", "HN0026.VHG": "AHN", "HN0027.OPK": "AHN", "HN0028.PVD": "AHN",
  "HN0029.VPH": "AHN", "HN0030.AKH": "AHN", "HN0031.AHG": "AHN", "HN0032.LLQ": "AHN",
  "HN0033.DAH": "AHN", "HN0034.HTN": "AHN", "HY0001.ECP": "AHN",
  "QN0001.HLG": "APH", "VIN001.CTG": "APH", "VP0001.PCT": "APH",
  "TH0001.TPU": "ATH", "TN0001.LNQ": "ATN", "PT0001.HVG": "APT",
  "NTW": "NTW", "Hai Phong": "APH"
};

function parseMoneyToNumber(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val).replace(/,/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function processTimesheetMktLogic(row: any) {
  const mappedCenter = String(row.chargetocenterCode || "").trim();
  let l07 = mappedCenter;
  for (const [key, value] of Object.entries(rawCenterToMktMap)) {
    if (key.toUpperCase() === mappedCenter.toUpperCase()) {
      l07 = value;
      break;
    }
  }
  const bu = L07_TO_BU_MAP[l07] || "AHN";
  return { bu, l07 };
}

function processNorthLogic(rawCenter: string) {
  const cleaned = rawCenter ? String(rawCenter).trim() : "";
  let l07 = cleaned;

  for (const [key, value] of Object.entries(aeCodeToL07Map)) {
    if (key.toUpperCase() === cleaned.toUpperCase()) {
      l07 = value;
      break;
    }
  }

  if (l07 === cleaned) {
    const upperClean = cleaned.toUpperCase();
    if (upperClean.includes("THAI HA") || upperClean.includes("THÁI HÀ")) l07 = "HN0002.THA";
    else if (upperClean.includes("HOANG QUOC VIET") || upperClean.includes("HOÀNG QUỐC VIỆT")) l07 = "HN0003.HQV";
    else if (upperClean.includes("LIEU GIAI") || upperClean.includes("LIỄU GIAI")) l07 = "HN0004.LGI";
    else if (upperClean.includes("NGUYEN VAN LINH") || upperClean.includes("NGUYỄN VĂN LINH")) l07 = "HN0005.NVL";
    else if (upperClean.includes("VAN QUAN") || upperClean.includes("VĂN QUÁN")) l07 = "HN0007.VQN";
    else if (upperClean.includes("THE GARDEN") || upperClean.includes("MY DINH") || upperClean.includes("MỸ ĐÌNH")) l07 = "HN0010.MDH";
    else if (upperClean.includes("HOANG MAI") || upperClean.includes("HOÀNG MAI") || upperClean.includes("NGUYEN HUU THO")) l07 = "HN0012.NHT";
    else if (upperClean.includes("TAN MAI") || upperClean.includes("TÂN MAI")) l07 = "HN0014.TMI";
    else if (upperClean.includes("VAN PHU") || upperClean.includes("VĂN PHÚ")) l07 = "HN0015.VPU";
    else if (upperClean.includes("PHAN DINH PHUNG") || upperClean.includes("PHAN ĐÌNH PHÙNG")) l07 = "HN0016.PDP";
    else if (upperClean.includes("HAM NGHI") || upperClean.includes("HÀM NGHI")) l07 = "HN0017.HNI";
    else if (upperClean.includes("VU TONG PHAN") || upperClean.includes("VŨ TÔNG PHAN")) l07 = "HN0018.VTP";
    else if (upperClean.includes("NGUYEN TUAN") || upperClean.includes("NGUYỄN TUÂN")) l07 = "HN0019.NTN";
    else if (upperClean.includes("NGOAI GIAO DOAN") || upperClean.includes("NGOẠI GIAO ĐOÀN")) l07 = "HN0021.NGD";
    else if (upperClean.includes("MO LAO") || upperClean.includes("MỖ LAO")) l07 = "HN0022.NVO";
    else if (upperClean.includes("LINH DAM") || upperClean.includes("LINH ĐÀM")) l07 = "HN0023.LDM";
    else if (upperClean.includes("TIMES CITY")) l07 = "HN0024.TCY";
    else if (upperClean.includes("LE TRONG TAN") || upperClean.includes("LÊ TRỌNG TẤN")) l07 = "HN0025.LTT";
    else if (upperClean.includes("VIET HUNG") || upperClean.includes("VIỆT HƯNG")) l07 = "HN0026.VHG";
    else if (upperClean.includes("OCEAN PARK")) l07 = "HN0027.OPK";
    else if (upperClean.includes("PHAM VAN DONG") || upperClean.includes("PHẠM VĂN ĐỒNG")) l07 = "HN0028.PVD";
    else if (upperClean.includes("VU PHAM HAM") || upperClean.includes("VŨ PHẠM HÀM")) l07 = "HN0029.VPH";
    else if (upperClean.includes("AN KHANH") || upperClean.includes("AN KHÁNH")) l07 = "HN0030.AKH";
    else if (upperClean.includes("AN HUNG") || upperClean.includes("AN HƯNG")) l07 = "HN0031.AHG";
    else if (upperClean.includes("LAC LONG QUAN") || upperClean.includes("LẠC LONG QUÂN")) l07 = "HN0032.LLQ";
    else if (upperClean.includes("DONG ANH") || upperClean.includes("ĐÔNG ANH")) l07 = "HN0033.DAH";
    else if (upperClean.includes("HONG TIEN") || upperClean.includes("HỒNG TIẾN")) l07 = "HN0034.HTN";
    else if (upperClean.includes("NGO SI LIEN") || upperClean.includes("LY THAI TO") || upperClean.includes("LÝ THÁI TỔ")) l07 = "BN0001.LTT";
    else if (upperClean.includes("TU SON") || upperClean.includes("TỪ SƠN")) l07 = "BN0002.TSN";
    else if (upperClean.includes("ECOPARK")) l07 = "HY0001.ECP";
    else if (upperClean.includes("HAI PHONG") || upperClean.includes("HẢI PHÒNG")) l07 = "Hai Phong";
    else if (upperClean.includes("QUANG NINH") || upperClean.includes("QUẢNG NINH") || upperClean.includes("HALONG") || upperClean.includes("HẠ LONG")) l07 = "QN0001.HLG";
    else if (upperClean.includes("VINH")) l07 = "VIN001.CTG";
    else if (upperClean.includes("VINH PHUC") || upperClean.includes("VĨNH PHÚC")) l07 = "VP0001.PCT";
    else if (upperClean.includes("THANH HOA") || upperClean.includes("THANH HÓA")) l07 = "TH0001.TPU";
    else if (upperClean.includes("THAI NGUYEN") || upperClean.includes("THÁI NGUYÊN")) l07 = "TN0001.LNQ";
    else if (upperClean.includes("PHU THO") || upperClean.includes("PHÚ THỌ")) l07 = "PT0001.HVG";
    else if (upperClean.includes("PHO HUE") || upperClean.includes("PHỐ HUẾ")) l07 = "HN0001.PHY";
    else if (upperClean.includes("NTW")) l07 = "NTW";
  }

  const bu = L07_TO_BU_MAP[l07] || "";
  return { bu, l07 };
}

function processExcelData(fileList: { name: string; bank?: string; buffer: ArrayBuffer }[]) {
  const newGroupedData: Record<string, Record<string, Record<string, number>>> = {};
  const uniqueTypes = new Set<string>();
  const newLogs: any[] = [];

  for (const item of fileList) {
    try {
      const displayBankName = extractBankName(item.name, item.bank);
      let processType = (displayBankName === 'MKT LOCAL') ? "MKT LOCAL NORTH" : "NORTH";
      
      const workbook = XLSX.read(item.buffer, { type: "array" });
      let targetSheetName = "";

      const rosterSheet = workbook.SheetNames.find(n => 
        n.toUpperCase().includes('ROSTER') || n.toUpperCase().includes('Q_ROSTER')
      );

      if (processType === "MKT LOCAL NORTH" || rosterSheet) {
        processType = "MKT LOCAL NORTH";
        targetSheetName = rosterSheet || workbook.SheetNames[0];
      } else {
        targetSheetName = workbook.SheetNames.find((name) => {
          const normalizedName = normalizeMasterSheetName(name);
          return (
            isSheetOneMasterSheetName(name) ||
            normalizedName === "INTERN" ||
            normalizedName === "REPORT"
          );
        }) || workbook.SheetNames.find((name) => {
          const normalizedName = normalizeMasterSheetName(name);
          return (
            normalizedName.includes("DATA") ||
            normalizedName.includes("DU LIEU")
          );
        }) || workbook.SheetNames[0];
      }

      if (!targetSheetName) continue;
      const worksheet = workbook.Sheets[targetSheetName];

      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      if (jsonData.length <= 1) continue;

      let headerRowIdx = 0;
      for (let r = 0; r < Math.min(15, jsonData.length); r++) {
        const rowStr = (jsonData[r] || []).map((c: any) => String(c || "").toUpperCase()).join(" ");
        if (
          (rowStr.includes("CENTER") || rowStr.includes("TRUNG TÂM") || rowStr.includes("MÃ AE") || rowStr.includes("AE CODE")) &&
          (rowStr.includes("TOTAL PAYMENT") || rowStr.includes("THỰC NHẬN") || rowStr.includes("TỔNG") || rowStr.includes("DURATION") || rowStr.includes("HOURS"))
        ) {
          headerRowIdx = r;
          break;
        }
      }

      const headers = jsonData[headerRowIdx] || [];

      if (processType === "MKT LOCAL NORTH") {
        const centerColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return (
            val === 'CHARGE TO CENTER' ||
            val === 'CHARGE TO CENTER MKT' ||
            val === 'CHARGETOCENTER' ||
            val === 'CHARGETOCENTERCODE' ||
            val.includes('CHARGE TO CENTER') ||
            val === 'CENTER' ||
            val === 'CENTERS' ||
            val === 'MÃ TT' ||
            val === 'TRUNG TÂM' ||
            val === 'CƠ SỞ'
          );
        });
        const typeColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return (
            val === 'TYPE' ||
            val === 'CODE' ||
            val === 'TASK TYPE' ||
            val === 'TYPE CODE' ||
            val === 'LOẠI' ||
            val === 'PHÂN LOẠI' ||
            val === 'MÃ' ||
            val.includes('TYPE') ||
            val.includes('CODE') ||
            val.includes('LOẠI')
          );
        });
        const durationColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return (
            val === 'DURATION' ||
            val === 'HOURS' ||
            val === 'HOUR' ||
            val === 'SỐ GIỜ' ||
            val === 'GIỜ' ||
            val === 'TOTAL HOURS' ||
            val.includes('DURATION') ||
            val.includes('HOURS') ||
            val.includes('GIỜ')
          );
        });

        if (centerColIdx !== -1) {
          for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (!row || row.length === 0) continue;
            
            const rawCenter = row[centerColIdx] || "";
            if (!rawCenter) continue;

            let durationVal = 0;
            if (durationColIdx !== -1) {
              const rawDuration = row[durationColIdx];
              if (typeof rawDuration === 'number') {
                durationVal = rawDuration;
              } else if (typeof rawDuration === 'string') {
                durationVal = parseFloat(rawDuration.replace(/,/g, ''));
                if (isNaN(durationVal)) durationVal = 0;
              }
            }
            
            // If durationVal is a small fraction (Excel time), multiply by 24 to get hours
            if (durationVal > 0 && durationVal < 1) {
              durationVal = durationVal * 24;
            }

            let calculatedSalary = durationVal * 20000;
            if (calculatedSalary === 0) {
              const totalColIdx = headers.findIndex((h: any) => {
                if (!h) return false;
                const v = String(h).trim().toUpperCase();
                return v.includes('TOTAL') || v.includes('THỰC NHẬN') || v.includes('LƯƠNG') || v.includes('SỐ TIỀN');
              });
              if (totalColIdx !== -1 && row[totalColIdx]) {
                calculatedSalary = parseMoneyToNumber(row[totalColIdx]);
              }
            }
            if (calculatedSalary === 0) continue;

            const mapped = processTimesheetMktLogic({ chargetocenterCode: String(rawCenter) });
            const finalL07 = mapped.l07 || rawCenter;
            const finalBU = mapped.bu || "AHN";

            const rawType = typeColIdx !== -1 ? String(row[typeColIdx] || "").trim() : "MKT LOCAL";
            const finalType = formatPivotTypeHeader(rawType || "MKT LOCAL");

            if (finalType === "EXCLUDE") continue;

            uniqueTypes.add(finalType);

            if (!newGroupedData[finalBU]) newGroupedData[finalBU] = {};
            if (!newGroupedData[finalBU][finalL07]) newGroupedData[finalBU][finalL07] = {};
            if (!newGroupedData[finalBU][finalL07][finalType]) newGroupedData[finalBU][finalL07][finalType] = 0;
            newGroupedData[finalBU][finalL07][finalType] += calculatedSalary;
          }
        }
      } else {
        const centerColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return val === 'CENTER' || val === 'TRUNG TÂM' || val === 'MÃ AE' || val === 'AE CODE' || val === 'AE' || val === 'LOCATION' || val === 'CHARGE TO CENTER';
        });

        // Find individual charge columns
        const chargeCols: { index: number; label: string }[] = [];
        const seenLabels = new Set<string>();
        headers.forEach((h: any, idx: number) => {
          if (h) {
            const strH = String(h).trim();
            const uH = strH.toUpperCase();
            if (
              uH.includes("CENTER") ||
              uH.includes("TRUNG TÂM") ||
              uH.includes("NOTE") ||
              uH.includes("STATUS") ||
              uH.includes("ACCOUNT") ||
              uH.includes("NAME") ||
              uH.includes("TOTAL") ||
              uH.includes("CODE") ||
              uH.includes("THÁNG")
            ) return;
            if (uH.includes("CHARGE") || uH === "LXO" || uH === "EC" || uH === "PT-DEMO") {
              const label = formatTypeHeader(strH);
              if (label && label !== "EXCLUDE" && !seenLabels.has(label)) {
                seenLabels.add(label);
                chargeCols.push({ index: idx, label });
                uniqueTypes.add(label);
              }
            }
          }
        });

        const totalPayColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return val === 'TOTAL PAYMENT' || val === 'TỔNG' || val === 'THỰC NHẬN';
        });

        const typeColIdx = headers.findIndex((h: any) => {
          if (!h) return false;
          const val = String(h).trim().toUpperCase();
          return val === 'TYPE' || val === 'LOẠI' || val === 'PHÂN LOẠI';
        });

        if (centerColIdx !== -1 && (chargeCols.length > 0 || totalPayColIdx !== -1)) {
          for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (!row || row.length === 0) continue;
            
            const rawCenter = row[centerColIdx] || "";
            if (!rawCenter) continue;

            const { l07, bu } = processNorthLogic(String(rawCenter));
            
            // Bỏ qua MKT LOCAL NORTH và các trạm con của nó vì lương đã được tách vào LDEM/LRET/LDEC...
            if (l07 && l07.toUpperCase().includes("MKT LOCAL NORTH")) continue;
            
            if (l07 === "UNKNOWN" || !l07) {
              newLogs.push({
                file: item.name,
                row: r + 1,
                rawCenter: String(rawCenter),
                message: "Không map được Center"
              });
            }

            const finalBU = bu || "UNKNOWN";
            const finalL07 = l07 || String(rawCenter);

            if (!newGroupedData[finalBU]) newGroupedData[finalBU] = {};
            if (!newGroupedData[finalBU][finalL07]) newGroupedData[finalBU][finalL07] = {};

            if (chargeCols.length > 0) {
              chargeCols.forEach((col) => {
                const rawVal = row[col.index];
                let val = 0;
                if (typeof rawVal === 'number') {
                  val = rawVal;
                } else if (typeof rawVal === 'string') {
                  val = parseMoneyToNumber(rawVal);
                }
                if (val !== 0) {
                  if (!newGroupedData[finalBU][finalL07][col.label]) newGroupedData[finalBU][finalL07][col.label] = 0;
                  newGroupedData[finalBU][finalL07][col.label] += val;
                }
              });
            } else if (totalPayColIdx !== -1) {
              const rawTotalPay = row[totalPayColIdx];
              let typeVal = (typeColIdx !== -1 && row[typeColIdx]) ? formatTypeHeader(String(row[typeColIdx])) : "UNSPECIFIED";
              if (typeVal === "N/A" || !typeVal || typeVal.trim() === "") typeVal = "UNSPECIFIED";
              
              let val = 0;
              if (typeof rawTotalPay === 'number') {
                val = rawTotalPay;
              } else if (typeof rawTotalPay === 'string') {
                val = parseMoneyToNumber(rawTotalPay);
              }

              if (val !== 0 && typeVal !== "EXCLUDE") {
                uniqueTypes.add(typeVal);
                if (!newGroupedData[finalBU][finalL07][typeVal]) newGroupedData[finalBU][finalL07][typeVal] = 0;
                newGroupedData[finalBU][finalL07][typeVal] += val;
              }
            }
          }
        } else {
          newLogs.push({
            file: item.name,
            row: 0,
            rawCenter: "",
            message: "Không tìm thấy cột Center hoặc Total Payment"
          });
        }
      }
    } catch (e: any) {
      newLogs.push({
        file: item.name,
        row: 0,
        rawCenter: "",
        message: `Lỗi xử lý file: ${e.message}`
      });
    }
  }

  const sortedTypes = Array.from(uniqueTypes).sort((a, b) => {
    if (a === "MKT LOCAL") return -1;
    if (b === "MKT LOCAL") return 1;
    if (a === "UNSPECIFIED") return 1;
    if (b === "UNSPECIFIED") return -1;
    return a.localeCompare(b);
  });

  return { groupedData: newGroupedData, typeColumns: sortedTypes, logs: newLogs };
}

if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = async (e: MessageEvent) => {
    try {
      const { fileList } = e.data;
      const result = processExcelData(fileList);
      self.postMessage({ success: true, result });
    } catch (err: any) {
      self.postMessage({ success: false, error: err.message });
    }
  };
}
