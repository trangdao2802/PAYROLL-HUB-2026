import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveDeductionsSheetSource,
  sortMissingDeductionsSourceNotesFirst,
} from "../src/app/lib/utils/deductions-sheet-source";

test("a multi-month HOLD source uses the salary month written in Note", () => {
  assert.deepEqual(
    resolveDeductionsSheetSource("HOLD T5+6", "Lương tháng 6"),
    {
      sheetSource: "Hold T6",
      salaryMonth: 6,
      needsSourceMonthNote: false,
    },
  );

  assert.equal(
    resolveDeductionsSheetSource("HOLD T5 + T6", "Điều chỉnh lương T05/2026")
      .sheetSource,
    "Hold T5",
  );
});

test("a multi-month HOLD source without a usable Note is preserved and flagged", () => {
  assert.deepEqual(resolveDeductionsSheetSource("HOLD T5+6", ""), {
    sheetSource: "HOLD T5+6",
    salaryMonth: null,
    needsSourceMonthNote: true,
  });

  assert.deepEqual(
    resolveDeductionsSheetSource("HOLD T5+6", "Chưa xác định"),
    {
      sheetSource: "HOLD T5+6",
      salaryMonth: null,
      needsSourceMonthNote: true,
    },
  );
});

test("single-month and non-HOLD sources remain unchanged", () => {
  assert.deepEqual(resolveDeductionsSheetSource("Hold T5", "Lương tháng 6"), {
    sheetSource: "Hold T5",
    salaryMonth: null,
    needsSourceMonthNote: false,
  });
  assert.deepEqual(resolveDeductionsSheetSource("ADD T5+6", "Lương tháng 6"), {
    sheetSource: "ADD T5+6",
    salaryMonth: null,
    needsSourceMonthNote: false,
  });
});

test("rows needing a source-month Note are stably pinned to the top", () => {
  const ordinaryA = { id: "a" };
  const missingA = { id: "missing-a", _needsSheetSourceNote: true };
  const ordinaryB = { id: "b" };
  const missingB = { id: "missing-b", _needsSheetSourceNote: true };

  assert.deepEqual(
    sortMissingDeductionsSourceNotesFirst([
      ordinaryA,
      missingA,
      ordinaryB,
      missingB,
    ]).map((row) => row.id),
    ["missing-a", "missing-b", "a", "b"],
  );
});

test("Deductions import and table rendering apply the source-note exception", () => {
  const importSource = readFileSync(
    new URL("../src/app/pages/03-master/AEDataConfig.tsx", import.meta.url),
    "utf8",
  );
  const tableSource = readFileSync(
    new URL(
      "../src/app/pages/03-master/components/HoldAETable.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const dataTableSource = readFileSync(
    new URL("../src/app/components/DataTable.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );

  assert.match(importSource, /resolveDeductionsSheetSource\(\s*sheetName,\s*noteValue/);
  assert.match(tableSource, /sortMissingDeductionsSourceNotesFirst/);
  assert.match(dataTableSource, /data-table-row--needs-source-note/);
  assert.match(
    styles,
    /\.data-table-row--needs-source-note\s*>\s*td\s*\{[\s\S]*?#fecdd3/,
  );
});
