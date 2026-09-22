import { parseMoneyToNumber } from "./data-utils";

export const GROSS_PAY_CHARGE_COLUMNS = [
  "CHARGE TO LXO",
  "CHARGE TO EC",
  "CHARGE TO PT-DEMO",
  "Charge MKT Local",
  "CHARGE TO OTHER",
  "Charge Renewal Projects",
  "Charge Discovery Camp",
  "Charge Summer Outing",
  "Charge Summer Instructors",
  "Extra Summer Instructors",
] as const;

/**
 * Keep the Gross Pay total supplied by Sheet 1 as the source of truth. Some
 * workbooks contain additional charge columns that are not part of the
 * standard display schema, so rebuilding the total from a fixed list can
 * silently discard valid payroll amounts.
 */
export function resolveGrossPayTotal(row: Record<string, unknown>): number {
  const sourceTotal = parseMoneyToNumber(row["TOTAL PAYMENT"]);
  if (sourceTotal !== 0) return sourceTotal;

  return GROSS_PAY_CHARGE_COLUMNS.reduce(
    (sum, column) => sum + parseMoneyToNumber(row[column]),
    0,
  );
}

/**
 * Replace only the Extra Summer Instructors portion of a Gross Pay row.
 * Reapplying the same bonus is idempotent and never rebuilds TOTAL PAYMENT
 * from a partial list of charge columns.
 */
export function applyExtraSummerInstructorBonus(
  row: Record<string, unknown>,
  bonusAmount: unknown,
): Record<string, unknown> {
  const nextBonus = Math.abs(parseMoneyToNumber(bonusAmount));
  const previousBonus =
    Math.abs(parseMoneyToNumber(row["Extra Summer Instructors"])) ||
    Math.abs(
      parseMoneyToNumber(row["CHARGE TO EXTRA SUMMER INSTRUCTORS"]),
    );
  const currentTotal = resolveGrossPayTotal(row);

  return {
    ...row,
    "Extra Summer Instructors": nextBonus,
    "CHARGE TO EXTRA SUMMER INSTRUCTORS": nextBonus,
    "TOTAL PAYMENT": currentTotal - previousBonus + nextBonus,
  };
}
