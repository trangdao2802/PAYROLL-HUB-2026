import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSnapshotStats,
  saveSnapshot,
  getSnapshotsList,
  getSnapshotById,
  restoreSnapshot,
  deleteSnapshot,
  togglePinSnapshot,
  renameSnapshot,
} from "../src/app/lib/utils/snapshot-manager";
import type { AppData } from "../src/app/types";

test("calculateSnapshotStats correctly tallies rows from all tables", () => {
  const dummyAppData = {
    globalMonth: "2026-03",
    Timesheet_Roster: [
      { id: "1", name: "Nguyen Van A" },
      { id: "2", name: "Tran Thi B" },
    ],
    Master_Roster: [
      { id: "1", name: "Nguyen Van A" },
    ],
    Q_Staff: [
      { id: "1", name: "Nguyen Van A" },
    ],
    Q_Salary_Scale: [],
  } as unknown as AppData;

  const stats = calculateSnapshotStats(dummyAppData);
  assert.equal(stats.timesheetRows, 2);
  assert.equal(stats.masterRows, 1);
  assert.equal(stats.staffRows, 1);
  assert.equal(stats.salaryScaleRows, 0);
  assert.equal(stats.totalRows, 4);
});

test("saveSnapshot and getSnapshotsList manages version history lifecycle", async () => {
  const dummyAppData = {
    globalMonth: "2026-03",
    Timesheet_Roster: [{ id: "101", code: "EMP01" }],
    Master_Roster: [],
    Q_Staff: [],
    Q_Salary_Scale: [],
  } as unknown as AppData;

  const meta = await saveSnapshot(dummyAppData, {
    title: "Chốt dữ liệu trước tính lương",
    trigger: "manual",
    note: "Kiểm tra phiên bản",
    isPinned: true,
  });

  assert.ok(meta.id.startsWith("snap_"));
  assert.equal(meta.title, "Chốt dữ liệu trước tính lương");
  assert.equal(meta.isPinned, true);
  assert.equal(meta.stats.timesheetRows, 1);

  const list = await getSnapshotsList();
  const found = list.find((item) => item.id === meta.id);
  assert.ok(found, "Saved snapshot must be present in index");

  const detailed = await getSnapshotById(meta.id);
  assert.ok(detailed, "Full snapshot data must be retrievable");
  assert.equal(detailed.data.Timesheet_Roster?.length, 1);

  // Toggle pin
  const nextPinned = await togglePinSnapshot(meta.id);
  assert.equal(nextPinned, false);

  // Rename
  await renameSnapshot(meta.id, "Tên mới sau chỉnh sửa");
  const renamed = await getSnapshotById(meta.id);
  assert.equal(renamed?.title, "Tên mới sau chỉnh sửa");

  // Restore
  const currentData = {
    globalMonth: "2026-03",
    Timesheet_Roster: [{ id: "999", code: "CHANGED" }],
  } as unknown as AppData;

  const { restoredData, meta: restoredMeta } = await restoreSnapshot(
    meta.id,
    currentData as AppData,
  );
  assert.equal(restoredMeta.id, meta.id);
  assert.equal(restoredData.Timesheet_Roster?.[0]?.id, "101");

  // Delete
  await deleteSnapshot(meta.id);
  const deleted = await getSnapshotById(meta.id);
  assert.equal(deleted, null);
});
