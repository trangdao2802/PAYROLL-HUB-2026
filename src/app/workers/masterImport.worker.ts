/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import {
  COMMON_FIELD_ALIASES,
  getExcelFileBuffer,
  scoreMatch,
} from "../lib/utils/master-data-utils";
import { isRelevantMasterSheetName } from "../lib/utils/master-sheet-utils";

export interface MasterSheetPayload {
  sheetName: string;
  rows: any[][];
}

export interface MasterWorkbookPayload {
  fileName: string;
  sheetNames: string[];
  mapping: Record<string, string>;
  sheets: MasterSheetPayload[];
}

interface ParseRequest {
  requestId: string;
  file: File;
  isMktFile: boolean;
  targetFields: string[];
}

function buildMapping(
  sheets: MasterSheetPayload[],
  targetFields: string[],
) {
  const headers: string[] = [];
  const seen = new Set<string>();

  sheets.forEach(({ rows }) => {
    for (let rowIndex = 0; rowIndex < Math.min(50, rows.length); rowIndex++) {
      const row = rows[rowIndex];
      if (!Array.isArray(row)) continue;
      row.forEach((cell) => {
        const value = String(cell ?? "").trim().replace(/\s+/g, " ");
        const key = value.toLowerCase();
        if (!value || !Number.isNaN(Number(value)) || seen.has(key)) return;
        seen.add(key);
        headers.push(value);
      });
    }
  });

  const mapping: Record<string, string> = {};
  targetFields.forEach((target) => {
    const aliases = COMMON_FIELD_ALIASES[target] || [target.toUpperCase()];
    let bestHeader = "";
    let bestScore = 0;
    headers.forEach((header) => {
      const score = scoreMatch(header, target, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    });
    if (bestScore >= 60) mapping[target] = bestHeader;
  });

  return mapping;
}

export async function parseMasterWorkbook(
  file: File,
  isMktFile: boolean,
  targetFields: string[],
): Promise<MasterWorkbookPayload> {
  const { buffer, name } = await getExcelFileBuffer(file);
  const lowerName = name.toLowerCase();
  const isCsv =
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".gsheet") ||
    lowerName.endsWith(".txt");

  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), {
        type: "string",
        cellDates: true,
        raw: true,
      })
    : XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        raw: true,
        dense: true,
      });

  const sheets = workbook.SheetNames.filter((sheetName) =>
    isRelevantMasterSheetName(sheetName, isMktFile),
  ).map((sheetName) => ({
    sheetName,
    rows: XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }),
  }));

  return {
    fileName: name,
    sheetNames: workbook.SheetNames,
    mapping: buildMapping(sheets, targetFields),
    sheets,
  };
}

if (typeof self !== "undefined") {
  self.onmessage = async (event: MessageEvent<ParseRequest>) => {
    const { requestId, file, isMktFile, targetFields } = event.data;
    try {
      const result = await parseMasterWorkbook(file, isMktFile, targetFields);
      self.postMessage({ requestId, success: true, result });
    } catch (error: any) {
      self.postMessage({
        requestId,
        success: false,
        error: error?.message || String(error),
      });
    }
  };
}
