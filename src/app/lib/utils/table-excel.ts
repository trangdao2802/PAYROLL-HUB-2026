import * as XLSX from "xlsx";
import { deductionsNote } from "./deductions-display";
import { isNonSummableTextColumn, parseMoneyToNumber } from "./data-utils";

export interface ExportColumn { key: string; label: string; type?: string; hidden?: boolean }
export interface TableExportSchema { columns: ExportColumn[]; hiddenColumns: string[] }
interface TableExportSnapshot { schema: TableExportSchema; rows: Record<string, unknown>[] }
const liveTables = new Map<string, () => TableExportSnapshot>();

export function registerTableExport(key: string, getter: () => TableExportSnapshot) {
  liveTables.set(key, getter);
  const schema = getter().schema;
  try { localStorage.setItem(`dt_export_${key}`, JSON.stringify(schema)); } catch { /* Storage may be full. */ }
  return () => { if (liveTables.get(key) === getter) liveTables.delete(key); };
}

export function getLiveTableExport(key: string) { return liveTables.get(key)?.(); }

export function readTableExportSchema(key: string): TableExportSchema | undefined {
  const live = liveTables.get(key)?.();
  if (live) return live.schema;
  try {
    const schema = JSON.parse(localStorage.getItem(`dt_export_${key}`) || "null");
    if (!schema?.columns) return undefined;
    const hidden = localStorage.getItem(`dt_hidden_${key}`);
    return { ...schema, hiddenColumns: hidden ? JSON.parse(hidden) : schema.hiddenColumns };
  } catch { return undefined; }
}

export function tableExportValue(row: Record<string, unknown>, col: ExportColumn, index: number) {
  if (/^(NO\.?|STT)$/i.test(col.key)) return row._isSubtotal || row._isTotalRow ? (row[col.key] ?? "") : index + 1;
  if (col.key === "Note") return deductionsNote(row);
  const value = row[col.key] ?? "";
  if (isNonSummableTextColumn(col.key)) return String(value);
  if ((col.type === "number" || col.type === "currency") && value !== "") return parseMoneyToNumber(value);
  return typeof value === "object" ? "" : value;
}

export function buildTableWorksheet(rows: Record<string, unknown>[], schema: TableExportSchema) {
  const columns = schema.columns.filter(col => !col.key.startsWith("_"));
  const sheet = XLSX.utils.aoa_to_sheet([
    columns.map(col => col.label),
    ...rows.map((row, index) => columns.map(col => tableExportValue(row, col, index))),
  ]);
  sheet["!cols"] = columns.map(col => ({ wch: Math.max(12, Math.min(35, col.label.length + 2)), hidden: schema.hiddenColumns.includes(col.key) }));
  Object.values(sheet).forEach(cell => { if (cell?.t === "n") cell.z = "General"; });
  return sheet;
}

export function downloadTableExcel(key: string): boolean {
  const table = liveTables.get(key)?.();
  if (!table) return false;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildTableWorksheet(table.rows, table.schema), "Data");
  XLSX.writeFile(workbook, `${key}.xlsx`);
  return true;
}
