export const AUDIT_DISCREPANCY_SHARED_COLUMN_KEYS = [
  "bu",
  "center",
  "className",
  "dateStr",
  "teacherName",
  "teacherHours",
  "numStudents",
  "allowedTAs",
  "actualTAs",
] as const;

const sharedColumnKeys = new Set<string>(
  AUDIT_DISCREPANCY_SHARED_COLUMN_KEYS,
);

/**
 * Session context is shared by every intern row in the same class day.
 * Only the columns through Actual TAs should therefore be merged vertically.
 */
export function isAuditDiscrepancySharedColumn(columnKey: string): boolean {
  return sharedColumnKeys.has(columnKey);
}
