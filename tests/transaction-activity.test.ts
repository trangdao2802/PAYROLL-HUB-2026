import assert from "node:assert/strict";
import test from "node:test";
import type { AppData } from "../src/app/types";
import {
  commitTransactionEdits,
  hasPendingTransactionEdits,
  markTransactionEdited,
  markTransactionSaved,
} from "../src/app/lib/utils/transaction-activity";

const appDataWithActivity = (
  activity: AppData["TransactionActivity"],
) => ({ TransactionActivity: activity }) as AppData;

test("editing Transaction creates a pending edit without advancing the saved version", () => {
  const appData = appDataWithActivity({
    generatedAt: "2026-09-08T08:00:00.000Z",
    lastSavedAt: "2026-09-08T09:00:00.000Z",
    editCount: 2,
    saveVersion: 4,
    lastAction: "saved",
  });

  const activity = markTransactionEdited(
    appData,
    "2026-09-08T10:00:00.000Z",
  );

  assert.equal(activity?.lastAction, "edited");
  assert.equal(activity?.editCount, 3);
  assert.equal(activity?.saveVersion, 4);
  assert.equal(activity?.lastSavedAt, "2026-09-08T09:00:00.000Z");
  assert.equal(
    hasPendingTransactionEdits(appDataWithActivity(activity)),
    true,
  );
});

test("saving pending Transaction edits advances one version without double-counting edits", () => {
  const pending = appDataWithActivity({
    generatedAt: "2026-09-08T08:00:00.000Z",
    lastSavedAt: "2026-09-08T09:00:00.000Z",
    editCount: 3,
    saveVersion: 4,
    lastAction: "edited",
  });

  const activity = commitTransactionEdits(
    pending,
    "2026-09-08T10:30:00.000Z",
  );

  assert.equal(activity?.lastAction, "saved");
  assert.equal(activity?.editCount, 3);
  assert.equal(activity?.saveVersion, 5);
  assert.equal(activity?.lastSavedAt, "2026-09-08T10:30:00.000Z");
  assert.equal(
    hasPendingTransactionEdits(appDataWithActivity(activity)),
    false,
  );
});

test("an explicit Transaction operation still counts as one edit and one save", () => {
  const appData = appDataWithActivity({
    generatedAt: "2026-09-08T08:00:00.000Z",
    editCount: 0,
    saveVersion: 1,
    lastAction: "generated",
  });

  const activity = markTransactionSaved(appData, "2026-09-08T11:00:00.000Z");

  assert.equal(activity?.editCount, 1);
  assert.equal(activity?.saveVersion, 2);
});
