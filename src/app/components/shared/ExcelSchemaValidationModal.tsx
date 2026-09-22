/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, ShieldCheck, ArrowRight } from "lucide-react";
import { validateExcelDataset, ExcelValidationSummary, ValidatedExcelRow } from "../../lib/schemas/excel-schema";

interface ExcelSchemaValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  rawData: Record<string, any>[];
  onProceed?: (validRows: ValidatedExcelRow[]) => void;
}

export function ExcelSchemaValidationModal({
  isOpen,
  onClose,
  fileName,
  rawData,
  onProceed,
}: ExcelSchemaValidationModalProps) {
  const { summary, validRows } = React.useMemo(() => {
    if (!rawData || rawData.length === 0) {
      return {
        summary: null as ExcelValidationSummary | null,
        validRows: [] as ValidatedExcelRow[],
      };
    }
    return validateExcelDataset(rawData);
  }, [rawData]);

  if (!summary) return null;

  const { headerValidation, isValid, totalRows, validRowsCount, invalidRowsCount, invalidRowsDetails } = summary;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isValid ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
              {isValid ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">
                Kiểm tra Định dạng File Excel (Zod Schema)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {fileName ? `File: ${fileName}` : "Kiểm tra cấu trúc cột và kiểu dữ liệu trước khi xử lý"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header Validation Status */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              1. Trạng thái kiểm tra Cột Bắt buộc
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Charge to Center", key: "CHARGE_TO_CENTER", matched: headerValidation.matchedHeaders["CHARGE_TO_CENTER"] },
                { label: "Duration", key: "DURATION", matched: headerValidation.matchedHeaders["DURATION"] },
                { label: "Type", key: "TYPE", matched: headerValidation.matchedHeaders["TYPE"] },
              ].map((item) => (
                <div
                  key={item.key}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    item.matched
                      ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : "bg-rose-50/50 border-rose-200/80 text-rose-950 dark:bg-rose-950/20 dark:border-rose-800"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold truncate">{item.label}</p>
                    <p className="text-[0.6875rem] text-muted-foreground truncate">
                      {item.matched ? `Gắn với: "${item.matched}"` : "Khuyết cột"}
                    </p>
                  </div>
                  {item.matched ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {!headerValidation.isValid && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                {headerValidation.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Row Metrics */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              2. Kết quả Thẩm định Dòng Dữ liệu ({totalRows} dòng)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-muted/40 rounded-xl border text-center">
                <span className="block text-[0.6875rem] text-muted-foreground uppercase font-bold">Tổng dòng</span>
                <span className="text-lg font-black">{totalRows}</span>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <span className="block text-[0.6875rem] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Hợp lệ</span>
                <span className="text-lg font-black text-emerald-600">{validRowsCount}</span>
              </div>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                <span className="block text-[0.6875rem] text-rose-700 dark:text-rose-400 uppercase font-bold">Lỗi schema</span>
                <span className="text-lg font-black text-rose-600">{invalidRowsCount}</span>
              </div>
            </div>
          </div>

          {/* Invalid Rows Details */}
          {invalidRowsCount > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                Chi tiết dòng lỗi ({invalidRowsDetails.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10 p-3 space-y-2 text-xs">
                {invalidRowsDetails.slice(0, 15).map((detail, idx) => (
                  <div key={idx} className="border-b border-rose-100 dark:border-rose-900/50 pb-1.5 last:border-0 last:pb-0">
                    <span className="font-bold text-rose-800 dark:text-rose-300">Dòng {detail.rowIndex}: </span>
                    <span className="text-muted-foreground">{detail.errors.join(", ")}</span>
                  </div>
                ))}
                {invalidRowsDetails.length > 15 && (
                  <p className="text-[0.6875rem] text-muted-foreground italic text-center pt-1">
                    ...và {invalidRowsDetails.length - 15} dòng khác có cảnh báo.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            Đóng
          </button>
          {onProceed && (
            <button
              onClick={() => {
                onProceed(validRows);
                onClose();
              }}
              disabled={validRowsCount === 0}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              <span>Tiếp tục Xử lý ({validRowsCount} dòng)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
