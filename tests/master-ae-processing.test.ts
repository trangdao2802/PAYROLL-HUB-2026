import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as XLSX from "xlsx";
import { INITIAL_APP_DATA } from "../src/app/constants/initial-data";
import { processMasterAEData, type MasterAEProcessingContext } from "../src/app/lib/utils/master-ae-processing";
import { parseMasterWorkbook } from "../src/app/workers/masterImport.worker";

function importHarness(t: TestContext, file: File) {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  const events = new EventTarget();
  const descriptors = new Map(["window", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { configurable: true, value: events });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  let data = structuredClone(INITIAL_APP_DATA);
  data.globalMonth = "08.2026";
  data.Ae_Global_Inputs = [{ id: "import-1", name: file.name, fileObj: file, status: "ready", bank: "NORTH", month: "08.2026" }];
  const processing: boolean[] = [];
  let completions = 0;
  const context: MasterAEProcessingContext = {
    appData: data,
    updateAppData: (updater) => { data = updater(data); },
    preparedMasterFiles: new Map(),
    parseMasterFileInWorker: parseMasterWorkbook,
    masterAeFields: [],
    setIsProcessing: (value) => { processing.push(value); },
    setProgress: () => {},
    setProcessingMessage: () => {},
    onComplete: () => { completions++; },
  };
  return { context, storage, processing, data: () => data, completions: () => completions };
}

test("Master import retains salary totals, complete Deductions and Pivot cache after processing extraction", async (t) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["ID Number", "Full name", "Center", "CHARGE TO LXO", "TOTAL PAYMENT"],
    ["001090627040", "Nguyen Van A", "Ocean Park", 120000, 120000],
  ]), "Sheet 1");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["ID Number", "Full name", "Center", "TOTAL PAYMENT", "Note"],
    ["001090627040", "Nguyen Van A", "Ocean Park", 20000, "Hold tháng 08.2026"],
    ["", "Tổng cộng", "", 20000, ""],
  ]), "HOLD T8");
  const file = new File([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], "NORTH 08.2026.xlsx");
  const harness = importHarness(t, file);
  await processMasterAEData(harness.context);

  const data = harness.data();
  assert.deepEqual(harness.processing, [true, false]);
  assert.equal(harness.completions(), 1);
  assert.equal(data.Ae_Global_Inputs[0].status, "Success");
  assert.equal(data.Sheet1_AE.data.length, 1);
  assert.equal(data.Sheet1_AE.data[0]["TOTAL PAYMENT"], 120000);
  assert.equal(data.Sheet1_AE.data[0].L07, "HN0027.OPK");
  assert.equal(data.Hold_AE.data.length, 1);
  assert.equal(data.Hold_AE.data[0]["ID Number"], "001090627040");
  assert.equal(Math.abs(data.Hold_AE.data[0]["TOTAL PAYMENT"]), 20000);
  assert.equal(data.Hold_AE.data[0]["Tháng báo cáo"], "08.2026");
  const cache = JSON.parse(harness.storage.get("pivot_master_processed_data") || "null");
  assert.equal(cache.reportingMonth, "08.2026");
  assert.equal(cache.groupedData.AHN["HN0027.OPK"]["08.2026"].LXO, 120000);
  assert.deepEqual(cache.diagnosticLogs, []);
  assert.equal(harness.context.preparedMasterFiles.size, 0);
});

test("Master import clears processing state and marks failed files without completing", async (t) => {
  const harness = importHarness(t, new File(["invalid"], "NORTH.xlsx"));
  harness.context.parseMasterFileInWorker = async () => { throw new Error("Cannot read workbook"); };
  await processMasterAEData(harness.context);
  assert.deepEqual(harness.processing, [true, false]);
  assert.equal(harness.data().Ae_Global_Inputs[0].status, "Error: Cannot read workbook");
  assert.equal(harness.completions(), 0);
  assert.equal(harness.context.preparedMasterFiles.size, 0);
  assert.equal(harness.data().Sheet1_AE.data.length, 0);
});
