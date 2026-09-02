import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import type { AppData } from "../src/app/types";
import {
  BANK_TRANSACTION_EXPORT_HEADERS,
  buildHierarchicalWorkbook,
  prepareTransactionBankExportRows,
  type WorkbookExportDefinition,
} from "../src/app/lib/utils/excel-export";
import { createMasterExportDefinition } from "../src/app/lib/utils/master-excel-export";

const isWorksheetCell = (value: unknown): value is XLSX.CellObject =>
  typeof value === "object" && value !== null && "v" in value;

test("bank Transaction export keeps the web row intact but blanks its ID fields", () => {
  const source = {
    id: "row-1",
    "Payment Serial Number": 1,
    "Beneficiary Account No.": "001234567890",
    "Beneficiary Name": "NGUYEN VAN A",
    "Document ID": "001090627040",
    "ID Number": "001090627040",
    "Payment Amount": 1250000,
    "Transaction Currency": "VND",
  };

  const [exported] = prepareTransactionBankExportRows([source]);

  assert.equal(source["Document ID"], "001090627040");
  assert.equal(source["ID Number"], "001090627040");
  assert.equal(exported["Document ID"], "");
  assert.equal(exported["ID Number"], undefined);
  assert.equal(exported["Beneficiary Account No."], "001234567890");
  assert.deepEqual(Object.keys(exported), BANK_TRANSACTION_EXPORT_HEADERS);
});

test("hierarchical export starts with a linked tree index and includes cards beside each table", () => {
  const definition: WorkbookExportDefinition = {
    title: "MASTER",
    fileName: "master.xlsx",
    pages: [
      {
        title: "Gross Pay",
        children: [
          {
            title: "Gross Pay Details",
            sheetName: "Gross Pay",
            table: {
              rows: [
                {
                  "ID Number": "00123",
                  "TOTAL PAYMENT": 1250000,
                  Note: "Không kèm VND",
                  _private: "hidden",
                },
              ],
              cards: [
                { label: "Số nhân viên", value: 1 },
                { label: "Tổng tiền", value: 1250000 },
              ],
            },
          },
        ],
      },
      {
        title: "Bulk Payment",
        children: [
          {
            title: "Transaction",
            sheetName: "Transaction",
            table: { rows: [] },
          },
        ],
      },
    ],
  };

  const workbook = buildHierarchicalWorkbook(definition);

  assert.deepEqual(workbook.SheetNames, ["SƠ ĐỒ", "Gross Pay", "Transaction"]);
  const indexRows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["SƠ ĐỒ"], {
    header: 1,
    defval: "",
  });
  assert.ok(indexRows.flat().some((value) => String(value).includes("Gross Pay")));
  assert.ok(indexRows.flat().some((value) => String(value).includes("Gross Pay Details")));

  const linkedIndexCell = Object.values(workbook.Sheets["SƠ ĐỒ"]).find(
    (cell) => isWorksheetCell(cell) && cell.v === "Gross Pay Details",
  ) as XLSX.CellObject | undefined;
  assert.equal(linkedIndexCell?.l?.Target, "#'Gross Pay'!A1");

  const grossSheet = workbook.Sheets["Gross Pay"];
  const grossRows = XLSX.utils.sheet_to_json<unknown[]>(grossSheet, {
    header: 1,
    defval: "",
  });
  assert.ok(grossRows.flat().includes("THÔNG TIN CARD"));
  assert.ok(grossRows.flat().includes("Số nhân viên"));
  assert.ok(grossRows.flat().includes("ID Number"));
  assert.ok(!grossRows.flat().includes("_private"));

  const amountCell = Object.values(grossSheet).find(
    (cell) => isWorksheetCell(cell) && cell.v === 1250000 && cell.t === "n",
  ) as XLSX.CellObject | undefined;
  assert.equal(amountCell?.z, "#,##0.##");
  assert.ok(!String(amountCell?.z).toUpperCase().includes("VND"));

  const serialized = XLSXStyle.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });
  const reopened = XLSXStyle.read(serialized, { cellStyles: true });
  assert.equal(
    reopened.Sheets["Gross Pay"].A4.s?.fgColor?.rgb,
    "6A1118",
  );
});

test("duplicate or overlong table names become unique Excel-safe sheet names", () => {
  const workbook = buildHierarchicalWorkbook({
    title: "AUDIT",
    fileName: "audit.xlsx",
    pages: [
      {
        title: "Overview",
        children: [
          {
            title: "First",
            sheetName: "A very long invalid []:*?/\\ sheet name",
            table: { rows: [] },
          },
          {
            title: "Second",
            sheetName: "A very long invalid []:*?/\\ sheet name",
            table: { rows: [] },
          },
        ],
      },
    ],
  });

  assert.equal(new Set(workbook.SheetNames).size, workbook.SheetNames.length);
  workbook.SheetNames.forEach((name) => {
    assert.ok(name.length <= 31);
    assert.doesNotMatch(name, /[\\/?*[\]:]/);
  });
});

test("Master batch export covers all four pages and every permanent child table", () => {
  const appData = {
    globalMonth: "02.2026",
    Sheet1_AE: {
      headers: [
        "Tháng báo cáo",
        "BU",
        "L07",
        "ID Number",
        "Full name",
        "TOTAL PAYMENT",
      ],
      data: [
        {
          "Tháng báo cáo": "02.2026",
          BU: "AHN",
          L07: "HN0001.PHY",
          "ID Number": "001",
          "Full name": "EMPLOYEE ONE",
          "TOTAL PAYMENT": 1000,
        },
      ],
    },
    Hold_AE: {
      headers: [
        "Tháng báo cáo",
        "BU",
        "L07",
        "ID Number",
        "Full name",
        "TOTAL PAYMENT",
      ],
      data: [
        {
          "Tháng báo cáo": "02.2026",
          BU: "AHN",
          L07: "HN0001.PHY",
          "ID Number": "001",
          "Full name": "EMPLOYEE ONE",
          "TOTAL PAYMENT": -200,
          "Nghiệp vụ": "HOLD",
        },
        {
          "Tháng báo cáo": "02.2026",
          BU: "",
          L07: "",
          "ID Number": "",
          "Full name": "",
          "TOTAL PAYMENT": -1200,
          "Nghiệp vụ": "HOLD",
        },
      ],
    },
    BankExport: {
      headers: [...BANK_TRANSACTION_EXPORT_HEADERS],
      data: [
        {
          "Payment Serial Number": 1,
          "Beneficiary Account No.": "001122",
          "Beneficiary Name": "EMPLOYEE ONE",
          "Document ID": "001",
          "Payment Amount": 800,
          "Transaction Currency": "VND",
        },
      ],
    },
    Bank_North_AE: { headers: [], data: [] },
    Master_Roster: [],
  } as unknown as AppData;

  const definition = createMasterExportDefinition(appData);
  assert.deepEqual(
    definition.pages.map((page) => page.title),
    ["Gross Pay", "Deductions", "Bulk Payment", "Pivot Master"],
  );

  const flattenTables = (nodes: typeof definition.pages): typeof definition.pages =>
    nodes.flatMap((node) => [node, ...flattenTables(node.children || [])]);
  const masterTables = flattenTables(definition.pages).filter(
    (node) => node.table,
  );
  assert.deepEqual(
    masterTables.map((node) => node.title),
    [
      "Gross Pay Details",
      "Deductions & Benefits",
      "Transaction",
      "Reconciliation by BU",
      "Reconciliation Details",
      "HOLD Lifecycle Analysis",
      "HOLD Employee Details",
      "HOLD Transaction Details",
      "Cost Allocation by BU, L07 & Task Type",
    ],
  );

  const deductions = masterTables.find(
    (node) => node.title === "Deductions & Benefits",
  );
  assert.equal(deductions?.table?.rows.length, 1);

  const transaction = masterTables.find((node) => node.title === "Transaction");
  assert.equal(transaction?.table?.rows[0]?.["Document ID"], "");

  const reconciliation = masterTables.find(
    (node) => node.title === "Reconciliation Details",
  );
  assert.equal(reconciliation?.table?.rows[0]?.["ID Number"], "001");
  assert.equal(reconciliation?.table?.rows[0]?.["Variance"], 0);
});

test("section-wide Excel actions live inside each table action icon, not the navbar", () => {
  const navbar = readFileSync(
    new URL("../src/app/components/layouts/Navbar.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(navbar, /app-export-section-excel/);
  assert.doesNotMatch(navbar, /Excel toàn bộ/);

  const tableMenus = [
    {
      path: "../src/app/pages/01-timesheet/TimesheetHub.tsx",
      action: /onClick=\{handleExportAllExcel\}/,
      label: /Xuất toàn bộ Timesheet/,
    },
    {
      path: "../src/app/pages/02-audit/Audit.tsx",
      action: /onClick=\{handleExportExcel\}/,
      label: /Xuất toàn bộ Audit/,
    },
    {
      path: "../src/app/pages/03-master/MasterAE.tsx",
      action: /onClick=\{handleExportAllExcel\}/,
      label: /Xuất toàn bộ Master/,
    },
    {
      path: "../src/app/pages/04-balance/components/HoldAddDashboard.tsx",
      action: /onClick=\{handleExportExcel\}/,
      label: /Xuất Excel Trial Balance/,
    },
  ];

  for (const { path, action, label } of tableMenus) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, action);
    assert.match(source, label);
    assert.match(source, /downloadHierarchicalWorkbook/);
  }

  for (const sourcePath of [
    "../src/app/pages/03-master/components/HoldAETable.tsx",
    "../src/app/pages/04-balance/BulkPayment.tsx",
    "../src/app/pages/04-balance/PivotSheet.tsx",
  ]) {
    const source = readFileSync(new URL(sourcePath, import.meta.url), "utf8");
    assert.match(source, /app-export-section-excel/);
    assert.match(source, /Xuất toàn bộ Master/);
  }
});

test("Transaction shows ID NUMBER on the web and both bank exports blank it", () => {
  const transactionPage = readFileSync(
    new URL("../src/app/pages/04-balance/BulkPayment.tsx", import.meta.url),
    "utf8",
  );
  const bulkPaymentLogic = readFileSync(
    new URL("../src/app/hooks/useBulkPaymentLogic.ts", import.meta.url),
    "utf8",
  );
  const masterPage = readFileSync(
    new URL("../src/app/pages/03-master/MasterAE.tsx", import.meta.url),
    "utf8",
  );

  assert.match(transactionPage, /label: isDocumentIdCol \? "ID NUMBER" : header/);
  assert.doesNotMatch(transactionPage, /_virtual_docId/);
  assert.match(bulkPaymentLogic, /prepareTransactionBankExportRows/);
  assert.match(masterPage, /prepareTransactionBankExportRows/);
});
