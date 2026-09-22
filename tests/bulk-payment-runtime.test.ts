import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

test("BulkPayment renders adjustment totals for HOLD, ADD, CANCEL and bonus rows", async () => {
  const result = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { renderToString } from 'react-dom/server';
        import { useBulkPaymentLogic } from './src/app/hooks/useBulkPaymentLogic';
        import { setData } from 'test-app-data';
        import { INITIAL_APP_DATA } from './src/app/constants/initial-data';
        export function calculate(rows) {
          setData({ ...INITIAL_APP_DATA, globalMonth: '09.2026', Hold_AE: { headers: [], data: rows },
            Sheet1_AE: { headers: [], data: [] }, Bank_North_AE: { headers: [], data: [] } });
          let value;
          function Probe() { value = useBulkPaymentLogic(); return null; }
          renderToString(React.createElement(Probe));
          return { ...value.dynamicReportStats, calculationSummary: value.calculationSummary,
            holdPaymentDetails: value.holdPaymentDetails };
        }
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [{
      name: "app-data-boundary",
      setup(builder) {
        builder.onResolve({ filter: /AppDataContext$|^test-app-data$/ }, () => ({ path: "test-app-data", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
          let appData;
          export function setData(value) { appData = value; }
          export function useAppData() { return { appData, updateAppData() {} }; }
        ` }));
      },
    }],
  });
  const module = { exports: {} as { calculate: (rows: Record<string, unknown>[]) => {
    sameMonthHoldTotal: number; sameMonthAddTotal: number; diffMonthAddTotal: number;
    holdAddItems: { type: string; amount: number }[]; finalTotals: Record<string, number>;
    calculationSummary: { holdTotal: number; calculatedTotal: number };
    holdPaymentDetails: { holdAddTotal: number };
  } } };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const row = (fields: Record<string, unknown>) => ({
    "Tháng báo cáo": "09.2026", "Tháng phát sinh": "09.2026", BU: "AHN", ...fields,
  });
  const totals = module.exports.calculate([
    row({ "Nghiệp vụ": "HOLD", "Sheet Source": "HOLD", "TOTAL PAYMENT": -100 }),
    row({ "Nghiệp vụ": "ADD", "Sheet Source": "ADD", "TOTAL PAYMENT": 20 }),
    row({ "Nghiệp vụ": "ADD", "Sheet Source": "ADD", "Tháng phát sinh": "08.2026", "TOTAL PAYMENT": 40 }),
    row({ "Nghiệp vụ": "CANCEL", "TOTAL PAYMENT": -50 }),
    row({ "Trạng thái": "CANCEL", "Tháng phát sinh": "", "TOTAL PAYMENT": -60 }),
    row({ "Tình trạng thanh toán": "CANCEL", "TOTAL PAYMENT": -70 }),
    row({ "Nghiệp vụ": "BONUS", "TOTAL PAYMENT": 500 }),
  ]);
  assert.equal(totals.sameMonthHoldTotal, 100);
  assert.equal(totals.sameMonthAddTotal, 20);
  assert.equal(totals.diffMonthAddTotal, 40);
  assert.equal(totals.holdAddItems.filter(item => item.type === "ADD").reduce((sum, item) => sum + item.amount, 0), 60);
  assert.equal(totals.holdAddItems.filter(item => item.type === "CANCEL").reduce((sum, item) => sum + item.amount, 0), -180);
  assert.equal(totals.finalTotals.AHN, -40);
  assert.equal(totals.calculationSummary.holdTotal, -40);
  assert.equal(totals.holdPaymentDetails.holdAddTotal, -40);

  const edited = module.exports.calculate([
    row({ "Nghiệp vụ": "ADD", "Sheet Source": "HOLD", "Trạng thái": "CANCEL", "TOTAL PAYMENT": -25 }),
    row({ "Nghiệp vụ": "A", "Sheet Source": "CANCEL", "Tháng phát sinh": "08.2026", "TOTAL PAYMENT": -35 }),
    row({ "Nghiệp vụ": "C", "Sheet Source": "ADD", "Tháng phát sinh": "08.2026", "TOTAL PAYMENT": 900 }),
  ]);
  assert.deepEqual(edited.holdAddItems.map(item => [item.type, item.amount]), [["ADD", 25], ["ADD", 35], ["CANCEL", -900]]);
  assert.equal(edited.sameMonthAddTotal, 25);
  assert.equal(edited.diffMonthAddTotal, 35);
  assert.equal(edited.finalTotals.AHN, 60);
  assert.equal(edited.calculationSummary.calculatedTotal, 60);
  assert.equal(edited.holdPaymentDetails.holdAddTotal, 60);
});
