import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const tableTitleFiles = [
  "src/app/pages/01-timesheet/TimesheetSummary.tsx",
  "src/app/pages/01-timesheet/tables/CenterTable.tsx",
  "src/app/pages/01-timesheet/tables/EmployeeTable.tsx",
  "src/app/pages/01-timesheet/tables/MktLocalNorthPivotTable.tsx",
  "src/app/pages/01-timesheet/tables/RosterRawTable.tsx",
  "src/app/pages/02-audit/Audit.tsx",
  "src/app/pages/03-master/AEDataConfig.tsx",
  "src/app/pages/03-master/MasterAE.tsx",
  "src/app/pages/03-master/components/HoldAETable.tsx",
  "src/app/pages/04-balance/BulkPayment.tsx",
  "src/app/pages/04-balance/PivotSheet.tsx",
  "src/app/pages/04-balance/components/BulkPaymentAnalytics.tsx",
  "src/app/pages/04-balance/components/HoldAddDashboard.tsx",
];

test("all branded table headers use the shared Macondo title remainder", () => {
  for (const file of tableTitleFiles) {
    const source = readSource(file);
    assert.match(source, /<TableInitialMark/, `${file} must render the branded initial`);
    assert.match(source, /<TableTitleRemainder/, `${file} must render the shared title remainder`);
  }
});

test("table and page titles share the requested Macondo styling and baseline", () => {
  const styles = readSource("src/index.css");
  const navbar = readSource("src/app/components/layouts/Navbar.tsx");

  assert.match(styles, /\.app-table-title-remainder[\s\S]*font-family: "Macondo Swash Caps"/);
  assert.match(styles, /\.app-table-title-remainder[\s\S]*font-size: 15px !important/);
  assert.match(styles, /\.app-table-title-remainder[\s\S]*transform: translateY\(2px\)/);
  assert.match(styles, /\.app-table-title-line > :has\(\.app-table-title-remainder\)[\s\S]*padding-bottom: 2px !important/);
  assert.match(styles, /\.navbar-current-label[\s\S]*font-family: "Macondo Swash Caps"/);
  assert.match(navbar, /className="navbar-current-label truncate"/);
  assert.doesNotMatch(navbar, /navbar-current-label[^\n]*Gentium Book Plus/);
});

test("dimmed transaction content does not dim its table borders", () => {
  const dataTable = readSource("src/app/components/DataTable.tsx");
  const styles = readSource("src/index.css");

  assert.match(dataTable, /row\._dimmed \? "data-table-row--dimmed"/);
  assert.doesNotMatch(dataTable, /row\._dimmed \? "opacity-35"/);
  assert.match(styles, /\.data-table-row--dimmed > td > \*[\s\S]*opacity: 0\.35/);
  assert.doesNotMatch(styles, /\.data-table-row--dimmed\s*\{[^}]*opacity:/);
});
