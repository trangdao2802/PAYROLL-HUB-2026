import type { AppData } from "../../types";

export function markTransactionGenerated(
  appData: AppData,
  generatedAt = new Date().toISOString(),
): AppData["TransactionActivity"] {
  return {
    generatedAt,
    lastSavedAt: undefined,
    editCount: 0,
    saveVersion: appData.TransactionActivity?.saveVersion || 0,
    lastAction: "generated",
  };
}

export function markTransactionEdited(
  appData: AppData,
  editedAt = new Date().toISOString(),
): AppData["TransactionActivity"] {
  const current = appData.TransactionActivity;
  return {
    generatedAt: current?.generatedAt || editedAt,
    lastSavedAt: current?.lastSavedAt,
    editCount: (current?.editCount || 0) + 1,
    saveVersion: current?.saveVersion || 0,
    lastAction: "edited",
  };
}

export function hasPendingTransactionEdits(appData: AppData): boolean {
  return appData.TransactionActivity?.lastAction === "edited";
}

export function commitTransactionEdits(
  appData: AppData,
  savedAt = new Date().toISOString(),
  editCountDelta = 0,
): AppData["TransactionActivity"] {
  const current = appData.TransactionActivity;
  return {
    generatedAt: current?.generatedAt || savedAt,
    lastSavedAt: savedAt,
    editCount: (current?.editCount || 0) + Math.max(0, editCountDelta),
    saveVersion: (current?.saveVersion || 0) + 1,
    lastAction: "saved",
  };
}

export function markTransactionSaved(
  appData: AppData,
  savedAt = new Date().toISOString(),
): AppData["TransactionActivity"] {
  const current = appData.TransactionActivity;
  return {
    generatedAt: current?.generatedAt || savedAt,
    lastSavedAt: savedAt,
    editCount: (current?.editCount || 0) + 1,
    saveVersion: (current?.saveVersion || 0) + 1,
    lastAction: "saved",
  };
}
