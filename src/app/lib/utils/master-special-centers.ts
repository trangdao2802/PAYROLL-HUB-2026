type SpecialL07 = "CAMBRIDGE" | "CONTEST" | "JOB FAIR";

interface MasterSpecialCenter {
  l07: SpecialL07;
  business: string;
}

/** Resolve named allocations only for Gross Pay and Pivot Master. */
export function resolveMasterSpecialCenter(
  value: unknown,
  currentBusiness: unknown = "",
): MasterSpecialCenter | null {
  const source = String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ").toUpperCase();
  const names: SpecialL07[] = [];
  if (/CAMBRI(?:DGE|DE)/.test(source)) names.push("CAMBRIDGE");
  if (/\bCONTEST\b/.test(source)) names.push("CONTEST");
  if (/\bJOB\s*FAIR\b/.test(source)) names.push("JOB FAIR");
  // A mixed legacy label cannot identify the allocation without its source row.
  if (names.length !== 1) return null;
  const l07 = names[0];
  const existingBusiness = String(currentBusiness ?? "").trim().toUpperCase();
  const business = existingBusiness && !["UNKNOWN", "OTHER"].includes(existingBusiness)
    ? existingBusiness : "AHN";
  return { l07, business: l07 === "CAMBRIDGE" && source.includes("HP") ? "AHP" : business };
}

/** Retain original center metadata and all payroll amounts while correcting L07/BU. */
export function normalizeGrossPaySpecialCenter<T extends Record<string, unknown>>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const currentL07 = String(row.L07 ?? "").trim();
  const business = row.Business || row.BU;
  let resolved = resolveMasterSpecialCenter(currentL07, business);
  const legacyL07 = !currentL07 || currentL07.toUpperCase().includes("ZHN0000.GY");
  // Respect a real center explicitly assigned by the user.
  if (!resolved && !legacyL07) return row;
  const sources = [row._rawAE, row.Center, row.CENTER, row["CHARGE TO CENTER"],
    row["Mã ae"], row["Mã AE"], row["MÃ AE"], row["AE Code"], row["AE CODE"], row.Note];
  const sourceCenters = sources.map(source => resolveMasterSpecialCenter(source, business))
    .filter((center): center is MasterSpecialCenter => center !== null);
  resolved ||= sourceCenters[0];
  if (!resolved) return row;
  if (resolved.l07 === "CAMBRIDGE" && sourceCenters.some(center => center.l07 === "CAMBRIDGE" && center.business === "AHP")) {
    resolved = { ...resolved, business: "AHP" };
  }
  const hasBU = Object.hasOwn(row, "BU");
  if (row.L07 === resolved.l07 && row.Business === resolved.business && (!hasBU || row.BU === resolved.business)) return row;
  return { ...row, L07: resolved.l07, Business: resolved.business, ...(hasBU ? { BU: resolved.business } : {}) };
}

/** Also used on hydration/restoration so existing Gross Pay rows follow the rule. */
export function normalizeGrossPaySpecialCenters<T extends { Sheet1_AE?: { data: Record<string, unknown>[] } }>(data: T): T {
  const sheet = data.Sheet1_AE;
  if (!Array.isArray(sheet?.data)) return data;
  let changed = false;
  const rows = sheet.data.map(row => {
    const normalized = normalizeGrossPaySpecialCenter(row);
    if (normalized !== row) changed = true;
    return normalized;
  });
  return changed ? { ...data, Sheet1_AE: { ...sheet, data: rows } } : data;
}
