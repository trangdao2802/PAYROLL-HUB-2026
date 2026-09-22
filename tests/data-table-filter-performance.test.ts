import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataTableSource = readFileSync(
  new URL("../src/app/components/DataTable.tsx", import.meta.url),
  "utf8",
);

test("column filter scans large tables without blocking the browser", () => {
  assert.match(dataTableSource, /COLUMN_FILTER_SCAN_CHUNK_SIZE = 2_000/);
  assert.match(dataTableSource, /setTimeout\(processChunk, 0\)/);
});

test("column filter keeps high-cardinality option DOM bounded", () => {
  assert.match(dataTableSource, /COLUMN_FILTER_RENDER_LIMIT = 250/);
  assert.match(
    dataTableSource,
    /visibleValues\.slice\(0, COLUMN_FILTER_RENDER_LIMIT\)/,
  );
  assert.match(dataTableSource, /Nhập từ khóa để thu hẹp kết quả/);
});

test("large table filtering avoids a redundant full-array copy", () => {
  assert.match(dataTableSource, /let result = data/);
  assert.match(dataTableSource, /if \(result === data\) result = \[\.\.\.result\]/);
  assert.match(dataTableSource, /const containsSubtotalRows = useMemo/);
});
