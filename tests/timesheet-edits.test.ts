import assert from "node:assert/strict";
import test from "node:test";
import { applyTimesheetPivotEdit, applyTimesheetRosterCellEdit, getRosterSourceKey, normalizeTimesheetAllocation } from "../src/app/lib/utils/timesheet-edits";
import { calculateTimesheet } from "../src/app/workers/timesheet.worker";
import { TASK_COLUMNS } from "../src/app/constants/timesheet-logic";

const source = (index: number) => ({
  _rowId: "mkt-file", _sourceFile: "MKT LOCAL NORTH.xlsx", center: "MKT LOCAL NORTH",
  "charge to center": 27, "ID NUMBER": `00109062704${index}`, "FULL NAME": "ORIGINAL NAME",
  DATE: "15/09/2026", TYPE: "LPAR01", FROM: "09:00", TO: "11:00",
});
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const calculate = (rows: Record<string, unknown>[]) => calculateTimesheet({
  rosterData: reload(rows), salaryScaleData: [], staffData: [], cacheData: [],
  fromDateStr: "2026-09-01", toDateStr: "2026-09-30", preferredYear: 2026,
  appData: { Timesheet_InputList: [{ id: "mkt-file", l07: "MKT LOCAL NORTH" }] },
  checkTAsMap: {}, classSizeMap: {}, TASK_COLUMNS,
});

test("legacy numeric allocations normalize immediately and keep their source identity", () => {
  const raw = source(1);
  const normalized = normalizeTimesheetAllocation(raw);
  assert.equal(normalized.chargeToCenterMkt, "HN0027.OPK");
  assert.equal(getRosterSourceKey(normalized), getRosterSourceKey(raw));
});

test("Pivot L07 edits survive recalculation, reload and a second edit without changing another row in the same file", () => {
  const rows = [source(1), source(2)];
  const originalKey = getRosterSourceKey(rows[0]);
  assert.notEqual(originalKey, getRosterSourceKey(rows[1]));
  let saved = applyTimesheetPivotEdit(rows, new Set([originalKey]), "chargeToCenterMkt", "TH0001.TPU");
  const first = calculate(saved).processedRosterData;
  assert.deepEqual(first.map(row => row.chargeToCenterMkt), ["TH0001.TPU", "HN0027.OPK"]);
  assert.equal(first[0]._sourceKey, originalKey);
  saved = applyTimesheetPivotEdit(reload(saved), new Set([first[0]._sourceKey]), "chargeToCenterMkt", "Hai Phong");
  const second = calculate(saved);
  assert.deepEqual(second.processedRosterData.map(row => row.chargeToCenterMkt), ["Hai Phong", "HN0027.OPK"]);
  assert.equal(second.processedRosterData[0].business, "AHP");
  assert.equal(second.centerSummary.find(row => row.l07 === "Hai Phong")?.chargeMktLocal, 40000);
});

test("Raw Data edits replace imported aliases and preserve zero and blank values", () => {
  let row: Record<string, unknown> = source(1);
  for (const [field, value] of [["full_name", "EDITED NAME"], ["ngay", "16/09/2026"], ["gio_vao", "10:00"], ["notes", ""], ["duration", 0]] as const) {
    row = applyTimesheetRosterCellEdit(row, field, value);
  }
  const result = calculate([row]).processedRosterData[0];
  assert.equal(result.full_name, "EDITED NAME");
  assert.equal(result.ngay, "16/09/2026");
  assert.equal(result.duration, 0);
  row = applyTimesheetRosterCellEdit(row, "gio_ra", "12:00");
  assert.equal(calculate([row]).processedRosterData[0].duration, 2);
  row = applyTimesheetRosterCellEdit(row, "chargeToCenterMkt", "");
  assert.equal(row["charge to center"], "");
  assert.equal(normalizeTimesheetAllocation(row).chargeToCenterMkt, "");
});

test("explicit roster L07 and business edits survive the configured file defaults", () => {
  let row: Record<string, unknown> = { ...source(1), _sourceFile: "HN0001.PHY.xlsx", center: "HN0001.PHY" };
  row = applyTimesheetRosterCellEdit(row, "l07", "TH0001.TPU");
  row = applyTimesheetRosterCellEdit(row, "business", "ATH");
  const result = calculate([row]).processedRosterData[0];
  assert.equal(result.l07, "TH0001.TPU");
  assert.equal(result.business, "ATH");
});

test("Pivot amount edits are pure when React replays an updater and zero stays an override", () => {
  const rows = [source(1), source(2)];
  const keys = new Set(rows.map(getRosterSourceKey));
  const first = applyTimesheetPivotEdit(rows, keys, "LPAR01", 12345);
  assert.deepEqual(applyTimesheetPivotEdit(rows, keys, "LPAR01", 12345), first);
  assert.deepEqual(calculate(first).processedRosterData.map(row => row._mktPivotValueOverride), [12345, 0]);
  const zero = applyTimesheetPivotEdit(reload(first), keys, "LPAR01", 0);
  assert.deepEqual(calculate(zero).processedRosterData.map(row => row._mktPivotValueOverride), [0, 0]);
  assert.equal("_mktPivotValueOverride" in rows[0], false);
});
