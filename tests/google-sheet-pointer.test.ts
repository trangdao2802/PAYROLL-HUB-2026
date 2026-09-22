import assert from "node:assert/strict";
import test from "node:test";
import { getExcelFileBuffer } from "../src/app/lib/utils/data-utils";

test("Google Sheet pointer accepts URL, document ID and resource ID exports", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)).url);
    return new Response("CENTER,TOTAL PAYMENT\nOcean Park,30000", {
      headers: { "content-type": "text/csv", "x-spreadsheet-name": "payroll.csv" },
    });
  });
  for (const pointer of [
    { url: "https://docs.google.com/spreadsheets/d/payroll-url" },
    { doc_id: "payroll-document" },
    { resource_id: "spreadsheet:payroll-resource" },
  ]) {
    const result = await getExcelFileBuffer(new File([JSON.stringify(pointer)], "payroll.gsheet"));
    assert.equal(result.name, "payroll.csv");
    assert.equal(new TextDecoder().decode(result.buffer), "CENTER,TOTAL PAYMENT\nOcean Park,30000");
  }
  assert.deepEqual(requests, [
    "https://docs.google.com/spreadsheets/d/payroll-url",
    "https://docs.google.com/spreadsheets/d/payroll-document",
    "https://docs.google.com/spreadsheets/d/payroll-resource",
  ]);
});

test("Google Sheet pointer rejects malformed JSON and missing links", async () => {
  await assert.rejects(getExcelFileBuffer(new File(["{bad json"], "payroll.gsheet")), /không hợp lệ/);
  await assert.rejects(getExcelFileBuffer(new File(["{}"], "payroll.gsheet")), /không chứa đường dẫn/);
});
