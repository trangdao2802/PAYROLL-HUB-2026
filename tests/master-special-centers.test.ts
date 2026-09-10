import assert from "node:assert/strict";
import test from "node:test";
import { buildPivotFromAppData, normalizePivotL07 } from "../src/app/lib/utils/pivot-utils";
import { processExcelData } from "../src/app/workers/pivot.worker";
import * as XLSX from "xlsx";
import { normalizeGrossPaySpecialCenters, resolveMasterSpecialCenter } from "../src/app/lib/utils/master-special-centers";

test("Pivot keeps Cambridge, Contest and Job Fair as separate L07 values", () => {
  for (const center of ["CAMBRIDGE", "CONTEST", "JOB FAIR"]) {
    assert.equal(normalizePivotL07(center), center);
  }
  const result = buildPivotFromAppData([
    { L07: "CAMBRIDGE", Business: "AHN", "CHARGE TO LXO": 100000 },
    { L07: "CONTEST", Business: "AHN", "CHARGE TO LXO": 200000 },
    { L07: "JOB FAIR", Business: "AHN", "CHARGE TO LXO": 300000 },
    { L07: "CAMBRIDGE HP", Business: "AHN", "CHARGE TO LXO": 400000 },
  ], [], [], "08.2026");
  assert.deepEqual(result.groupedData, {
    AHN: { CAMBRIDGE: { "08.2026": { LXO: 100000 } }, CONTEST: { "08.2026": { LXO: 200000 } }, "JOB FAIR": { "08.2026": { LXO: 300000 } } },
    AHP: { CAMBRIDGE: { "08.2026": { LXO: 400000 } } },
  });
});

test("Pivot recovers each legacy ZHN row using its original center, including Cambridge HP bonus", () => {
  const result = buildPivotFromAppData([
    { L07: "ZHN0000.GY", _rawAE: "Cambridge", Business: "AHN", "CHARGE TO LXO": 100000 },
    { L07: "ZHN0000.GY", _rawAE: "Contest", Business: "AHN", "CHARGE TO LXO": 100000 },
    { L07: "ZHN0000.GY/CAMBRIDGE", Center: "Cambridge_HP", Business: "AHN", "Extra Summer Instructors": 30000 },
    { L07: "Job_Fair", Business: "AHN", "TOTAL PAYMENT": 20000, Type: "LXO" },
  ], [], [], "08.2026");
  assert.deepEqual(result.groupedData, {
    AHN: { CAMBRIDGE: { "08.2026": { LXO: 100000 } }, CONTEST: { "08.2026": { LXO: 100000 } }, "JOB FAIR": { "08.2026": { LXO: 20000 } } },
    AHP: { CAMBRIDGE: { "08.2026": { "EXTRA SUMMER INSTRUCTORS": 30000 } } },
  });
});

test("Pivot file worker assigns named L07 rows and moves Cambridge HP to AHP", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["CENTER", "CHARGE TO LXO", "TOTAL PAYMENT"],
    ["Cambridge", 100000, 100000],
    ["Contest", 200000, 200000],
    ["JOB FAIR", 300000, 300000],
    ["Cambridge HP", 400000, 400000],
  ]), "SHEET 1");
  const result = processExcelData([{ name: "NORTH.xlsx", buffer: XLSX.write(workbook, { bookType: "xlsx", type: "array" }) }]);
  assert.deepEqual(result.logs, []);
  assert.deepEqual(result.groupedData, {
    AHN: { CAMBRIDGE: { LXO: 100000 }, CONTEST: { LXO: 200000 }, "JOB FAIR": { LXO: 300000 } },
    AHP: { CAMBRIDGE: { LXO: 400000 } },
  });
});

test("stored Gross Pay corrections are idempotent and preserve amounts and unrelated tables", () => {
  const ordinaryRow = { L07: "HN0027.OPK", _rawAE: "Cambridge", Business: "AHN", "TOTAL PAYMENT": 200000 };
  const ambiguousRow = { L07: "ZHN0000.GY", Business: "AHN", "TOTAL PAYMENT": 40000 };
  const data = {
    Sheet1_AE: { headers: ["L07", "Business"], data: [
      { L07: "ZHN0000.GY", _rawAE: "Cambridge", Business: "AHN", "TOTAL PAYMENT": 100000 },
      { L07: "ZHN0000.GY/CAMBRIDGE/CONTEST", _rawAE: "Contest", Business: "AHN", "TOTAL PAYMENT": 100000 },
      { L07: "ZHN0000.GY/CAMBRIDE", Center: "CAMBRIDE_HP", BU: "AHN", Business: "AHN", "TOTAL PAYMENT": 100000 },
      { L07: "JOB_FAIR", Business: "APT", "TOTAL PAYMENT": 30000 },
      ordinaryRow, ambiguousRow,
    ] },
    Hold_AE: { data: [{ L07: "ZHN0000.GY", "TOTAL PAYMENT": 50000 }] },
  };
  const before = structuredClone(data);
  const normalized = normalizeGrossPaySpecialCenters(data);
  assert.deepEqual(data, before);
  assert.deepEqual(normalized.Sheet1_AE.data.slice(0, 4).map(row => [row.L07, row.Business, row["TOTAL PAYMENT"]]), [
    ["CAMBRIDGE", "AHN", 100000], ["CONTEST", "AHN", 100000], ["CAMBRIDGE", "AHP", 100000], ["JOB FAIR", "APT", 30000],
  ]);
  assert.equal(normalized.Sheet1_AE.data[2].BU, "AHP");
  assert.equal(normalized.Sheet1_AE.data[4], ordinaryRow);
  assert.equal(normalized.Sheet1_AE.data[5], ambiguousRow);
  assert.equal(normalized.Hold_AE, data.Hold_AE);
  assert.equal(normalizeGrossPaySpecialCenters(normalized), normalized);
});

test("Cambridge HP aliases always resolve to the Cambridge allocation in AHP", () => {
  for (const name of ["Cambridge HP", "CAMBRIDGE_HP", "CambridgeHP", "ZHN0000.GY/Cambride HP"]) {
    assert.deepEqual(resolveMasterSpecialCenter(name, "AHN"), { l07: "CAMBRIDGE", business: "AHP" });
  }
});
