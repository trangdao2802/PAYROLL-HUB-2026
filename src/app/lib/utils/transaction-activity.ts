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
