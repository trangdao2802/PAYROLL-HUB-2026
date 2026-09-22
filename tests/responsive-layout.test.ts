import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("document and application shell use the device viewport safely", () => {
  const document = readSource("index.html");
  const root = readSource("src/app/pages/Root.tsx");
  const styles = readSource("src/index.css");

  assert.match(document, /lang="vi"/);
  assert.match(document, /width=device-width, initial-scale=1\.0, viewport-fit=cover/);
  assert.match(root, /className="app-viewport-shell/);
  assert.match(styles, /@supports \(height: 100dvh\)/);
  assert.match(styles, /env\(safe-area-inset-top/);
  assert.match(styles, /-webkit-text-size-adjust: 100%/);
});

test("all table routes use one 12px content inset below the navbar", () => {
  const root = readSource("src/app/pages/Root.tsx");
  const styles = readSource("src/table-border-zero.css");
  const index = readSource("src/index.css");

  assert.match(root, /app-table-workspace/);
  assert.match(styles, /main\.app-table-workspace\s*\{[^}]*padding:\s*12px\s*!important/s);
  assert.match(styles, /main\.app-table-workspace > div\.min-h-0 > div\.min-h-0\s*\{[^}]*padding:\s*0\s*!important/s);
  assert.doesNotMatch(index, /main\s*>\s*div\.min-h-0\s*>\s*div\.min-h-0\s*\{[^}]*padding:\s*12px\s*!important/s);
});

test("Timesheet upload settings keeps its requested top and left inset", () => {
  const timesheetHub = readSource(
    "src/app/pages/01-timesheet/TimesheetHub.tsx",
  );

  assert.match(
    timesheetHub,
    /key="upload"[\s\S]*?paddingLeft:\s*"18px"[\s\S]*?paddingTop:\s*"12px"/,
  );
});

test("Master upload settings keeps a 12px inset with an 18px left gutter", () => {
  const master = readSource("src/app/pages/03-master/MasterAE.tsx");

  assert.match(
    master,
    /key="upload"[\s\S]*?paddingLeft:\s*"18px"[\s\S]*?paddingRight:\s*"12px"[\s\S]*?paddingTop:\s*"12px"[\s\S]*?paddingBottom:\s*"12px"/,
  );
});

test("Trial Balance keeps its frame inside the viewport", () => {
  const trialBalancePage = readSource(
    "src/app/pages/04-balance/HoldDashboardPage.tsx",
  );

  assert.match(
    trialBalancePage,
    /key="hold-dashboard-main"[\s\S]*?className="trial-balance-page-content/,
  );
});

test("mobile navigation remains available when desktop navigation is hidden", () => {
  const navbar = readSource("src/app/components/layouts/Navbar.tsx");

  assert.match(navbar, /mobile-navigation-trigger/);
  assert.match(navbar, /navigationItems\.map/);
  assert.match(navbar, /Cài đặt giao diện/);
  assert.match(navbar, /aria-label="Mở điều hướng chính"/);
});

test("dense workspaces stack their panels at tablet and phone widths", () => {
  const styles = readSource("src/index.css");
  const timesheet = readSource("src/app/pages/01-timesheet/TimesheetHub.tsx");
  const audit = readSource("src/app/pages/02-audit/Audit.tsx");
  const bulkPayment = readSource("src/app/pages/04-balance/BulkPayment.tsx");

  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /\.timesheet-workspace-grid--with-sidebar[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.audit-workspace-layout[\s\S]*flex-direction: column/);
  assert.match(styles, /\.bulk-payment-layout[\s\S]*flex-direction: column/);
  assert.match(timesheet, /timesheet-workspace-grid--with-sidebar/);
  assert.match(audit, /audit-workspace-layout/);
  assert.match(bulkPayment, /bulk-payment-data-panel/);
});

test("user table font preference stays the responsive size baseline", () => {
  const settings = readSource("src/app/lib/ui-settings.ts");
  const styles = readSource("src/index.css");

  assert.match(settings, /setProperty\("--user-font-size", settings\.fontSize\)/);
  assert.match(settings, /var\(--responsive-table-font-size/);
  assert.doesNotMatch(settings, /setProperty\("--font-size", settings\.fontSize\)/);
  assert.match(styles, /--responsive-table-font-size: calc\(var\(--user-font-size\) \+ var\(--device-font-adjustment\)\)/);
  assert.match(styles, /@media \(min-width: 2200px\)/);
  assert.match(styles, /\.app-table-title-remainder[\s\S]*font-size: 15px !important/);
});

test("Trial Balance keeps its own inset and scrollable grid without changing other tables", () => {
  const page = readSource("src/app/pages/04-balance/HoldDashboardPage.tsx");
  const styles = readSource("src/table-border-zero.css");

  assert.match(page, /trial-balance-page-content/);
  assert.match(styles, /\.trial-balance-page-content\s*\{[^}]*padding:\s*24px\s*!important/s);
  assert.match(styles, /\.trial-balance-frame > #trial-balance-table-body\s*\{[^}]*overflow-x:\s*auto\s*!important/s);
  assert.match(styles, /\.trial-balance-frame \.trial-balance-table\s*\{[^}]*min-width:\s*1120px\s*!important/s);
  assert.match(styles, /\.trial-balance-frame #trial-balance-summary\s*\{[^}]*max-height:\s*none\s*!important/s);
});

test("Trial Balance title and header rules are isolated from other tables", () => {
  const styles = readSource("src/table-border-zero.css");
  const trial = readSource("src/app/pages/04-balance/components/HoldAddDashboard.tsx");

  assert.match(styles, /main\.app-table-workspace:has\(\.trial-balance-page\)\s*\{[^}]*padding:\s*0\s*!important/s);
  assert.match(styles, /\.trial-balance-frame\s*\{[^}]*--table-frame-border:\s*#dfd0d6/s);
  assert.match(styles, /#trial-balance-table-body \.trial-balance-table > thead > tr > th\s*\{[^}]*border-bottom:\s*0\s*!important/s);
  assert.match(styles, /#trial-balance-table-body \.trial-balance-table > thead > tr > th\s*\{[^}]*padding-bottom:\s*10px\s*!important/s);
  assert.match(styles, /#trial-balance-table-body \.trial-balance-table > thead > tr:nth-child\(2\) > th\s*\{[^}]*padding-bottom:\s*6px\s*!important/s);
  assert.match(styles, /#trial-balance-summary > span:not\(:first-child\) > span:last-child\s*\{[^}]*font-size:\s*13px\s*!important/s);
  assert.match(styles, /\.trial-balance-header\s*\{[^}]*padding-bottom:\s*8px\s*!important/s);
  assert.match(trial, /className="trial-balance-header[^"]*py-2/);
  assert.doesNotMatch(trial, /trial-balance-header[^\n]*paddingBottom: "0px"/);
});

test("Trial Balance keeps both thead rows sticky as one unit with single NOTE dividers", () => {
  const trial = readSource("src/app/pages/04-balance/components/HoldAddDashboard.tsx");
  const styles = readSource("src/table-border-zero.css");

  assert.match(trial, /<thead className="sticky top-0 z-20/);
  assert.match(styles, /\.trial-balance-table > thead\s*\{[^}]*position:\s*sticky\s*!important/s);
  assert.match(styles, /\.trial-balance-table > thead > tr > th\s*\{[^}]*position:\s*static\s*!important/s);
  assert.match(styles, /inset -1px 0 0 #dfd0d6, inset 0 -1px 0 #dfd0d6/);
  assert.match(trial, /note-column-header/);
  assert.equal((trial.match(/note-column-cell/g) || []).length, 4);
  assert.match(styles, /\.trial-balance-header-content\s*\{[^}]*padding-left:\s*12px\s*!important/s);
  assert.match(styles, /\.trial-balance-frame > div#trial-balance-table-body\s*\{[^}]*height:\s*auto\s*!important/s);
  assert.doesNotMatch(styles, /height:\s*calc\(100vh\s*-\s*250px\)/);
});
