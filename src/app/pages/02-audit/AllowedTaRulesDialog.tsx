import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  AllowedTaRule,
  cloneDefaultAllowedTaRules,
  sanitizeAllowedTaRules,
} from "../../lib/utils/allowed-ta-rules";

interface AllowedTaRulesDialogProps {
  open: boolean;
  rules: AllowedTaRule[];
  onOpenChange: (open: boolean) => void;
  onSave: (rules: AllowedTaRule[]) => void;
}

export function AllowedTaRulesDialog({
  open,
  rules,
  onOpenChange,
  onSave,
}: AllowedTaRulesDialogProps) {
  const [draft, setDraft] = useState<AllowedTaRule[]>(rules);

  const updateRule = (index: number, field: keyof AllowedTaRule, value: string | number) => {
    setDraft((current) => current.map((rule, ruleIndex) => (
      ruleIndex === index ? { ...rule, [field]: value } : rule
    )));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const addRule = () => {
    setDraft((current) => [
      ...current,
      {
        id: `allowed-ta-rule-${Date.now()}`,
        classNameContains: "",
        studentCondition: "> 0",
        result: 0,
      },
    ]);
  };

  const saveRules = () => {
    onSave(sanitizeAllowedTaRules(draft));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden border-slate-300 bg-white p-0">
        <DialogHeader className="border-b border-slate-200 bg-[var(--table-header-bg,#FAF3E8)] px-5 py-4">
          <DialogTitle className="text-sm font-black uppercase tracking-wide text-slate-800">
            Quy tắc Allowed TAs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Hệ thống đọc từ trên xuống. Tên lớp hỗ trợ nhiều từ khóa ngăn cách bằng dấu |; điều kiện hỗ trợ &lt;, &lt;=, &gt;, &gt;=, = hoặc khoảng 1-14.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto px-5 py-4">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-200 text-slate-800">
              <tr>
                <th className="w-[45%] border border-slate-300 px-3 py-2 text-left font-black uppercase">Tên lớp chứa</th>
                <th className="w-[24%] border border-slate-300 px-3 py-2 text-left font-black uppercase">No. Students</th>
                <th className="w-[15%] border border-slate-300 px-3 py-2 text-center font-black uppercase">Result</th>
                <th className="w-[16%] border border-slate-300 px-3 py-2 text-center font-black uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((rule, index) => (
                <tr key={rule.id} className="bg-white even:bg-slate-50">
                  <td className="border border-slate-200 p-1.5">
                    <input
                      value={rule.classNameContains}
                      onChange={(event) => updateRule(index, "classNameContains", event.target.value)}
                      placeholder="Ví dụ: KDG1 | KDG2"
                      className="h-9 w-full rounded-md border border-slate-300 px-2.5 font-semibold outline-none focus:border-primary"
                    />
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    <input
                      value={rule.studentCondition}
                      onChange={(event) => updateRule(index, "studentCondition", event.target.value)}
                      placeholder="Ví dụ: < 15"
                      className="h-9 w-full rounded-md border border-slate-300 px-2.5 font-semibold outline-none focus:border-primary"
                    />
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={rule.result}
                      onChange={(event) => updateRule(index, "result", Math.max(0, Number(event.target.value) || 0))}
                      className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-center font-black outline-none focus:border-primary"
                    />
                  </td>
                  <td className="border border-slate-200 p-1.5">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => moveRule(index, -1)} disabled={index === 0} className="rounded p-1.5 hover:bg-slate-200 disabled:opacity-25" title="Đưa quy tắc lên">
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => moveRule(index, 1)} disabled={index === draft.length - 1} className="rounded p-1.5 hover:bg-slate-200 disabled:opacity-25" title="Đưa quy tắc xuống">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDraft((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="rounded p-1.5 text-rose-600 hover:bg-rose-50" title="Xóa quy tắc">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={addRule} className="mt-3 flex h-9 items-center gap-2 rounded-md border border-dashed border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/5">
            <Plus className="h-3.5 w-3.5" /> Thêm quy tắc
          </button>
          <p className="mt-3 text-[11px] font-medium text-slate-500">
            Quy tắc bắt buộc: khi No. Students bằng 0 thì Allowed TAs luôn bằng 0 và không thể bị ghi đè.
          </p>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setDraft(cloneDefaultAllowedTaRules())} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Mặc định
          </Button>
          <Button type="button" onClick={saveRules} className="gap-2">
            <Save className="h-3.5 w-3.5" /> Lưu quy tắc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
