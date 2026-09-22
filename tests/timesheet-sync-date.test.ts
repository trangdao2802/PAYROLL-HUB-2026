import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTimesheetSyncDate,
  getTimesheetSyncDateInfo,
  parseTimesheetSyncDate,
} from "../src/app/lib/utils/timesheet-sync-date";

const SEPTEMBER_SECOND = new Date(2026, 8, 2, 18, 0, 0);

test("parses time-first Vietnamese timestamps without swapping day and month", () => {
  const sameDay = getTimesheetSyncDateInfo(
    "16:23 02/09/2026",
    SEPTEMBER_SECOND,
  );
  const previousDay = getTimesheetSyncDateInfo(
    "15:36 01/09/2026",
    SEPTEMBER_SECOND,
  );
  const olderSource = getTimesheetSyncDateInfo(
    "15:55 20/03/2026",
    SEPTEMBER_SECOND,
  );

  assert.equal(sameDay.status, "fresh");
  assert.equal(sameDay.diffDays, 0);
  assert.equal(sameDay.label, "Mới (Hôm nay)");
  assert.equal(previousDay.status, "recent");
  assert.equal(previousDay.diffDays, 1);
  assert.equal(olderSource.status, "outdated");
  assert.equal(olderSource.diffDays, 166);
});

test("keeps supporting date-first and legacy timestamps without a year", () => {
  assert.equal(
    getTimesheetSyncDateInfo("02/09/2026, 16:23", SEPTEMBER_SECOND)
      .diffDays,
    0,
  );
  assert.equal(
    getTimesheetSyncDateInfo("16:23 01/09", SEPTEMBER_SECOND).diffDays,
    1,
  );
});

test("rejects invalid calendar dates instead of using ambiguous browser parsing", () => {
  assert.equal(parseTimesheetSyncDate("16:23 31/02/2026"), null);
  assert.equal(
    getTimesheetSyncDateInfo("16:23 31/02/2026", SEPTEMBER_SECOND).status,
    "unknown",
  );
});

test("formats every newly stored timestamp in one unambiguous shape", () => {
  assert.equal(
    formatTimesheetSyncDate(new Date(2026, 8, 2, 16, 4)),
    "16:04 02/09/2026",
  );
});
