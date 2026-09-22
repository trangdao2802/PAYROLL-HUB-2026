import { isChargeAmountColumn, isNonSummableTextColumn } from "./data-utils";
import type { ExportColumn } from "./table-excel";

const excludedGross = new Set(["SALARY SCALE", "FROM", "TO", "BANK NAME", "CITAD CODE", "TAX CODE", "CONTRACT NO", "TÊN FILE", "CENTER", "THÁNG", "MONTH"]);
const excludedHold = new Set(["TÊN FILE", "MÃ AE", "TAX CODE", "CONTRACT NO", "TÌNH TRẠNG THANH TOÁN", "TRẠNG THÁI", "DIỄN GIẢI"]);

/** Permanent UI columns; temporary user hiding is applied separately by Excel. */
export function masterTableExportColumns(table: { headers?: string[]; data?: Record<string, unknown>[] } | undefined, kind: "Sheet1_AE" | "Hold_AE"): ExportColumn[] {
  const excluded = kind === "Hold_AE" ? excludedHold : excludedGross;
  const headers: string[] = [];
  for (const key of [...(table?.headers || []), ...Object.keys(table?.data?.[0] || {})]) {
    const upper = key.trim().toUpperCase();
    if (!key || key.startsWith("_") || /^(ID|UUID|ROWID|RECORDID)$/.test(upper) || excluded.has(upper)) continue;
    if (!headers.some(h => h.toUpperCase() === upper)) headers.push(key);
  }
  if (!headers.some(h => h.toUpperCase() === "THÁNG BÁO CÁO")) headers.push("Tháng báo cáo");
  const no = headers.find(h => /^(NO\.?|STT)$/i.test(h)) || "No.";
  const bu = headers.find(h => /^(BU|BUSINESS)$/i.test(h));
  const l07 = headers.find(h => /^L07$/i.test(h));
  const note = headers.find(h => /^(NOTE|DIỄN GIẢI)$/i.test(h));
  const ordered = [no, ...(bu ? [bu] : []), ...(l07 ? [l07] : []),
    ...headers.filter(h => h !== no && h !== bu && h !== l07 && h !== note),
    ...(kind === "Hold_AE" ? [note || "Note"] : [])];
  return ordered.map(key => ({ key, label: /^(STT|NO\.?)$/i.test(key) ? "No." : key,
    type: !isNonSummableTextColumn(key) && (isChargeAmountColumn(key) || /TOTAL|PAYMENT|TIỀN|LỆCH/i.test(key)) ? "currency" : "text" }));
}
