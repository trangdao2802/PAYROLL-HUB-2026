import * as XLSX from "xlsx";

export const BANK_TRANSACTION_EXPORT_HEADERS = [
  "Payment Serial Number",
  "Tháng báo cáo",
  "Transaction Type Code",
  "Payment Type",
  "Customer Reference No",
  "Beneficiary Account No.",
  "Beneficiary Name",
  "Document ID",
  "Place of Issue",
  "ID Issuance Date",
  "Beneficiary Bank Swift Code / IFSC Code",
  "Transaction Currency",
  "Payment Amount",
  "Charge Type",
  "Payment details",
  "Beneficiary - Nick Name",
  "Beneficiary Addr. Line 1",
  "Beneficiary Addr. Line 2",
] as const;

export interface WorkbookCardValue {
  label: string;
  value: unknown;
}

export interface WorkbookTableDefinition {
  rows: Array<Record<string, unknown>>;
  headers?: string[];
  cards?: WorkbookCardValue[];
}

export interface WorkbookTreeNode {
  title: string;
  sheetName?: string;
  table?: WorkbookTableDefinition;
  children?: WorkbookTreeNode[];
}

export interface WorkbookExportDefinition {
  title: string;
  fileName: string;
  pages: WorkbookTreeNode[];
}

interface ResolvedWorkbookNode extends WorkbookTreeNode {
  resolvedSheetName?: string;
  children?: ResolvedWorkbookNode[];
}

const INDEX_SHEET_NAME = "SƠ ĐỒ";
const INTERNAL_ROW_KEYS = new Set([
  "ID",
  "_ID",
  "UUID",
  "ROWID",
  "RECORDID",
]);

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFF8E7" } },
  fill: { patternType: "solid", fgColor: { rgb: "6A1118" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "A9BED5" } },
    bottom: { style: "thin", color: { rgb: "A9BED5" } },
    left: { style: "thin", color: { rgb: "A9BED5" } },
    right: { style: "thin", color: { rgb: "A9BED5" } },
  },
};

const DATA_BORDER = {
  top: { style: "thin", color: { rgb: "B7CBE0" } },
  bottom: { style: "thin", color: { rgb: "B7CBE0" } },
  left: { style: "thin", color: { rgb: "B7CBE0" } },
  right: { style: "thin", color: { rgb: "B7CBE0" } },
};

const isInternalKey = (key: string): boolean => {
  const normalized = key.trim().toUpperCase();
  return key.startsWith("_") || INTERNAL_ROW_KEYS.has(normalized);
};

const isIdentifierHeader = (header: string): boolean => {
  const normalized = header.trim().toUpperCase();
  return (
    normalized.includes("ID") ||
    normalized.includes("ACCOUNT") ||
    normalized.includes("NUMBER") ||
    normalized.includes("CODE") ||
    normalized.includes("STK") ||
    normalized.includes("MÃ") ||
    normalized.includes("SERIAL")
  );
};

const isNumericHeader = (header: string): boolean => {
  const normalized = header.trim().toUpperCase();
  if (isIdentifierHeader(header)) return false;
  return [
    "AMOUNT",
    "PAYMENT",
    "TOTAL",
    "TỔNG",
    "TIỀN",
    "LƯƠNG",
    "HOURS",
    "GIỜ",
    "DURATION",
    "VARIANCE",
    "CHÊNH",
    "SỐ DƯ",
  ].some((token) => normalized.includes(token));
};

const parseNumericText = (value: string): number | null => {
  let normalized = value
    .trim()
    .replace(/\s*(?:VND|VNĐ|₫|Đ)\s*$/i, "")
    .replace(/\s+/g, "");
  if (!normalized || !/^-?[\d.,]+$/.test(normalized)) return null;

  const lastDot = normalized.lastIndexOf(".");
  const lastComma = normalized.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    normalized = normalized
      .split(thousandsSeparator)
      .join("")
      .replace(decimalSeparator, ".");
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/[.,]/g, "");
  } else {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeExportValue = (value: unknown, header: string): unknown => {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") return JSON.stringify(value);

  const text = String(value);
  if (isIdentifierHeader(header)) return text;
  if (isNumericHeader(header) || /\s*(?:VND|VNĐ|₫|Đ)\s*$/i.test(text)) {
    const parsed = parseNumericText(text);
    if (parsed !== null) return parsed;
  }
  return text;
};

const collectHeaders = (
  rows: Array<Record<string, unknown>>,
  requestedHeaders?: string[],
): string[] => {
  const headers: string[] = [];
  const seen = new Set<string>();
  (requestedHeaders || []).forEach((header) => {
    const normalized = header.trim().toUpperCase();
    if (!header || isInternalKey(header) || seen.has(normalized)) return;
    seen.add(normalized);
    headers.push(header);
  });
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      const normalized = key.trim().toUpperCase();
      if (!key || isInternalKey(key) || seen.has(normalized)) return;
      seen.add(normalized);
      headers.push(key);
    });
  });
  return headers;
};

const sanitizeSheetName = (value: string): string => {
  const cleaned = String(value || "Bảng")
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Bảng").slice(0, 31);
};

const allocateSheetName = (requested: string, used: Set<string>): string => {
  const base = sanitizeSheetName(requested);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toUpperCase())) {
    const suffixText = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  used.add(candidate.toUpperCase());
  return candidate;
};

const resolveNodeSheetNames = (
  nodes: WorkbookTreeNode[],
  used: Set<string>,
): ResolvedWorkbookNode[] =>
  nodes.map((node) => ({
    ...node,
    resolvedSheetName: node.table
      ? allocateSheetName(node.sheetName || node.title, used)
      : undefined,
    children: resolveNodeSheetNames(node.children || [], used),
  }));

const setCellLink = (cell: XLSX.CellObject | undefined, target: string) => {
  if (!cell) return;
  cell.l = { Target: target };
  cell.s = {
    ...(cell.s || {}),
    font: { color: { rgb: "0563C1" }, underline: true },
  };
};

const applyNumberFormat = (cell: XLSX.CellObject | undefined) => {
  if (!cell || cell.t !== "n") return;
  cell.z = "#,##0.##";
};

const applyTableStyles = (
  worksheet: XLSX.WorkSheet,
  headerRowIndex: number,
  dataRowCount: number,
  columnCount: number,
) => {
  for (let column = 0; column < columnCount; column += 1) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: column })];
    if (headerCell) headerCell.s = HEADER_STYLE;

    for (let row = headerRowIndex + 1; row <= headerRowIndex + dataRowCount; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell) continue;
      cell.s = {
        ...(cell.s || {}),
        fill: {
          patternType: "solid",
          fgColor: { rgb: row % 2 === 0 ? "FFFBEA" : "FFFFFF" },
        },
        border: DATA_BORDER,
        alignment: { vertical: "center", wrapText: false },
      };
      applyNumberFormat(cell);
    }
  }
};

const estimateColumnWidth = (header: string, values: unknown[]): number => {
  const longest = values.reduce<number>(
    (max, value) => Math.max(max, String(value ?? "").length),
    header.length,
  );
  return Math.min(Math.max(longest + 2, 10), 38);
};

const createTableWorksheet = (
  node: ResolvedWorkbookNode,
): XLSX.WorkSheet => {
  const table = node.table!;
  const headers = collectHeaders(table.rows, table.headers);
  const rows = table.rows.map((row) =>
    headers.map((header) => normalizeExportValue(row?.[header], header)),
  );
  const headerRowIndex = 3;
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["← SƠ ĐỒ"],
    [node.title],
    [],
    headers.length > 0 ? headers : ["THÔNG TIN"],
    ...(headers.length > 0 ? rows : [["Không có dữ liệu"]]),
  ]);

  setCellLink(worksheet.A1, `#'${INDEX_SHEET_NAME}'!A1`);
  if (worksheet.A2) {
    worksheet.A2.s = {
      font: { bold: true, color: { rgb: "6A1118" }, sz: 15 },
    };
  }

  const visibleRowCount = headers.length > 0 ? rows.length : 1;
  const visibleColumnCount = Math.max(headers.length, 1);
  applyTableStyles(
    worksheet,
    headerRowIndex,
    visibleRowCount,
    visibleColumnCount,
  );

  const cardStartColumn = Math.max(visibleColumnCount + 2, 6);
  if (table.cards?.length) {
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        ["THÔNG TIN CARD", "GIÁ TRỊ"],
        ...table.cards.map((card) => [
          card.label,
          normalizeExportValue(card.value, card.label),
        ]),
      ],
      { origin: { r: 1, c: cardStartColumn } },
    );
    for (let column = cardStartColumn; column <= cardStartColumn + 1; column += 1) {
      const headerCell = worksheet[XLSX.utils.encode_cell({ r: 1, c: column })];
      if (headerCell) headerCell.s = HEADER_STYLE;
      for (let row = 2; row < 2 + table.cards.length; row += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (!cell) continue;
        cell.s = { ...(cell.s || {}), border: DATA_BORDER };
        applyNumberFormat(cell);
      }
    }
  }

  worksheet["!cols"] = [
    ...(headers.length > 0
      ? headers.map((header, column) => ({
          wch: estimateColumnWidth(
            header,
            rows.slice(0, 200).map((row) => row[column]),
          ),
        }))
      : [{ wch: 18 }]),
  ];
  if (table.cards?.length) {
    while ((worksheet["!cols"] || []).length < cardStartColumn) {
      worksheet["!cols"]!.push({ wch: 3 });
    }
    worksheet["!cols"]!.push({ wch: 24 }, { wch: 18 });
  }
  worksheet["!rows"] = [
    { hpt: 20 },
    { hpt: 24 },
    { hpt: 8 },
    { hpt: 32 },
  ];
  if (headers.length > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: headerRowIndex + rows.length, c: headers.length - 1 },
      }),
    };
  }
  (worksheet as XLSX.WorkSheet & { "!freeze"?: unknown })["!freeze"] = {
    xSplit: 0,
    ySplit: 4,
    topLeftCell: "A5",
    activePane: "bottomLeft",
    state: "frozen",
  };
  return worksheet;
};

const createIndexWorksheet = (
  definition: WorkbookExportDefinition,
  pages: ResolvedWorkbookNode[],
): XLSX.WorkSheet => {
  const rows: unknown[][] = [
    [definition.title],
    ["SƠ ĐỒ CẤU TRÚC WORKBOOK"],
    ["Nhấn tên bảng để mở sheet tương ứng"],
    [],
    ["NHÁNH", "TRANG / BẢNG", "SHEET", "SỐ DÒNG"],
    ["●", definition.title, "", ""],
  ];
  const links: Array<{ row: number; sheetName: string }> = [];

  const appendNodes = (
    nodes: ResolvedWorkbookNode[],
    prefix: string,
  ) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const branch = `${prefix}${isLast ? "└─" : "├─"}`;
      const rowIndex = rows.length;
      rows.push([
        branch,
        node.title,
        node.resolvedSheetName || "",
        node.table?.rows.length ?? "",
      ]);
      if (node.resolvedSheetName) {
        links.push({ row: rowIndex, sheetName: node.resolvedSheetName });
      }
      appendNodes(
        node.children || [],
        `${prefix}${isLast ? "   " : "│  "}`,
      );
    });
  };
  appendNodes(pages, "");

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  if (worksheet.A1) {
    worksheet.A1.s = {
      font: { bold: true, color: { rgb: "6A1118" }, sz: 18 },
    };
  }
  if (worksheet.A2) {
    worksheet.A2.s = {
      font: { bold: true, color: { rgb: "6A1118" }, sz: 14 },
    };
  }
  for (let column = 0; column < 4; column += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 4, c: column })];
    if (cell) cell.s = HEADER_STYLE;
  }
  links.forEach(({ row, sheetName }) => {
    const target = `#'${sheetName}'!A1`;
    setCellLink(worksheet[XLSX.utils.encode_cell({ r: row, c: 1 })], target);
    setCellLink(worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })], target);
  });
  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 44 },
    { wch: 31 },
    { wch: 12 },
  ];
  (worksheet as XLSX.WorkSheet & { "!freeze"?: unknown })["!freeze"] = {
    ySplit: 5,
    topLeftCell: "A6",
    activePane: "bottomLeft",
    state: "frozen",
  };
  return worksheet;
};

const appendNodeWorksheets = (
  workbook: XLSX.WorkBook,
  nodes: ResolvedWorkbookNode[],
) => {
  nodes.forEach((node) => {
    if (node.table && node.resolvedSheetName) {
      XLSX.utils.book_append_sheet(
        workbook,
        createTableWorksheet(node),
        node.resolvedSheetName,
      );
    }
    appendNodeWorksheets(workbook, node.children || []);
  });
};

export function prepareTransactionBankExportRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const exportRow: Record<string, unknown> = {};
    BANK_TRANSACTION_EXPORT_HEADERS.forEach((header) => {
      exportRow[header] = header === "Document ID" ? "" : (row?.[header] ?? "");
    });
    return exportRow;
  });
}

export function buildHierarchicalWorkbook(
  definition: WorkbookExportDefinition,
): XLSX.WorkBook {
  const usedSheetNames = new Set<string>([INDEX_SHEET_NAME.toUpperCase()]);
  const pages = resolveNodeSheetNames(definition.pages, usedSheetNames);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createIndexWorksheet(definition, pages),
    INDEX_SHEET_NAME,
  );
  appendNodeWorksheets(workbook, pages);
  return workbook;
}

export async function downloadHierarchicalWorkbook(
  definition: WorkbookExportDefinition,
): Promise<void> {
  // Load the styled writer only when the user downloads. This keeps it out of
  // the initial application bundle while preserving fills, fonts and borders.
  const styledModule = await import("xlsx-js-style");
  const styledXlsx = styledModule.default;
  styledXlsx.writeFile(
    buildHierarchicalWorkbook(definition),
    definition.fileName,
  );
}
