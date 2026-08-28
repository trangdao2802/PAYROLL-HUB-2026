import React, { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  AllowedTaRule,
  cloneDefaultAllowedTaRules,
  sanitizeAllowedTaRules,
} from "../../lib/utils/allowed-ta-rules";

interface AllowedTaRulesTableProps {
  rules: AllowedTaRule[];
  onSave: (rules: AllowedTaRule[]) => void;
}

export function AllowedTaRulesTable({ rules, onSave }: AllowedTaRulesTableProps) {
  const [draft, setDraft] = useState<AllowedTaRule[]>(() => rules.map((rule) => ({ ...rule })));
  const [isDirty, setIsDirty] = useState(false);
  const scrollRegionRef = useRef<HTMLDivElement>(null);

  const validRuleCount = useMemo(
    () => sanitizeAllowedTaRules(draft).length,
    [draft],
  );

  const replaceDraft = (next: AllowedTaRule[]) => {
    setDraft(next);
    setIsDirty(true);
  };

  const updateRule = (index: number, field: keyof AllowedTaRule, value: string | number) => {
    replaceDraft(draft.map((rule, ruleIndex) => (
      ruleIndex === index ? { ...rule, [field]: value } : rule
    )));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.length) return;
    const next = [...draft];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    replaceDraft(next);
  };

  const addRule = () => {
    replaceDraft([
      ...draft,
      {
        id: `allowed-ta-rule-${Date.now()}`,
        classNameContains: "",
        studentCondition: "> 0",
        result: 0,
      },
    ]);
    window.requestAnimationFrame(() => {
      const region = scrollRegionRef.current;
      if (region) region.scrollTo({ top: region.scrollHeight, behavior: "smooth" });
    });
  };

  const saveRules = () => {
    const sanitized = sanitizeAllowedTaRules(draft);
    onSave(sanitized);
    setDraft(sanitized);
    setIsDirty(false);
  };

  const resetRules = () => replaceDraft(cloneDefaultAllowedTaRules());

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--table-data-bg,var(--card,#fff))]">
      <div className="flex min-h-[48px] shrink-0 items-center justify-between gap-3 border-b border-[var(--table-border-color,#d5d8dc)] bg-white/85 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-700">
            Công thức được áp dụng theo thứ tự từ trên xuống.
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            Từ khóa ngăn cách bằng | · Điều kiện hỗ trợ &lt;, &lt;=, &gt;, &gt;=, = hoặc khoảng 1-14.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDirty && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
              Chưa lưu
            </span>
          )}
          <button
            type="button"
            onClick={addRule}
            className="flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-white px-3 text-[10px] font-black uppercase tracking-wide text-primary shadow-xs transition-colors hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm dòng
          </button>
          <button
            type="button"
            onClick={saveRules}
            disabled={!isDirty || validRuleCount === 0}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[10px] font-black uppercase tracking-wide text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Lưu quy tắc
          </button>
        </div>
      </div>

      <div
        ref={scrollRegionRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-auto"
        style={{ scrollbarGutter: "stable" }}
      >
        <table className="min-w-[860px] w-full table-fixed border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20 bg-[var(--table-column-header-bg,#D9C9D0)] text-slate-800 shadow-[0_1px_0_var(--table-border-color,#d5d8dc)]">
            <tr>
              <th className="w-[58px] border-b border-r border-[var(--table-border-color,#d5d8dc)] px-2 py-3 text-center text-[10px] font-black uppercase tracking-wider">
                No.
              </th>
              <th className="w-[42%] border-b border-r border-[var(--table-border-color,#d5d8dc)] px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider">
                Tên lớp chứa
              </th>
              <th className="w-[25%] border-b border-r border-[var(--table-border-color,#d5d8dc)] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider">
                No. Students
              </th>
              <th className="w-[15%] border-b border-r border-[var(--table-border-color,#d5d8dc)] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider">
                Result
              </th>
              <th className="w-[140px] border-b border-[var(--table-border-color,#d5d8dc)] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.map((rule, index) => (
              <tr key={rule.id} className="bg-[var(--table-data-bg,var(--card,#fff))] transition-colors hover:bg-primary/[0.025]">
                <td className="h-[54px] border-b border-r border-[var(--table-border-color,#d5d8dc)] px-2 text-center font-bold tabular-nums text-slate-500">
                  {index + 1}
                </td>
                <td className="border-b border-r border-[var(--table-border-color,#d5d8dc)] p-2">
                  <input
                    value={rule.classNameContains}
                    onChange={(event) => updateRule(index, "classNameContains", event.target.value)}
                    placeholder="Ví dụ: KDG1 | KDG2"
                    aria-label={`Tên lớp chứa, dòng ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-semibold text-slate-800 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </td>
                <td className="border-b border-r border-[var(--table-border-color,#d5d8dc)] p-2">
                  <input
                    value={rule.studentCondition}
                    onChange={(event) => updateRule(index, "studentCondition", event.target.value)}
                    placeholder="Ví dụ: < 15"
                    aria-label={`Điều kiện No. Students, dòng ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-center font-bold tabular-nums text-slate-800 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </td>
                <td className="border-b border-r border-[var(--table-border-color,#d5d8dc)] p-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={rule.result}
                    onChange={(event) => updateRule(index, "result", Math.max(0, Number(event.target.value) || 0))}
                    aria-label={`Kết quả Allowed TAs, dòng ${index + 1}`}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-center font-black tabular-nums text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </td>
                <td className="border-b border-[var(--table-border-color,#d5d8dc)] px-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveRule(index, -1)}
                      disabled={index === 0}
                      className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-20"
                      title="Đưa quy tắc lên"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRule(index, 1)}
                      disabled={index === draft.length - 1}
                      className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-20"
                      title="Đưa quy tắc xuống"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => replaceDraft(draft.filter((_, rowIndex) => rowIndex !== index))}
                      className="rounded-md p-2 text-rose-600 transition-colors hover:bg-rose-50"
                      title="Xóa dòng"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer-pagination flex min-h-[44px] shrink-0 items-center justify-between gap-3 border-t border-[var(--table-border-color,#d5d8dc)] bg-[var(--table-footer-bg,var(--table-header-bg,#FAF3E8))] px-3 py-1.5">
        <div className="text-[11px] font-semibold text-slate-600">
          Hiển thị: <span className="font-black text-slate-800">{draft.length} dòng quy tắc</span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-bold text-slate-500">
            No. Students = 0 → Allowed TAs = 0
          </p>
          <button
            type="button"
            onClick={resetRules}
            className="flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Về mặc định
          </button>
        </div>
      </div>
    </div>
  );
}
