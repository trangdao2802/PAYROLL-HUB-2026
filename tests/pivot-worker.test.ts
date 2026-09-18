import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { processExcelData } from "../src/app/workers/pivot.worker";

function workbookFile(name: string, sheetName: string, rows: (string | number)[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return { name, buffer: XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer };
}

test("Pivot worker aggregates MKT roster task aliases and excludes adjustments", () => {
  const result = processExcelData([workbookFile("NORTH.MKT.xlsx", "ROSTER", [
    ["CENTER", "TYPE", "DURATION"],
    ["Ocean Park", "LPAR", 2],
    ["Ocean Park", "LPAR01 - support", 1],
    ["Ocean Park", "ADD", 10],
    ["Ocean Park", "CANCEL", 10],
  ])]);
  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.typeColumns, ["LPAR01"]);
  assert.deepEqual(result.groupedData, { AHN: { "HN0027.OPK": { LPAR01: 60000 } } });
});

test("Pivot worker normalizes charge columns including bonus", () => {
  const result = processExcelData([workbookFile("NORTH.xlsx", "Sheet1", [
    ["CENTER", "CHARGE TO LXO", "CHARGE TO BONUS", "CHARGE TO ADD", "TOTAL PAYMENT"],
    ["Ocean Park", 100000, 20000, 999999, 120000],
    ["Ocean Park", 50000, 10000, 999999, 60000],
  ])]);
  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.typeColumns, ["EXTRA SUMMER INSTRUCTORS", "LXO"]);
  assert.deepEqual(result.groupedData, { AHN: { "HN0027.OPK": { LXO: 150000, "EXTRA SUMMER INSTRUCTORS": 30000 } } });
});

test("Pivot worker groups Total Payment by normalized type without charge columns", () => {
  const result = processExcelData([workbookFile("NORTH.xlsx", "Sheet1", [
    ["CENTER", "TYPE", "TOTAL PAYMENT"],
    ["Ocean Park", "LDEM", 50000],
    ["Ocean Park", "LDEM01", 30000],
    ["Ocean Park", "CANCEL", 90000],
  ])]);
  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.typeColumns, ["LDEM01"]);
  assert.deepEqual(result.groupedData, { AHN: { "HN0027.OPK": { LDEM01: 80000 } } });
});
