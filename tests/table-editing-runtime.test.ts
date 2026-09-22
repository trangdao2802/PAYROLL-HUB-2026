import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("shared table editor commits the latest value once and Escape cancels a later blur", async () => {
  const result = await build({
    stdin: { contents: `
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { useTableCellEditor } from './src/app/hooks/useTableCellEditor';
      export function run() {
        let editor;
        const calls = [];
        function Probe() { editor = useTableCellEditor((...args) => calls.push(args)); return null; }
        renderToString(React.createElement(Probe));
        const original = { id: 'row-1', l07: 'HN0027.OPK' };
        editor.beginEdit({ r: 0, c: 1 }, original, 'l07', original.l07);
        editor.setEditValue('Hai Phong');
        editor.commitEdit();
        editor.commitEdit(); // Enter followed by blur
        editor.beginEdit({ r: 0, c: 1 }, { id: 'row-2' }, 'amount', 100);
        editor.setEditValue('99');
        editor.cancelEdit();
        editor.commitEdit(); // Escape followed by blur
        editor.beginEdit({ r: 1, c: 2 }, original, 'amount', 0);
        editor.commitEdit();
        editor.beginEdit({ r: 1, c: 2 }, original, 'note', 'old note');
        editor.setEditValue('');
        editor.commitEdit();
        return calls;
      }
    `, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  });
  const module = { exports: {} as { run: () => unknown[] } };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const original = { id: "row-1", l07: "HN0027.OPK" };
  assert.deepEqual(module.exports.run(), [[original, "l07", "Hai Phong"], [original, "amount", "0"], [original, "note", ""]]);
});

test("Pivot renders zero amounts and keeps a column selector in the footer, including after loading hidden columns", async () => {
  const result = await build({
    stdin: { contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MktLocalNorthPivotTable } from './src/app/pages/01-timesheet/tables/MktLocalNorthPivotTable';
      export function render() {
        return renderToStaticMarkup(React.createElement(MktLocalNorthPivotTable, {
          centerCoverage: { centers: [], inputs: [], expectedCount: 1, isRefreshing: false, refreshMissing() {} },
          rows: [{ business: 'AHN', center: '', chargeToCenterMkt: 'HN0027.OPK', values: { LPAR01: 0 }, total: 0 }],
          types: ['LPAR01', 'LRET01'], grandTotals: { totals: { LPAR01: 0, LRET01: 0 }, grandTotal: 0 },
        }));
      }
    `, resolveDir: process.cwd() },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
  });
  const module = { exports: {} as { render: () => string } };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const visible = module.exports.render();
  assert.match(visible, /aria-label="Columns"/);
  assert.ok(visible.indexOf('aria-label="Columns"') > visible.indexOf("</table>"));
  const dataRow = visible.match(/<tbody[^>]*>\s*<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] || "";
  assert.equal((dataRow.match(/>0<\/td>/g) || []).length, 3); // both task amounts and grand total
  assert.doesNotMatch(dataRow, />[—-]<\/td>/);

  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => key === "dt_hidden_timesheet_pivot" ? '["LPAR01","business"]' : null,
  } } });
  try {
    const hidden = module.exports.render();
    assert.doesNotMatch(hidden, /LPAR01/);
    assert.match(hidden, /<th hidden=""[^>]*>BUSINESS<\/th>/);
    assert.match(hidden, /aria-label="Columns"/);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
