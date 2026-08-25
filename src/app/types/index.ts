/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CenterInfo {
  l07: string;
  aeCode: string;
  bus: string;
  url?: string;
}

export interface TableData {
  headers: string[];
  data: any[];
}

export interface AEConfig {
  name: string;
  bus: string;
}

export interface AutoMappingRule {
  pattern: string;
  name: string;
  bus: string;
}

export interface PivotConfig {
  headers: Record<string, string>;
  chargeCols: ChargeCol[];
}

export interface ChargeCol {
  key: string;
  code: string;
  label: string;
}

export interface TimesheetDates {
  from: string;
  to: string;
}

export interface AppData {
  globalMonth?: string;
  Timesheet_InputList: any[];
  Final_AE: TableData;
  Bank_North_AE: TableData;
  Sheet1_AE: TableData;
  Hold_AE: TableData;
  SoSanh_AE: TableData;
  AuditReport: TableData;
  BankExport: TableData;
  CustomReport: TableData;
  AE_Map: Record<string, AEConfig>;
  AE_AutoMappingRules: AutoMappingRule[];
  Ae_Global_Inputs: any[];
  PivotConfig: PivotConfig;
  Q_Staff: any[];
  Q_Salary_Scale: any[];
  /** Timesheet-owned roster. Master must never read or mutate this collection. */
  Timesheet_Roster: any[];
  /** Master-owned MKT Local roster used only by Gross Pay/Pivot Master. */
  Master_Roster: any[];
  Q_Cache: any[];
  Q_BonusData?: any[];
  Q_BonusSheetName?: string;
  Timesheet_Dates: TimesheetDates;
  Timesheets: any[];
  TA_Employee_Summary?: TableData;
  TA_Center_Summary?: TableData;
  Q_TeacherHours?: any[];
  Q_TeacherHoursFileName?: string;
  Timesheet_RosterFileName?: string;
  Master_RosterFileName?: string;
  Q_CheckTAsFileName?: string;
  Q_CheckTAs?: any[];
  updatedAt?: any;
  lastSupabaseSyncAt?: string;
  /** Prevent automatic Supabase restore after the user explicitly clears Timesheet. */
  Timesheet_SkipSupabaseRestore?: boolean;
  Timesheet_LocalClearedAt?: string;
  SavedBal_PayrollTrial?: Record<string, any>;
  SavedPeriods_HoldAdd?: Record<string, boolean>;
  SavedRows_HoldAdd?: Record<string, any[] | undefined>;
  SavedRows_HoldAdd_Meta?: Record<
    string,
    { transactionVersion: number; savedAt: string }
  >;
  TransactionActivity?: {
    generatedAt?: string;
    lastSavedAt?: string;
    editCount: number;
    saveVersion: number;
    lastAction: "generated" | "saved";
  };
  TrialBalanceTransactionVersion?: number;
  TrialBalanceTransactionVersions?: Record<string, number>;
  TrialBalanceRefreshedAt?: string;
  ConfirmedIds_HoldAdd?: string[];
  Timesheet_RosterEditHistory?: any[];
}

export interface SalaryRate {
  ac: number;
  ad: number;
  su: number;
  ou: number;
  si: number;
  sCode: string;
}

export interface SalaryScaleDef {
  ac: number;
  ad: number;
  summer: number;
  outing: number;
  summerInstructors: number;
}
