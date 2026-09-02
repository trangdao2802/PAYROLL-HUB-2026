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

test("every routed page keeps a 12px inset from the viewport edges", () => {
  const styles = readSource("src/index.css");

  assert.match(
    styles,
    /main\s*>\s*div\.min-h-0\s*>\s*div\.min-h-0\s*\{[\s\S]*?padding:\s*12px\s*!important/,
  );
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
