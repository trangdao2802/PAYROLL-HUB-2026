export interface AllowedTaRule {
  id: string;
  classNameContains: string;
  studentCondition: string;
  result: number;
}

export const DEFAULT_ALLOWED_TA_RULES: AllowedTaRule[] = [
  { id: "kdg12-low", classNameContains: "KDG1 | KDG2", studentCondition: "< 15", result: 2 },
  { id: "kdg12-high", classNameContains: "KDG1 | KDG2", studentCondition: ">= 15", result: 3 },
  { id: "kdg3-low", classNameContains: "KDG3", studentCondition: "< 13", result: 1 },
  { id: "kdg3-high", classNameContains: "KDG3", studentCondition: ">= 13", result: 2 },
  { id: "pri-starter", classNameContains: "PRI STARTER | PRIMARY STARTER", studentCondition: "> 0", result: 2 },
  { id: "pri1-low", classNameContains: "PRI1 | PRIMARY1", studentCondition: "< 15", result: 1 },
  { id: "pri1-high", classNameContains: "PRI1 | PRIMARY1", studentCondition: ">= 15", result: 2 },
  { id: "pri", classNameContains: "PRI | PRIMARY", studentCondition: "> 0", result: 1 },
  { id: "sec-starter", classNameContains: "SEC STARTER | SECONDARY STARTER", studentCondition: "> 0", result: 1 },
];

export function cloneDefaultAllowedTaRules(): AllowedTaRule[] {
  return DEFAULT_ALLOWED_TA_RULES.map((rule) => ({ ...rule }));
}

export function sanitizeAllowedTaRules(value: unknown): AllowedTaRule[] {
  if (!Array.isArray(value)) return cloneDefaultAllowedTaRules();

  return value
    .map((raw, index) => {
      const rule = raw && typeof raw === "object"
        ? raw as Partial<AllowedTaRule>
        : {};
      return {
        id: String(rule.id || `allowed-ta-rule-${index}`),
        classNameContains: String(rule.classNameContains || "").trim(),
        studentCondition: String(rule.studentCondition || "").trim(),
        result: Math.max(0, Number(rule.result) || 0),
      };
    })
    .filter((rule) => rule.classNameContains && rule.studentCondition);
}

function normalizeClassName(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/KINDY/g, "KDG")
    .replace(/KIN(?=\d)/g, "KDG")
    .replace(/PRIMARY/g, "PRI")
    .replace(/SECONDARY/g, "SEC")
    .replace(/[^A-Z0-9]/g, "");
}

function matchesStudentCondition(students: number, condition: string): boolean {
  const normalized = String(condition || "")
    .trim()
    .toUpperCase()
    .replace(/STUDENTS?|HỌC\s*VIÊN|HỌC\s*SINH/g, "")
    .replace(/\s+/g, "");

  if (!normalized || normalized === "*" || normalized === "ALL" || normalized === "ANY") return true;

  const range = normalized.match(/^(\d+(?:\.\d+)?)(?:-|\.\.)(\d+(?:\.\d+)?)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return students >= Math.min(min, max) && students <= Math.max(min, max);
  }

  const comparison = normalized.match(/^(<=|>=|<|>|==|=)?(\d+(?:\.\d+)?)$/);
  if (!comparison) return false;
  const operator = comparison[1] || "=";
  const target = Number(comparison[2]);

  if (operator === "<") return students < target;
  if (operator === "<=") return students <= target;
  if (operator === ">") return students > target;
  if (operator === ">=") return students >= target;
  return students === target;
}

export function evaluateAllowedTAs(
  className: unknown,
  studentsValue: unknown,
  configuredRules?: unknown,
): number {
  const students = Number(studentsValue);
  if (!Number.isFinite(students) || students <= 0) return 0;

  const normalizedClass = normalizeClassName(className);
  if (!normalizedClass) return 0;

  const rules = sanitizeAllowedTaRules(configuredRules);
  for (const rule of rules) {
    const keywords = rule.classNameContains
      .split(/[|,;]+/)
      .map(normalizeClassName)
      .filter(Boolean);
    if (keywords.length === 0 || !keywords.some((keyword) => normalizedClass.includes(keyword))) continue;
    if (matchesStudentCondition(students, rule.studentCondition)) return Math.max(0, Number(rule.result) || 0);
  }

  return 0;
}
