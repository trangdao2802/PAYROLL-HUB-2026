export function parseMoneyToNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(String(val).replace(/[^\d.-]/g, '')) || 0;
}
export function formatNumber(val: any): string {
  const n = parseMoneyToNumber(val);
  return n.toLocaleString('en-US');
}
export function formatMoneyVND(val: any): string {
  const n = parseMoneyToNumber(val);
  return n.toLocaleString('vi-VN');
}
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}
export function formatIdNumber(id: unknown): string {
  if (id === undefined || id === null || id === "") return "";

  let normalized = String(id).trim().replace(/[\s\u00a0]/g, "");

  if (/^[+]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(normalized)) {
    const numericId = Number(normalized);
    if (Number.isSafeInteger(numericId) && numericId >= 0) {
      normalized = numericId.toLocaleString("fullwide", {
        useGrouping: false,
        maximumFractionDigits: 0,
      });
    }
  } else if (/^\d+\.0+$/.test(normalized)) {
    normalized = normalized.replace(/\.0+$/, "");
  } else if (/^\+\d+$/.test(normalized)) {
    normalized = normalized.slice(1);
  }

  return /^\d+$/.test(normalized) && normalized.length < 12
    ? normalized.padStart(12, "0")
    : normalized;
}
export function prepareDataForExport(data: any[]): any[] {
  return data;
}
export function parseAnyDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
export function getVal(row: any, key: string): any {
  return row ? row[key] : null;
}
export function parseTimeStrToHours(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
export async function getExcelFileBuffer(
  file: File,
): Promise<{ buffer: ArrayBuffer; name: string }> {
  if (!file) {
    throw new Error("Không tìm thấy thông tin file để đọc.");
  }

  return {
    buffer: await file.arrayBuffer(),
    name: file.name,
  };
}
export function formatTime12Hour(timeStr: string): string {
  return String(timeStr);
}
export const COMMON_FIELD_ALIASES: Record<string, string[]> = {};
export function scoreMatch(a: string, b: string): number { return 0; }
export function normalizeId(id: any): string { return String(id); }
export function toVietnamDateString(date: Date): string { return String(date); }
export function generateUUID(): string { return Math.random().toString(); }
export async function fetchGoogleSheetAsFile(url: string, name: string): Promise<File> { return new File([], name); }
export function isMoneyColumn(col: string): boolean { return false; }
export async function fetchWithBackoff(fn: any): Promise<any> { return await fn(); }
