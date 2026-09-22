import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createLatestTaskQueue } from "../src/app/lib/utils/latest-task-queue";
import { isTimesheetImporting, runTimesheetImport, subscribeTimesheetImports } from "../src/app/lib/utils/timesheet-import-queue";
import { normalizeTimesheetAllocation } from "../src/app/lib/utils/timesheet-edits";

test("rapid link requests run one at a time, stay busy through the queue and recover after a failed link", async () => {
  const states: boolean[] = [];
  const stop = subscribeTimesheetImports(() => states.push(isTimesheetImporting()));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started: number[] = [];
  const first = runTimesheetImport(async () => { started.push(1); await gate; return 1; });
  const failed = runTimesheetImport(async () => { started.push(2); throw new Error("bad link"); });
  const failure = assert.rejects(failed, /bad link/);
  const last = runTimesheetImport(async () => { started.push(3); return 3; });
  await Promise.resolve();
  assert.deepEqual(started, [1]);
  assert.equal(isTimesheetImporting(), true);
  release();
  assert.equal(await first, 1);
  await failure;
  assert.equal(await last, 3);
  assert.deepEqual(started, [1, 2, 3]);
  assert.deepEqual(states, [true, false]);
  stop();
});

test("slow storage keeps only the active snapshot and latest complete state", async () => {
  const saved: number[] = [];
  const errors: unknown[] = [];
  const queue = createLatestTaskQueue(error => errors.push(error));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue.enqueue(async () => { saved.push(0); await gate; throw new Error("storage retry"); });
  await Promise.resolve();
  let last = first;
  for (let i = 1; i <= 100; i++) last = queue.enqueue(async () => { saved.push(i); });
  release();
  await last;
  assert.deepEqual(saved, [0, 100]);
  assert.equal(errors.length, 1);
  await queue.enqueue(async () => { saved.push(101); });
  assert.deepEqual(saved, [0, 100, 101]);
});

test("already normalized raw rows are shared instead of copied on every sync", () => {
  const row = { _uuid: "source-1", chargeToCenterMkt: "HN0027.OPK" };
  assert.equal(normalizeTimesheetAllocation(row), row);
});

test("Excel parsing releases its worker after the last result and recovers after a worker failure", async () => {
  type Reply = { requestId: string; success: boolean; result?: unknown };
  class ParserWorker {
    onmessage: ((event: { data: Reply }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    requests: { requestId: string }[] = [];
    terminated = false;
    constructor() { workers.push(this); }
    postMessage(message: { requestId: string }) { this.requests.push(message); }
    terminate() { this.terminated = true; }
  }
  const workers: ParserWorker[] = [];
  const result = await build({ entryPoints: ["src/app/lib/utils/excel-worker-client.ts"],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "parser-worker-boundary", setup(builder) {
      builder.onResolve({ filter: /^(\.\/data-utils|.*excelParser\.worker\?worker)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "./data-utils" ? `
        let nextId = 0;
        export const generateUUID = () => String(++nextId);
        export const getExcelFileBuffer = async file => ({ buffer: new ArrayBuffer(8), name: file.name });
      ` : "export default ParserWorker;" }));
    } }],
  });
  const module = { exports: {} as { parseExcelInWorker: (file: { name: string }) => Promise<unknown> } };
  new Function("require", "module", "exports", "ParserWorker", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports, ParserWorker);
  const first = module.exports.parseExcelInWorker({ name: "first.xlsx" });
  const second = module.exports.parseExcelInWorker({ name: "second.xlsx" });
  await Promise.resolve();
  const worker = workers[0];
  assert.equal(workers.length, 1);
  worker.onmessage!({ data: { requestId: worker.requests[0].requestId, success: true, result: { rows: [1] } } });
  assert.deepEqual(await first, { rows: [1] });
  assert.equal(worker.terminated, false, "a queued parse still needs this worker");
  worker.onmessage!({ data: { requestId: worker.requests[1].requestId, success: true, result: { rows: [2] } } });
  assert.deepEqual(await second, { rows: [2] });
  assert.equal(worker.terminated, true);
  assert.equal(worker.onmessage, null);
  const failed = module.exports.parseExcelInWorker({ name: "broken.xlsx" });
  const rejected = assert.rejects(failed, /parse failed/);
  await Promise.resolve();
  workers[1].onerror!({ message: "parse failed" });
  await rejected;
  assert.equal(workers[1].terminated, true);
  const recovered = module.exports.parseExcelInWorker({ name: "retry.xlsx" });
  await Promise.resolve();
  workers[2].onmessage!({ data: { requestId: workers[2].requests[0].requestId, success: true, result: { rows: [3] } } });
  assert.deepEqual(await recovered, { rows: [3] });
  assert.equal(workers[2].terminated, true);
});

test("the Timesheet worker waits for each chunk acknowledgement and returns every row and total", async () => {
  const result = await build({ entryPoints: ["src/app/workers/timesheet.worker.ts"], bundle: true,
    write: false, platform: "node", format: "cjs", packages: "external" });
  type Message = { type: string; requestId?: string; field?: string; rows?: Record<string, unknown>[]; chunkId?: number; error?: string };
  const messages: Message[] = [];
  const workerScope = { onmessage: (event: { data: unknown }) => { void event; }, postMessage: (message: Message) => messages.push(structuredClone(message)) };
  const module = { exports: {} };
  new Function("require", "module", "exports", "self", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports, workerScope);
  const count = 4500;
  const rows = Array.from({ length: count }, (_, i) => ({
    _uuid: `source-${i}`, _rowId: "mkt", _sourceFile: "MKT LOCAL NORTH.xlsx", center: "MKT LOCAL NORTH",
    chargeToCenterMkt: "HN0027.OPK", "ID NUMBER": `EMP${i}`, "FULL NAME": `Person ${i}`,
    DATE: "15/09/2026", TYPE: "LPAR01", FROM: "09:00", TO: "11:00",
  }));
  workerScope.onmessage({ data: { type: "timesheet-input-start", requestId: "run-1", params: {
    appData: { Timesheet_InputList: [{ id: "mkt", l07: "MKT LOCAL NORTH" }] },
    preferredYear: 2026, fromDateStr: "2026-09-01", toDateStr: "2026-09-30",
    checkTAsMap: {}, classSizeMap: {}, TASK_COLUMNS: [], resultBackpressure: true,
  } } });
  workerScope.onmessage({ data: { type: "timesheet-input-chunk", requestId: "run-1", field: "rosterData", rows } });
  workerScope.onmessage({ data: { type: "timesheet-input-complete", requestId: "run-1" } });
  assert.equal(messages.length, 2, "only start and the first chunk may be queued");
  assert.equal(messages[0].error, undefined);
  workerScope.onmessage({ data: { type: "timesheet-result-ack", requestId: "stale-run", chunkId: 1 } });
  assert.equal(messages.length, 2);
  const collected: Record<string, Record<string, unknown>[]> = {};
  let receivedComplete = false;
  while (messages.length) {
    const message = messages.shift()!;
    if (message.type === "timesheet-result-chunk") {
      assert.ok(message.rows && message.rows.length <= 2000);
      (collected[message.field!] ||= []).push(...message.rows!);
      assert.equal(messages.length, 0, "producer must wait until the UI has consumed this batch");
      workerScope.onmessage({ data: { type: "timesheet-result-ack", requestId: "run-1", chunkId: message.chunkId } });
    }
    if (message.type === "timesheet-result-complete") receivedComplete = true;
  }
  assert.equal(receivedComplete, true);
  assert.equal(collected.processedRosterData.length, count);
  assert.equal(new Set(collected.processedRosterData.map(row => row._sourceKey)).size, count);
  assert.equal(collected.centerSummary[0].chargeMktLocal, count * 2 * 20000);
});
