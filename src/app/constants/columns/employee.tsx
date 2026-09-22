/* eslint-disable @typescript-eslint/no-explicit-any */
import { BASE_TASK_COLUMNS } from "./base-task";

import { formatIdNumber } from "../../lib/utils/data-utils";

export const EMPLOYEE_COLUMNS = [
  { key: "business", label: "Business", type: "text" as const, width: 100, cellClassName: "font-bold text-slate-400" },
  { key: "center", label: "L07", type: "text" as const, width: 100, cellClassName: "font-bold text-slate-500" },
  {
    key: "employeeId",
    label: "ID Number",
    type: "text" as const,
    width: 120,
    headerClassName: "leading-[16.4px]",
    cellClassName: "tabular-nums font-bold text-sky-700 bg-sky-50/30",
    render: (val: any, row: any) => formatIdNumber(val || row.ma_nv || row["ID Number"] || row["Mã NV"] || row["ID"] || "")
  },
  {
    key: "fullName",
    label: "Full Name",
    type: "text" as const,
    width: 220,
    cellClassName: "font-black text-slate-800",
    render: (val: any, row: any) => val || row.full_name || row["Full Name"] || row["Họ tên"] || row["Họ và tên"] || row.name || ""
  },
  { key: "bankAccountNumber", label: "Bank Account", type: "text" as const, width: 140, cellClassName: "tabular-nums text-slate-500 text-[11px]", hidden: true },
  {
    key: "salaryScale",
    label: "Salary Scale",
    type: "text" as const,
    width: 120,
    cellClassName: "font-bold text-slate-600",
    hidden: true
  },
  { key: "from", label: "From", type: "date" as const, width: 100, cellClassName: "text-slate-400", hidden: true },
  { key: "to", label: "To", type: "date" as const, width: 100, cellClassName: "text-slate-400", hidden: true },
  ...BASE_TASK_COLUMNS,
  { key: "baseSalary", label: "Base Salary", type: "currency" as const, width: 140, cellClassName: "font-bold text-slate-700" },
  { key: "totalSalary", label: "Total Salary", type: "currency" as const, width: 140, cellClassName: "font-black text-indigo-700 bg-indigo-50/50" },
  { key: "chargeLxo", label: "Charge LXO", type: "currency" as const, width: 140 },
  { key: "chargeEc", label: "Charge EC", type: "currency" as const, width: 140 },
  { key: "chargePtDemo", label: "Charge PT-DEMO", type: "currency" as const, width: 140 },
  { key: "chargeMktLocal", label: "Charge MKT Local", type: "currency" as const, width: 150, cellClassName: "bg-emerald-50/50 font-bold text-emerald-700" },
  { key: "chargeOther", label: "Charge to Other", type: "currency" as const, width: 150, cellClassName: "bg-amber-50/50 font-bold text-amber-700" },
  { key: "chargeRenewalProjects", label: "Charge Renewal", type: "currency" as const, width: 140 },
  { key: "chargeDiscoveryCamp", label: "Charge Discovery", type: "currency" as const, width: 140 },
  { key: "chargeSummerOuting", label: "Charge Summer Outing", type: "currency" as const, width: 140 },
  { key: "chargeSummerInstructors", label: "Charge Summer Instructors", type: "currency" as const, width: 140 },
  { key: "className", label: "Class Name", type: "text" as const, width: 150, cellClassName: "font-bold text-slate-500 italic", hidden: true },
  { key: "noteDays", label: "Note", type: "text" as const, width: 220, cellClassName: "text-slate-800 whitespace-pre-wrap leading-relaxed font-medium", hidden: true },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDynamicEmployeeColumns(_rosterData: Record<string, unknown>[]) {
  const found = new Set<string>();
  
  const standards = ["LPAR01", "LRET01", "LDEM01", "LDEC01"];
  const extras = Array.from(found).filter(x => !standards.includes(x));
  extras.sort();

  const extraCols = extras.map(type => ({
    key: type.toLowerCase(),
    label: type,
    type: "number" as const,
    width: 90,
    headerSpanClassName: "text-[0.7rem] font-bold text-slate-800",
    cellClassName: "bg-slate-50/50"
  }));

  const baseTaskCols: Record<string, unknown>[] = [];
  BASE_TASK_COLUMNS.forEach(col => {
    if (col.key === "totalHours") {
      baseTaskCols.push(...extraCols);
    }
    baseTaskCols.push(col);
  });

  return [
    { key: "business", label: "Business", type: "text" as const, width: 100, cellClassName: "font-bold text-slate-400" },
    { key: "center", label: "L07", type: "text" as const, width: 100, cellClassName: "font-bold text-slate-500" },
    {
      key: "employeeId",
      label: "ID Number",
      type: "text" as const,
      width: 120,
      headerClassName: "leading-[16.4px]",
      cellClassName: "tabular-nums font-bold text-sky-700 bg-sky-50/30",
      render: (val: any, row: any) => val || row.ma_nv || row["ID Number"] || row["Mã NV"] || row["ID"] || ""
    },
    {
      key: "fullName",
      label: "Full Name",
      type: "text" as const,
      width: 220,
      cellClassName: "font-black text-slate-800",
      render: (val: any, row: any) => val || row.full_name || row["Full Name"] || row["Họ tên"] || row["Họ và tên"] || row.name || ""
    },
    { key: "bankAccountNumber", label: "Bank Account", type: "text" as const, width: 140, cellClassName: "tabular-nums text-slate-500 text-[11px]", hidden: true },
    {
      key: "salaryScale",
      label: "Salary Scale",
      type: "text" as const,
      width: 120,
      cellClassName: "font-bold text-slate-600",
      hidden: true
    },
    { key: "from", label: "From", type: "date" as const, width: 100, cellClassName: "text-slate-400", hidden: true },
    { key: "to", label: "To", type: "date" as const, width: 100, cellClassName: "text-slate-400", hidden: true },
    ...baseTaskCols,
    { key: "baseSalary", label: "Base Salary", type: "currency" as const, width: 140, cellClassName: "font-bold text-slate-700" },
    { key: "totalSalary", label: "Total Salary", type: "currency" as const, width: 140, cellClassName: "font-black text-indigo-700 bg-indigo-50/50" },
    { key: "chargeLxo", label: "Charge LXO", type: "currency" as const, width: 140 },
    { key: "chargeEc", label: "Charge EC", type: "currency" as const, width: 140 },
    { key: "chargePtDemo", label: "Charge PT-DEMO", type: "currency" as const, width: 140 },
    { key: "chargeMktLocal", label: "Charge MKT Local", type: "currency" as const, width: 150, cellClassName: "bg-emerald-50/50 font-bold text-emerald-700" },
    { key: "chargeOther", label: "Charge to Other", type: "currency" as const, width: 150, cellClassName: "bg-amber-50/50 font-bold text-amber-700" },
    { key: "chargeRenewalProjects", label: "Charge Renewal", type: "currency" as const, width: 140 },
    { key: "chargeDiscoveryCamp", label: "Charge Discovery", type: "currency" as const, width: 140 },
    { key: "chargeSummerOuting", label: "Charge Summer Outing", type: "currency" as const, width: 140 },
    { key: "chargeSummerInstructors", label: "Charge Summer Instructors", type: "currency" as const, width: 140 },
    { key: "className", label: "Class Name", type: "text" as const, width: 150, cellClassName: "font-bold text-slate-500 italic", hidden: true },
    { key: "noteDays", label: "Note", type: "text" as const, width: 220, cellClassName: "text-slate-800 whitespace-pre-wrap leading-relaxed font-medium", hidden: true },
  ];
}
