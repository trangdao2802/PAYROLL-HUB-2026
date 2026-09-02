import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  getL07FromChargeToCenterMkt,
  resolveMktRosterCenter,
} from "../src/app/lib/utils/center-utils";
import {
  parseExcelData,
  prepareExcelResult,
} from "../src/app/workers/excelParser.worker";

function createWorkbookBuffer(
  sheetName: string,
  rows: Array<Array<string | number>>,
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    sheetName,
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

function importMktRoster(
  sheetName: string,
  header: "CENTER" | "CHARGE TO CENTER",
  centerNumber: number,
  fileName = "MKT LOCAL NORTH.xlsx",
) {
  const fileBuffer = createWorkbookBuffer(sheetName, [
    [header, "ID NUMBER", "FULL NAME", "DATE", "TYPE", "DURATION"],
    [centerNumber, "001090627040", "NGUYEN PHUNG MANH", "15/08/2026", "LPAR01", 2],
  ]);
  const rawRows = parseExcelData(fileBuffer, fileName);
  return prepareExcelResult(rawRows, fileName, "mkt-roster", "roster").rows[0];
}

test("maps the numeric part of a North MKT center to its full L07", () => {
  assert.equal(getL07FromChargeToCenterMkt("1"), "HN0001.PHY");
  assert.equal(getL07FromChargeToCenterMkt("16"), "HN0016.PDP");
  assert.equal(getL07FromChargeToCenterMkt("27.0"), "HN0027.OPK");
  assert.deepEqual(resolveMktRosterCenter("27"), {
    chargeToCenterMkt: "HN0027.OPK",
    l07: "HN0027.OPK",
    business: "AHN",
  });
});

test("reads CENTER from an MKT Local North ROSTER sheet as the L07 allocation code", () => {
  const row = importMktRoster("ROSTER", "CENTER", 27);

  assert.equal(row.l07, "MKT LOCAL NORTH");
  assert.equal(row.chargeToCenterMkt, "HN0027.OPK");
  assert.equal(row.business, "AHN");
});

test("reads CHARGE TO CENTER from a Q_ROSTER sheet and converts it to L07", () => {
  const row = importMktRoster(
    "Q_ROSTER",
    "CHARGE TO CENTER",
    16,
    "NORTH.MKT ROSTER AUG.xlsx",
  );

  assert.equal(row.l07, "MKT LOCAL NORTH");
  assert.equal(row.chargeToCenterMkt, "HN0016.PDP");
  assert.equal(row.business, "AHN");
});
