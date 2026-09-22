/* eslint-disable @typescript-eslint/no-explicit-any */
import { CENTER_COLUMNS } from "../../constants/timesheet-columns";
import { getBusinessFromL07, getCenterInfoByL07, mapL07, resolveMktRosterCenter } from "./center-utils";

export const MKT_LOCAL_NORTH_GROUP = "MKT LOCAL NORTH_TIMESHEET";

const MKT_LOCAL_DUPLICATE_KEYS = new Set([
  "chargeMktLocal",
  "chargeLdem01",
  "chargeLdec01",
  "chargeLpar01",
  "chargeLret01",
  "chargeMoth01",
]);

export function buildCenterTable(data: any[], mktLocalNorthData: any[]) {
  const normalizeCenter = (value: unknown) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  const detectedTypes = new Set<string>();
  (mktLocalNorthData || []).forEach((row) => {
    if (String(row.overlap_check || "").startsWith("Trùng lịch")) return;
    const type = String(row.taskType || row.type || row.TYPE || row.sourceType || "").trim().toUpperCase();
    if (type) detectedTypes.add(type);
  });

  if (detectedTypes.size === 0) {
    const knownCandidates = [
      { type: "LDEM01", key: "chargeLdem01" },
      { type: "LDEC01", key: "chargeLdec01" },
      { type: "LPAR01", key: "chargeLpar01" },
      { type: "LRET01", key: "chargeLret01" },
      { type: "MOTH01", key: "chargeMoth01" },
    ];
    knownCandidates.forEach(({ type, key }) => {
      if ((data || []).some((r) => Number(r[key] || r[type]) > 0)) {
        detectedTypes.add(type);
      }
    });
  }

  const types = Array.from(detectedTypes).sort((left, right) =>
    left.localeCompare(right, "vi"),
  );

  // Group MKT Local North values by canonical L07
  const valuesByCenter = new Map<string, Record<string, number>>();
  const centerMetaByKey = new Map<string, { business: string; l07: string }>();

  (mktLocalNorthData || []).forEach((row) => {
    if (String(row.overlap_check || "").startsWith("Trùng lịch")) return;
    const type = String(row.taskType || row.type || row.TYPE || row.sourceType || "").trim().toUpperCase();
    if (!type) return;

    const rawCenter = String(
      row.chargeToCenterMkt || row.charge_to_center_mkt || row.center || row.l07 || "",
    ).trim();
    if (!rawCenter) return;

    const resolved = resolveMktRosterCenter(rawCenter);
    const canonicalL07 = resolved.l07 || mapL07(rawCenter) || rawCenter;
    const bus =
      resolved.business ||
      getCenterInfoByL07(canonicalL07)?.bus ||
      String(row.business || "").trim() ||
      getBusinessFromL07(canonicalL07) ||
      "AHN";

    const hours = Number(row.workingHours ?? row.duration) || 0;
    const rawOverride = row._mktPivotValueOverride;
    const hasOverride =
      rawOverride !== undefined &&
      rawOverride !== null &&
      rawOverride !== "" &&
      Number.isFinite(Number(rawOverride));
    const amount = hasOverride ? Number(rawOverride) : hours * 20000;

    const canonicalKey = normalizeCenter(canonicalL07);
    const current = valuesByCenter.get(canonicalKey) || {};
    current[type] = (current[type] || 0) + amount;
    valuesByCenter.set(canonicalKey, current);

    // Also store by raw center for flexible lookup
    const rawKey = normalizeCenter(rawCenter);
    if (rawKey && rawKey !== canonicalKey && !valuesByCenter.has(rawKey)) {
      valuesByCenter.set(rawKey, current);
    }

    if (!centerMetaByKey.has(canonicalKey)) {
      centerMetaByKey.set(canonicalKey, { business: bus, l07: canonicalL07 });
    }
  });

  const dynamicColumns = types.map((type) => ({
    key: `mktLocalNorth::${type}`,
    label: type,
    group: MKT_LOCAL_NORTH_GROUP,
    type: "currency" as const,
    width: 140,
  }));

  const staticColumns = CENTER_COLUMNS.filter(
    (column) => !MKT_LOCAL_DUPLICATE_KEYS.has(column.key),
  );
  const totalIndex = staticColumns.findIndex(
    (column) => column.key === "totalSalary",
  );
  const columns = [...staticColumns];
  columns.splice(
    totalIndex >= 0 ? totalIndex : columns.length,
    0,
    ...dynamicColumns,
  );

  const matchedCanonicalKeys = new Set<string>();

  const mappedExistingRows = (data || []).map((row) => {
    const rawRowCenter = String(row.l07 || row.center || "").trim();
    const resolvedRow = resolveMktRosterCenter(rawRowCenter);
    const canonicalRowL07 = resolvedRow.l07 || mapL07(rawRowCenter) || rawRowCenter;
    const normCanonical = normalizeCenter(canonicalRowL07);
    const normRaw = normalizeCenter(rawRowCenter);

    const values = valuesByCenter.get(normCanonical) || valuesByCenter.get(normRaw) || {};
    if (valuesByCenter.has(normCanonical)) matchedCanonicalKeys.add(normCanonical);
    if (valuesByCenter.has(normRaw)) matchedCanonicalKeys.add(normRaw);

    const additions = Object.fromEntries(
      types.map((type) => {
        if (values[type] !== undefined) {
          return [`mktLocalNorth::${type}`, values[type]];
        }
        const fallbackKey = `charge${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`;
        const val = Number(row[fallbackKey] ?? row[`charge${type}`] ?? row[type]) || 0;
        return [`mktLocalNorth::${type}`, val];
      }),
    );

    const mktRowTotal = types.reduce(
      (sum, type) => sum + (Number(additions[`mktLocalNorth::${type}`]) || 0),
      0,
    );

    const nonMktSalary =
      (Number(row.chargeLxo) || 0) +
      (Number(row.chargeEc) || 0) +
      (Number(row.chargePtDemo) || 0) +
      (Number(row.chargeOther) || 0) +
      (Number(row.chargeRenewalProjects) || 0) +
      (Number(row.chargeDiscoveryCamp) || 0) +
      (Number(row.chargeSummerOuting) || 0) +
      (Number(row.chargeSummerInstructors) || 0) +
      (Number(row.chargeExtraSummerInstructors) || 0);

    const totalSalary = nonMktSalary + mktRowTotal;

    return {
      ...row,
      l07: canonicalRowL07,
      ...additions,
      totalSalary,
    };
  });

  // If MKT Local North contains destination centers not present in the existing timesheet data
  // (e.g. general "MKT LOCAL NORTH" bucket or centers with only marketing events this cycle),
  // append them as center rows so their payroll values reconcile exactly with Pivot Timesheet.
  const additionalRows: any[] = [];
  centerMetaByKey.forEach((meta, canonicalKey) => {
    if (matchedCanonicalKeys.has(canonicalKey)) return;

    const values = valuesByCenter.get(canonicalKey) || {};
    const additions = Object.fromEntries(
      types.map((type) => [`mktLocalNorth::${type}`, values[type] || 0]),
    );
    const mktRowTotal = types.reduce(
      (sum, type) => sum + (Number(additions[`mktLocalNorth::${type}`]) || 0),
      0,
    );

    additionalRows.push({
      id: `center-mkt-${canonicalKey}`,
      business: meta.business,
      l07: meta.l07,
      center: meta.l07,
      chargeLxo: 0,
      chargeEc: 0,
      chargePtDemo: 0,
      chargeOther: 0,
      chargeRenewalProjects: 0,
      chargeDiscoveryCamp: 0,
      chargeSummerOuting: 0,
      chargeSummerInstructors: 0,
      chargeExtraSummerInstructors: 0,
      ...additions,
      totalSalary: mktRowTotal,
    });
  });

  const allRows = [...mappedExistingRows, ...additionalRows];

  const rowsByBusiness = new Map<string, any[]>();
  allRows.forEach((row) => {
    const business = String(row.business || row.bu || row.BU || "CHƯA XÁC ĐỊNH").trim();
    const groupedRows = rowsByBusiness.get(business) || [];
    groupedRows.push({ ...row, _subtotalGroup: business });
    rowsByBusiness.set(business, groupedRows);
  });

  const rowsWithBusinessSubtotals = Array.from(rowsByBusiness.entries()).flatMap(
    ([business, businessRows], groupIndex) => {
      businessRows.sort((a, b) => String(a.l07 || "").localeCompare(String(b.l07 || "")));

      const subtotal: Record<string, unknown> = {
        id: `center-subtotal-${groupIndex}-${business}`,
        business,
        l07: `TỔNG PHỤ · ${business} (${businessRows.length} CENTER)`,
        _isSubtotal: true,
        _subtotalGroup: business,
      };

      columns.forEach((column) => {
        if (!["number", "currency", "money"].includes(String(column.type))) return;
        subtotal[column.key] = businessRows.reduce(
          (sum, row) => sum + (Number(row[column.key]) || 0),
          0,
        );
      });

      return [...businessRows, subtotal];
    },
  );

  return { centerColumns: columns, centerRows: rowsWithBusinessSubtotals };
}
