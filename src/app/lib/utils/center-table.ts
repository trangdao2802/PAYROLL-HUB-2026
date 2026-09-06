/* eslint-disable @typescript-eslint/no-explicit-any */
import { CENTER_COLUMNS } from "../../constants/timesheet-columns";
export function buildCenterTable(data: any[], mktLocalNorthData: any[]) {
  const normalizeCenter = (value: unknown) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

    const types = Array.from(
      new Set(
        mktLocalNorthData
          .map((row) => String(row.taskType || "").trim().toUpperCase())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, "vi"));

    const valuesByCenter = new Map<string, Record<string, number>>();
    mktLocalNorthData.forEach((row) => {
      if (String(row.overlap_check || "").startsWith("Trùng lịch")) return;
      const type = String(row.taskType || "").trim().toUpperCase();
      if (!type) return;
      const centerKey = normalizeCenter(
        row.chargeToCenterMkt || row.charge_to_center_mkt || row.l07 || row.center,
      );
      if (!centerKey) return;
      const current = valuesByCenter.get(centerKey) || {};
      const hours = Number(row.workingHours ?? row.duration) || 0;
      current[type] = (current[type] || 0) + hours * 20_000;
      valuesByCenter.set(centerKey, current);
    });

    const dynamicColumns = types.map((type) => ({
      key: `mktLocalNorth::${type}`,
      label: type,
      group: "MKT LOCAL NORTH_TIMESHEET",
      type: "currency" as const,
      width: 140,
    }));
    const staticColumns = CENTER_COLUMNS.filter(
      (column) => column.key !== "chargeMktLocal",
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

    const rows = data.map((row) => {
      const centerKey = normalizeCenter(row.l07 || row.center);
      const values = valuesByCenter.get(centerKey) || {};
      const additions = Object.fromEntries(
        types.map((type) => [`mktLocalNorth::${type}`, values[type] || 0]),
      );
      return { ...row, ...additions };
    });

    const rowsByBusiness = new Map<string, any[]>();
    rows.forEach((row) => {
      const business = String(row.business || row.bu || row.BU || "CHƯA XÁC ĐỊNH").trim();
      const groupedRows = rowsByBusiness.get(business) || [];
      groupedRows.push({ ...row, _subtotalGroup: business });
      rowsByBusiness.set(business, groupedRows);
    });

    const rowsWithBusinessSubtotals = Array.from(rowsByBusiness.entries()).flatMap(
      ([business, businessRows], groupIndex) => {
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
