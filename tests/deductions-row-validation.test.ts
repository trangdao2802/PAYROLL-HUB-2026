import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasRequiredDeductionsFields } from "../src/app/lib/utils/deductions-row-validation";

const completeRow = {
  "ID Number": "027307003710",
  "Full name": "NGUYEN THI MAI HIEN",
  BU: "AHN",
  L07: "BN0001.LTT",
};

test("Deductions accepts a HOLD row only when all four identity fields exist", () => {
  assert.equal(hasRequiredDeductionsFields(completeRow), true);

  for (const field of ["ID Number", "Full name", "BU", "L07"] as const) {
    assert.equal(
      hasRequiredDeductionsFields({ ...completeRow, [field]: "   " }),
      false,
      `${field} must be present`,
    );
  }
});

test("Deductions rejects total rows even when they contain a payment amount", () => {
  assert.equal(
    hasRequiredDeductionsFields({
      "TOTAL PAYMENT": 3_575_833,
      "Sheet Source": "Hold T1",
    }),
    false,
  );
});

test("Deductions validation supports normalized legacy field aliases", () => {
  assert.equal(
    hasRequiredDeductionsFields({
      "ID NUMBER": "001206019784",
      "FULL NAME": "NGUYEN ANH VU",
      Business: "AHN",
      L07: "HN0019.NTN",
    }),
    true,
  );
});

test("Master import and hydration both enforce complete Deductions rows", () => {
  const importSource = readFileSync(
    new URL("../src/app/pages/03-master/AEDataConfig.tsx", import.meta.url),
    "utf8",
  );
  const contextSource = readFileSync(
    new URL("../src/app/lib/contexts/AppDataContext.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    importSource,
    /finalHoldData\.filter\(\s*hasRequiredDeductionsFields,?\s*\)/,
  );
  assert.match(
    contextSource,
    /saved\.Hold_AE\.data\.filter\(hasRequiredDeductionsFields\)/,
  );
});
