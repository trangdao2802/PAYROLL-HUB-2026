/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Search, AlertCircle, Check, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import {
  COMMON_FIELD_ALIASES,
  removeVietnameseTones,
  scoreMatch,
  getExcelFileBuffer
} from "../../../lib/utils/data-utils";

interface ColumnMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSave: (mapping: Record<string, string>) => void;
  initialMapping?: Record<string, string>;
  targetFields: string[];
}

export function ColumnMappingDialog({
  isOpen,
  onClose,
  file,
  onSave,
  initialMapping = {},
  targetFields,
}: ColumnMappingDialogProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] =
    useState<Record<string, string>>(initialMapping);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"none" | "name" | "required">("none");
  const [isLoading, setIsLoading] = useState(false);

  const loadHeaders = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const { buffer, name } = await getExcelFileBuffer(file);
      const isCsv = name.toLowerCase().endsWith(".csv") || name.toLowerCase().endsWith(".gsheet") || name.toLowerCase().endsWith(".txt");
      let wb;
      if (isCsv) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(buffer);
        wb = XLSX.read(text, { type: "string", sheetRows: 50, raw: true });
      } else {
        wb = XLSX.read(buffer, { type: "array", sheetRows: 50, raw: true });
      }

      const allHeaders: string[] = [];
      const usedHeaders = new Set<string>();

      // Try to find headers in all sheets
      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw: false
        });

        for (let i = 0; i < Math.min(rows.length, 50); i++) {
          const row = rows[i];
          if (row && Array.isArray(row)) {
            row.forEach((cell) => {
              const cellStr = String(cell).trim().replace(/\s+/g, ' ');
              if (cellStr.length > 0 && isNaN(Number(cellStr))) {
                if (!usedHeaders.has(cellStr.toLowerCase())) {
                  usedHeaders.add(cellStr.toLowerCase());
                  allHeaders.push(cellStr);
                }
              }
            });
          }
        }
      });

      setHeaders(allHeaders);
    } catch (error) {
      console.error("Error loading headers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && file) {
      loadHeaders();
    }
  }, [isOpen, file]);

  // Re-evaluate auto-mapping when targetFields changes
  useEffect(() => {
    if (headers.length > 0 && targetFields.length > 0) {
      setMapping((prevMapping) => {
        const newMapping = { ...prevMapping };
        let hasChanges = false;

        targetFields.forEach((target) => {
          if (!newMapping[target]) {
            const aliases = COMMON_FIELD_ALIASES[target] || [
              target.toUpperCase(),
            ];

            let bestMatch = "";
            let bestScore = 0;

            headers.forEach((h) => {
              const score = scoreMatch(h, target, aliases);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = h;
              }
            });

            if (bestScore >= 60) {
              // Threshold for auto-mapping
              newMapping[target] = bestMatch;
              hasChanges = true;
            }
          }
        });

        return hasChanges ? newMapping : prevMapping;
      });
    }
  }, [headers, targetFields]);

  const handleSave = () => {
    onSave(mapping);
    onClose();
  };

  const isRequired = (field: string) => ["Type", "Class Name / Event Note", "Teacher", "Date", "Quy ra số giờ làm"].includes(field);

  const filteredFields = targetFields.filter((f) =>
    f.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sortedFields = [...filteredFields];
  if (sortBy === "name") {
    sortedFields.sort((a, b) => a.localeCompare(b));
  } else if (sortBy === "required") {
    sortedFields.sort((a, b) => {
      const aReq = isRequired(a);
      const bReq = isRequired(b);
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;
      return 0;
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col border-2 border-primary shadow-hard">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight text-primary flex items-center gap-2">
            Cấu hình Mapping Cột
          </DialogTitle>
          <DialogDescription className="font-bold text-primary/60">
            Khớp các trường trong hệ thống với các cột trong file của bạn:{" "}
            {file?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-primary/40" />
              <input
                type="text"
                placeholder="Tìm kiếm trường hệ thống..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="brutal-input w-full pl-10 !rounded-full"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (sortBy === "none") setSortBy("name");
                else if (sortBy === "name") setSortBy("required");
                else setSortBy("none");
              }}
              className="border-2 border-primary"
              title="Sắp xếp"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortBy === "name" ? "Tên" : sortBy === "required" ? "Bắt buộc" : "Mặc định"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 max-h-[60vh] custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              {sortedFields.map((field) => (
                <div
                  key={field}
                  className={`space-y-1.5 p-3 rounded-xl border-2 ${
                    ["Type", "Class Name / Event Note", "Teacher"].includes(field) && !mapping[field]
                      ? "bg-rose-50 border-rose-200"
                      : "bg-secondary/5 border-primary/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-[0.6875rem] font-black uppercase tracking-wider text-primary flex items-center gap-2">
                      {field}
                      {["Type", "Class Name / Event Note", "Teacher", "Date", "Quy ra số giờ làm"].includes(field) && (
                        <span className="text-[9px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded">* Bắt buộc</span>
                      )}
                    </Label>
                    {mapping[field] ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  {["Type", "Class Name / Event Note", "Teacher"].includes(field) && !mapping[field] && (
                    <p className="text-[10px] text-rose-600 leading-tight">
                      Gợi ý hệ thống chưa chính xác? Vui lòng chọn thủ công cột tương ứng của bạn.
                    </p>
                  )}
                  <Select
                    value={mapping[field] || "none"}
                    onValueChange={(val: string) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field]: val === "none" ? "" : val,
                      }))
                    }
                  >
                    <SelectTrigger className="brutal-input h-9 text-xs bg-white">
                      <SelectValue placeholder="Chọn cột từ file..." />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-primary shadow-hard max-h-[300px]">
                      <SelectItem
                        value="none"
                        className="text-xs font-bold text-primary/40 italic"
                      >
                        -- Không map --
                      </SelectItem>
                      {(() => {
                        const aliases = COMMON_FIELD_ALIASES[field] || [
                          field.toUpperCase(),
                        ];
                        const scoredHeaders = headers
                          .map((h) => ({
                            header: h,
                            score: scoreMatch(h, field, aliases),
                          }))
                          .sort((a, b) => b.score - a.score);

                        return scoredHeaders.map(({ header, score }) => (
                          <SelectItem
                            key={header}
                            value={header}
                            className="text-xs font-bold uppercase"
                          >
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{header}</span>
                              {score >= 80 && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">
                                  Gợi ý
                                </span>
                              )}
                              {score >= 60 && score < 80 && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black">
                                  Có thể
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {headers.length === 0 && !isLoading && (
            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-center gap-3 text-amber-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold uppercase">
                Không tìm thấy cột nào trong file. Vui lòng kiểm tra lại file
                Excel.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-2 border-primary font-black uppercase text-xs"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            className="border-2 border-primary bg-primary text-white font-black uppercase text-xs shadow-hard-sm hover:translate-y-[-2px] active:translate-y-[1px]"
          >
            Lưu Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
