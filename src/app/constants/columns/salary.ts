export const SALARY_COLUMNS = [
  { key: "deductionHours", label: "Deduction Hours", type: "number" as const, width: 140 },
  { key: "baseSalary", label: "Base Salary", type: "currency" as const, width: 140 },
  { key: "totalSalary", label: "Total Salary", type: "currency" as const, width: 140 },
  { key: "chargeMktLocal", label: "Charge MKT Local", type: "currency" as const, width: 150 },
  { key: "chargeOther", label: "Charge to Other", type: "currency" as const, width: 150 },
];
