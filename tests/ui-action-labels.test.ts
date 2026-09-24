import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("restore actions use Reset to default label", () => {
  const shared = source("src/app/components/TableRestoreButton.tsx");
  const master = source("src/app/pages/03-master/MasterAE.tsx");
  const deductions = source("src/app/pages/03-master/components/HoldAETable.tsx");
  const timesheet = source("src/app/pages/01-timesheet/TimesheetHub.tsx");
  const audit = source("src/app/pages/02-audit/Audit.tsx");

  assert.match(shared, />Reset to default</);
  assert.match(master, />Reset to default</);
  assert.match(deductions, />Reset to default</);
  assert.match(timesheet, />Reset to default</);
  assert.match(audit, /Reset to default/);
});

test("Timesheet link refresh has a distinct label", () => {
  const coverage = source(
    "src/app/pages/01-timesheet/components/TimesheetCenterCoverage.tsx",
  );

  assert.match(coverage, /Refresh Links TIMESHEET/);
  assert.doesNotMatch(coverage, /"Làm mới dữ liệu link"/);
});

test("Gross Pay hides the table-layout restore action", () => {
  const master = source("src/app/pages/03-master/MasterAE.tsx");

  assert.match(
    master,
    /activeTab !== "Sheet1_AE" && \(\s*<DropdownMenuItem[\s\S]*?Khôi phục bố cục bảng/,
  );
});
