import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAuditDaysForPeriod,
  aggregateAuditDaysByMonth,
  summarizeAuditDay,
} from "../src/app/lib/utils/audit-overview";
import { DEFAULT_ALLOWED_TA_RULES } from "../src/app/lib/utils/allowed-ta-rules";
import { runAuditComputation } from "../src/app/workers/audit.worker";

test("one class day counts one teacher and distinct TAs", () => {
  const day = summarizeAuditDay("05/03/2026", {
    teacher: [
      { name: "Teacher A", hours: 2, allowedTAs: 1 },
      { name: "Teacher A duplicate", hours: 2, allowedTAs: 1 },
    ],
    ta: [
      { id: "TA001", name: "Intern One", hours: 2 },
      { id: "TA001", name: "Intern One", hours: 1 },
      { id: "TA002", name: "Intern Two", hours: 2 },
    ],
  });

  assert.equal(day.teacherHours, 2);
  assert.equal(day.actualTAs, 2);
  assert.equal(day.allowedTAs, 1);
  assert.equal(day.isOverAllowed, true);
  assert.equal(day.overBy, 1);
});

test("TA hours do not create a violation when headcount is within Allowed TAs", () => {
  const day = summarizeAuditDay("06/03/2026", {
    teacher: [{ name: "Teacher A", hours: 1.5, allowedTAs: 2 }],
    ta: [{ id: "TA001", name: "Intern One", hours: 12 }],
  });

  assert.equal(day.actualTAs, 1);
  assert.equal(day.allowedTAs, 2);
  assert.equal(day.isOverAllowed, false);
});

test("monthly overview counts the number of over-limit class days", () => {
  const marchDays = [
    summarizeAuditDay("01/03/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 1 }],
      ta: [{ id: "TA001", hours: 2 }],
    }),
    summarizeAuditDay("08/03/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 1 }],
      ta: [{ id: "TA001", hours: 2 }, { id: "TA002", hours: 2 }],
    }),
    summarizeAuditDay("15/03/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 2 }],
      ta: [
        { id: "TA001", hours: 2 },
        { id: "TA002", hours: 2 },
        { id: "TA003", hours: 2 },
      ],
    }),
  ];
  const aprilDay = summarizeAuditDay("02/04/2026", {
    teacher: [{ name: "Teacher A", hours: 1.5, allowedTAs: 1 }],
    ta: [{ id: "TA001", hours: 1.5 }],
  });

  const summaries = aggregateAuditDaysByMonth([...marchDays, aprilDay]);

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((summary) => summary.month),
    ["03.2026", "04.2026"],
  );
  assert.equal(summaries[0].teacherHours, 6);
  assert.equal(summaries[0].classDays, 3);
  assert.equal(summaries[0].overAllowedDays, 2);
  assert.equal(summaries[0].withinAllowedDays, 1);
});

test("report-period overview keeps class dates across calendar months in one summary", () => {
  const days = [
    summarizeAuditDay("23/07/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 1 }],
      ta: [],
    }),
    summarizeAuditDay("30/07/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 1 }],
      ta: [],
    }),
    summarizeAuditDay("06/08/2026", {
      teacher: [{ name: "Teacher A", hours: 2, allowedTAs: 1 }],
      ta: [],
    }),
  ];

  const summary = aggregateAuditDaysForPeriod(days, "08.2026");

  assert.equal(summary.month, "08.2026");
  assert.equal(summary.classDays, 3);
  assert.equal(summary.teacherHours, 6);
  assert.deepEqual(
    summary.days.map((day) => day.date),
    ["23/07/2026", "30/07/2026", "06/08/2026"],
  );
});

test("audit worker returns monthly teacher hours and days over Allowed TAs", () => {
  const fileAData = [
    ["Center", "Class", "Teacher", "Type", "Students", "Schedule Date", ""],
    ["", "", "", "", "", "01/03/2026", "08/03/2026"],
    ["HN0001.PHY", "PHY PRI1 0001", "Teacher A", "Normal Class", 10, 2, 2],
  ];
  const rosterData = [
    { l07: "HN0001.PHY", class: "PHY PRI1 0001", date: "01/03/2026", type: "IN-CLASS", id: "TA001", "full name": "TA One", hours: 2 },
    { l07: "HN0001.PHY", class: "PHY PRI1 0001", date: "01/03/2026", type: "IN-CLASS", id: "TA002", "full name": "TA Two", hours: 2 },
    { l07: "HN0001.PHY", class: "PHY PRI1 0001", date: "08/03/2026", type: "IN-CLASS", id: "TA001", "full name": "TA One", hours: 12 },
  ];

  const result = runAuditComputation({
    fileAData,
    rosterData,
    fromDate: "",
    toDate: "",
    checkTAsDataRaw: [],
    fileNameA: "audit_01032026_",
    centerMappingParam: {},
    allowedTaRules: DEFAULT_ALLOWED_TA_RULES,
  });

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].reportMonth, "03.2026");
  assert.equal(result.results[0].teacherHours, 4);
  assert.equal(result.results[0].classDays, 2);
  assert.equal(result.results[0].overAllowedDays, 1);
  assert.equal(result.results[0].status, "Review Required");
  assert.equal(result.results[0].dailySummaries[1].actualTAs, 1);
  assert.equal(result.results[0].dailySummaries[1].isOverAllowed, false);
});

test("audit worker returns one class row and counts only unique MR03 teaching dates", () => {
  const dates = [
    "23/07/2026",
    "25/07/2026",
    "30/07/2026",
    "01/08/2026",
    "06/08/2026",
    "08/08/2026",
    "13/08/2026",
    "15/08/2026",
    "20/08/2026",
  ];
  const fileAData = [
    ["Center", "Class", "Teacher", "Type", "Students", "Schedule Date", ...dates.slice(1)],
    ["", "", "", "", "", ...dates],
    ["BN0001.LTT", "NSL - PRI1 - 0138", "Giulia Cirillo", "Normal Class", 10, 2, 0, 2, 0, 2, 0, 2, 0, 2],
    ["BN0001.LTT", "NSL - PRI1 - 0138", "Helen May Famoso Custodio", "Normal Class", 10, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    ["BN0001.LTT", "NSL - PRI1 - 0138", "Vikramjeet Singh Kalsi", "Normal Class", 10, 0, 0, 0, 2, 0, 2, 0, 2, 0],
  ];
  const rosterData = [
    ...dates.map((date, index) => ({
      l07: "BN0001.LTT",
      class: "NSL - PRI1 - 0138",
      date,
      type: "IN-CLASS",
      id: `TA${String(index + 1).padStart(3, "0")}`,
      "full name": `TA ${index + 1}`,
      hours: 2,
    })),
    {
      l07: "BN0001.LTT",
      class: "NSL - PRI1 - 0138",
      date: "28/07/2026",
      type: "IN-CLASS",
      id: "TA999",
      "full name": "TA on non-teaching date",
      hours: 2,
    },
  ];

  const result = runAuditComputation({
    fileAData,
    rosterData,
    fromDate: "2026-07-21",
    toDate: "2026-08-20",
    checkTAsDataRaw: [],
    fileNameA: "MR03_21072026_20082026.xlsx",
    centerMappingParam: {},
    allowedTaRules: DEFAULT_ALLOWED_TA_RULES,
  });

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].className, "NSL - PRI1 - 0138");
  assert.equal(result.results[0].reportMonth, "08.2026");
  assert.equal(result.results[0].teacherHours, 18);
  assert.equal(result.results[0].classDays, 9);
  assert.equal(result.results[0].dailySummaries.length, 9);
  assert.equal(
    result.results[0].dailySummaries.some(
      (day: { date?: string }) => day.date === "28/07/2026",
    ),
    false,
  );
});
