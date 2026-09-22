/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { X, ArrowRight, Info, LayoutList } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: Record<string, string>) => void;
  fileName: string;
  sheetName: string;
  availableHeaders: string[];
  expectedFields: { key: string; label: string; required?: boolean }[];
}

export function MappingModal({
  isOpen,
  onClose,
  onConfirm,
  fileName,
  sheetName,
  availableHeaders,
  expectedFields,
}: MappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Auto-map based on fuzzy matching
      const newMapping: Record<string, string> = {};
      expectedFields.forEach((field) => {
        const match = availableHeaders.find(
          (h) =>
            h.toLowerCase().includes(field.key.toLowerCase()) ||
            h.toLowerCase().includes(field.label.toLowerCase()) ||
            field.label.toLowerCase().includes(h.toLowerCase()),
        );
        if (match) newMapping[field.key] = match;
      });
      setMapping(newMapping);
    }
  }, [isOpen, availableHeaders, expectedFields]);

  if (!isOpen) return null;

  const isReady = expectedFields.every((f) => !f.required || mapping[f.key]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[2rem] border border-primary/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-primary/5 p-8 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white border border-primary/10 rounded-2xl flex items-center justify-center shadow-hard-sm">
              <LayoutList className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground font-display">
                Cấu hình Mapping Cột
              </h2>
              <p className="text-[0.625rem] font-bold uppercase tracking-widest text-primary/60">
                {fileName} • {sheetName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-primary/5 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-foreground/40" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl mb-8 flex gap-4 items-start">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <Info className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm font-medium text-amber-800/80 leading-relaxed">
              Vui lòng xác nhận các cột trong file của bạn tương ứng với các
              trường dữ liệu hệ thống yêu cầu. Các trường có dấu{" "}
              <span className="text-rose-500 font-bold">*</span> là bắt buộc.
            </p>
          </div>

          <div className="space-y-6">
            {expectedFields.map((field) => (
              <div key={field.key} className="flex items-center gap-6 group">
                <div className="w-1/3">
                  <label className="text-[0.625rem] font-bold uppercase tracking-widest text-foreground/40 mb-2 block">
                    {field.label}{" "}
                    {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl font-bold text-sm text-foreground/80 group-hover:border-primary/20 transition-colors">
                    {field.label}
                  </div>
                </div>
                <div className="flex items-center justify-center pt-6">
                  <ArrowRight className="w-5 h-5 text-primary/20" />
                </div>
                <div className="flex-1">
                  <label className="text-[0.625rem] font-bold uppercase tracking-widest text-foreground/40 mb-2 block">
                    Cột trong file
                  </label>
                  <div className="relative">
                    <Select
                      value={mapping[field.key] || "unselected"}
                      onValueChange={(val) => {
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: val === "unselected" ? "" : val,
                        }));
                      }}
                    >
                      <SelectTrigger className={`w-full p-4 h-auto border rounded-2xl font-bold text-sm outline-none transition-all cursor-pointer bg-white ${mapping[field.key] ? "border-emerald-500/50 bg-emerald-50 text-emerald-700" : "border-primary/10 hover:border-primary/20 text-foreground/30"}`}>
                        <SelectValue placeholder="-- Chọn cột --" />
                      </SelectTrigger>
                      <SelectContent className="bg-\[var(--popover)\] border-border shadow-xl z-[100000] opacity-100">
                        <SelectItem value="unselected">-- Chọn cột --</SelectItem>
                        {availableHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 bg-primary/5 border-t border-primary/10 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-4 border border-primary/10 rounded-2xl font-bold uppercase tracking-widest text-[0.625rem] hover:bg-white transition-all text-foreground/60"
          >
            Hủy bỏ
          </button>
          <button
            disabled={!isReady}
            onClick={() => onConfirm(mapping)}
            className={`px-10 py-4 rounded-2xl font-bold uppercase tracking-widest text-[0.625rem] transition-all shadow-hard-sm
              ${isReady ? "bg-primary text-white hover:bg-primary/90" : "bg-primary/10 text-primary/30 cursor-not-allowed shadow-none"}`}
          >
            Xác nhận & Nạp dữ liệu
          </button>
        </div>
      </motion.div>
    </div>
  );
}
