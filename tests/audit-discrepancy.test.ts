import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_DISCREPANCY_SHARED_COLUMN_KEYS,
  isAuditDiscrepancySharedColumn,
} from "../src/app/lib/utils/audit-discrepancy";
import {
  applyContiguousRowSpans,
  sortRowsPreservingGroupBlocks,
} from "../src/app/lib/utils/row-span-utils";

test("Audit Discrepancy merges the shared session context through Actual TAs", () => {
  assert.deepEqual(AUDIT_DISCREPANCY_SHARED_COLUMN_KEYS, [
    "bu",
    "center",
    "className",
    "dateStr",
    "teacherName",
    "teacherHours",
    "numStudents",
    "allowedTAs",
    "actualTAs",
  ]);

  for (const key of AUDIT_DISCREPANCY_SHARED_COLUMN_KEYS) {
    assert.equal(isAuditDiscrepancySharedColumn(key), true);
  }
});

test("Audit Discrepancy keeps intern details as separate rows", () => {
  for (const key of ["taId", "taName", "taHours", "variance", "actions"]) {
    assert.equal(isAuditDiscrepancySharedColumn(key), false);
  }
});

test("shared cells merge once while intern cells remain independent", () => {
  const rows = [
    { groupId: "session-1", bu: "AHN", actualTAs: 2, taId: "TA002" },
    { groupId: "session-1", bu: "AHN", actualTAs: 2, taId: "TA001" },
    { groupId: "session-2", bu: "AHN", actualTAs: 2, taId: "TA003" },
  ];

  const merged = applyContiguousRowSpans(rows, ["bu", "actualTAs"]);

  assert.deepEqual(merged[0]._rowSpans, { bu: 2, actualTAs: 2 });
  assert.deepEqual(merged[1]._rowSpans, { bu: 0, actualTAs: 0 });
  assert.deepEqual(merged[2]._rowSpans, { bu: 1, actualTAs: 1 });
  assert.equal(merged[0]._rowSpans?.taId, undefined);
});

test("sorting intern rows never separates their shared session group", () => {
  const rows = [
    { groupId: "session-1", taId: "TA003" },
    { groupId: "session-2", taId: "TA002" },
    { groupId: "session-1", taId: "TA001" },
  ];

  const sorted = sortRowsPreservingGroupBlocks(rows, (left, right) =>
    String(left.taId).localeCompare(String(right.taId)),
  );

  assert.deepEqual(
    sorted.map((row) => row.groupId),
    ["session-1", "session-1", "session-2"],
  );
  assert.deepEqual(
    sorted.map((row) => row.taId),
    ["TA001", "TA003", "TA002"],
  );
});
