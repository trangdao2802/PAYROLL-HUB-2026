/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useCallback, forwardRef } from "react";
import { useAppData } from "../../../lib/contexts/AppDataContext";
import {
  DataTable,
  OPERATION_KEY_SHORTCUTS,
} from "../../../components/DataTable";
import { Trash2, Settings, Download, RefreshCw, Plus, Search, X, ArrowLeft, Columns2, ChevronDown, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  parseMoneyToNumber,
  getHoldRowAmount,
  removeVietnameseTones,
  formatIdNumber,
  isChargeAmountColumn,
  isNonSummableTextColumn,
} from "../../../lib/utils/data-utils";
import { formatVNRobust } from "../../../lib/utils/format-utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
  carryEligibleHoldsToNextMonth,
  getEligibleHoldRowsForReport,
  getNextPayrollMonth,
  parsePayrollMonth,
} from "../../../lib/utils/hold-carryover";

const HOLD_HIDDEN_COLS = [
  "TÊN FILE",
  "MÃ AE",
  "TAX CODE",
  "CONTRACT NO",
  "TÌNH TRẠNG THANH TOÁN",
  "TRẠNG THÁI",
  "DIỄN GIẢI"
];

function cleanFullName(val: unknown): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  return removeVietnameseTones(str).toUpperCase();
}

interface HoldAETableProps {
  searchTerm: string;
  onSearchTermChange?: (term: string) => void;
  onAddRow?: (idx?: number) => void;
  cameFromBulkPayment?: boolean;
  onBackToBulkPayment?: () => void;
}

export const HoldAETable = forwardRef<any, HoldAETableProps>(
  ({ searchTerm, onSearchTermChange, onAddRow, cameFromBulkPayment, onBackToBulkPayment }, ref) => {
    const { appData, updateAppData } = useAppData();
    const [showSearch, setShowSearch] = React.useState(false);
    const [showClearConfirm, setShowClearConfirm] = React.useState(false);
    const hasActiveSearch = searchTerm.trim().length > 0;
    const isSearchVisible = showSearch || hasActiveSearch;

    const handleToggleSearch = () => {
      if (isSearchVisible) {
        setShowSearch(false);
        onSearchTermChange?.("");
        return;
      }
      setShowSearch(true);
    };

    // 1. Month range parser and validator
    const parseToMonthIndex = useCallback(
      (str: string): number => {
        if (!str) return 0;
        const clean = str.toUpperCase().trim();

        const currentPeriodVal = appData.globalMonth || "03.2026";
        const yearParts = currentPeriodVal.split(".");
        const currentYear = yearParts.length === 2 ? parseInt(yearParts[1], 10) : 2026;
        const currentMonthNum = yearParts.length === 2 ? parseInt(yearParts[0], 10) : 3;

        const dateMatch = clean.match(/(\d{1,2})(?:[./-]|\s+|năm\s+)(\d{4})/i);
        if (dateMatch) {
          const m = parseInt(dateMatch[1], 10);
          const y = parseInt(dateMatch[2], 10);
          return y * 12 + m;
        }
        const tMatch = clean.match(/T[HÁNG]*\s*(\d{1,2})/i);
        if (tMatch) {
          const m = parseInt(tMatch[1], 10);
          let y = currentYear;
          if (m > currentMonthNum) {
            y = currentYear - 1;
          }
          return y * 12 + m;
        }
        const numMatch = clean.match(/^(\d+)$/);
        if (numMatch) {
          const m = parseInt(numMatch[1], 10);
          let y = currentYear;
          if (m > currentMonthNum) {
            y = currentYear - 1;
          }
          return y * 12 + m;
        }
        return 0;
      },
      [appData.globalMonth],
    );

    // 2. Filter data up to the current active period
    const filteredData = useMemo(() => {
      const raw = appData.Hold_AE || { headers: [], data: [] };
      if (!raw.data || !Array.isArray(raw.data))
        return { headers: [], data: [] };

      const currentPeriodVal = appData.globalMonth || "03.2026";
      const currentLimit = parseToMonthIndex(currentPeriodVal);

      const filteredRows = raw.data.filter((r: any) => {
        const nghiepVu = String(r["Nghiệp vụ"] || "").toUpperCase().trim();
        if (nghiepVu === "BONUS" || nghiepVu === "B" || nghiepVu.includes("BONUS") || nghiepVu === "⏩" || nghiepVu === "⏯") {
          return false; // Bonus moved to Gross Pay (Extra Summer Instructors)
        }
        const rowMonth = r["Tháng báo cáo"] || r["_fileMonth"] || "";
        const rowLimit = parseToMonthIndex(rowMonth);
        return rowLimit === currentLimit;
      }).map((row: any) => {
        const normalizedRow = {
          ...row,
          "ID Number": formatIdNumber(row["ID Number"]),
        };

        // Enforce default total payment sign when Reporting Month equals Arising Month
        const rowReportingMonth = String(normalizedRow["Tháng báo cáo"] || "").trim();
        const rowArisingMonth = String(normalizedRow["Tháng phát sinh"] || "").trim();
        if (rowReportingMonth && rowArisingMonth && rowReportingMonth === rowArisingMonth) {
          const nghiepVu = String(normalizedRow["Nghiệp vụ"] || "").toUpperCase().trim();
          const currentTotalPayment = parseMoneyToNumber(normalizedRow["TOTAL PAYMENT"] || 0);
          
          if (nghiepVu.includes("HOLD") || nghiepVu === "H") {
            normalizedRow["TOTAL PAYMENT"] = -Math.abs(currentTotalPayment);
          } else if (nghiepVu.includes("CANCEL") || nghiepVu === "C") {
            normalizedRow["TOTAL PAYMENT"] = -Math.abs(currentTotalPayment);
          } else if (nghiepVu.includes("ADD") || nghiepVu === "A" || nghiepVu === "") {
            normalizedRow["TOTAL PAYMENT"] = Math.abs(currentTotalPayment);
          } else if (nghiepVu === "B" || nghiepVu.includes("BONUS") || nghiepVu === "⏩" || nghiepVu === "⏯") {
            normalizedRow["TOTAL PAYMENT"] = Math.abs(currentTotalPayment);
          }
        }
        return normalizedRow;
      });

      return { ...raw, data: filteredRows };
    }, [appData.Hold_AE, appData.globalMonth, parseToMonthIndex]);

    const [tableSummaryState, setTableSummaryState] = React.useState<{
      source: any[] | null;
      rows: any[];
    }>({ source: null, rows: [] });

    const handleFilteredTableDataChange = useCallback(
      (rows: any[]) => {
        setTableSummaryState({ source: filteredData.data, rows });
      },
      [filteredData.data],
    );

    const currentSummaryRows =
      tableSummaryState.source === filteredData.data
        ? tableSummaryState.rows
        : filteredData.data;

    const holdAETotalSum = useMemo(() => {
      if (!currentSummaryRows) return 0;
      return currentSummaryRows.reduce((sum: number, row: any) => {
        if (!row || row._isTotalRow || row._isPastMonthHoldOrCancel) {
          return sum;
        }
        return sum + getHoldRowAmount(row);
      }, 0);
    }, [currentSummaryRows]);

    // 3. Special cell change handler for Hold_AE
    const handleCellChange = useCallback(
      (row: Record<string, any>, columnKey: string, value: any) => {
        if (["Tháng báo cáo"].includes(columnKey)) {
          return;
        }

        updateAppData((prev: any) => {
          const targetTab = prev.Hold_AE;
          if (!targetTab || !targetTab.data) return prev;

          const data = [...targetTab.data];
          const rowIndex = data.findIndex(
            (r, idx) =>
              r && row &&
              ((row._originalIndex !== undefined &&
                idx === row._originalIndex) ||
                (r.id && row.id && r.id === row.id) ||
                r === row ||
                (r["ID Number"] === row["ID Number"] &&
                  r["TOTAL PAYMENT"] === row["TOTAL PAYMENT"] &&
                  ((r["No."] !== undefined && r["No."] === row["No."]) ||
                    (r["No"] !== undefined && r["No"] === row["No"]) ||
                    (r["STT"] !== undefined && r["STT"] === row["STT"])))),
          );

          if (rowIndex === -1) return prev;

          let finalValue = value;
          const colKeyUpper = String(columnKey || "").toUpperCase();
          if (colKeyUpper.includes("ID NUMBER") || colKeyUpper === "ID" || colKeyUpper === "CCCD" || colKeyUpper === "MÃ AE") {
            finalValue = formatIdNumber(value);
          } else if (
            colKeyUpper.includes("FULL NAME") ||
            colKeyUpper.includes("BENEFICIARY NAME") ||
            colKeyUpper.includes("HỌ VÀ TÊN")
          ) {
            finalValue = cleanFullName(value);
          }

          const updatedRow = { ...data[rowIndex], [columnKey]: finalValue };

          // Automatically offset the TOTAL PAYMENT sign based on Trạng thái or Nghiệp vụ
          if (columnKey === "Trạng thái" || columnKey === "Nghiệp vụ") {
            const valUpper = String(value || "").toUpperCase();
            const currentTotalPayment = parseMoneyToNumber(
              updatedRow["TOTAL PAYMENT"] || 0,
            );
            if (valUpper.includes("HOLD") || valUpper === "H") {
              updatedRow["TOTAL PAYMENT"] = -Math.abs(currentTotalPayment);
              updatedRow["Nghiệp vụ"] = "Hold";
            } else if (valUpper.includes("CANCEL") || valUpper === "C") {
              updatedRow["TOTAL PAYMENT"] = -Math.abs(currentTotalPayment);
              updatedRow["Nghiệp vụ"] = "Cancel";
            } else if (valUpper.includes("ADD") || valUpper === "A") {
              updatedRow["TOTAL PAYMENT"] = Math.abs(currentTotalPayment);
              updatedRow["Nghiệp vụ"] = "Add";
            }
          }

          data[rowIndex] = updatedRow;

          return {
            ...prev,
            Hold_AE: { ...targetTab, data },
          };
        });
      },
      [updateAppData],
    );

    // 4. Row deletion handler for Hold_AE
    const handleDeleteRow = useCallback(
      (rowToDelete: Record<string, any>) => {
        updateAppData((prev: any) => {
          const targetTab = prev.Hold_AE;
          if (!targetTab || !targetTab.data) return prev;

          const data = [...targetTab.data];
          const rowIndex = data.findIndex(
            (r, idx) =>
              r && rowToDelete &&
              ((rowToDelete._originalIndex !== undefined &&
                idx === rowToDelete._originalIndex) ||
                (r.id && rowToDelete.id && r.id === rowToDelete.id) ||
                r === rowToDelete ||
                (r["ID Number"] === rowToDelete["ID Number"] &&
                  r["TOTAL PAYMENT"] === rowToDelete["TOTAL PAYMENT"])),
          );

          if (rowIndex === -1) return prev;

          data.splice(rowIndex, 1);
          return {
            ...prev,
            Hold_AE: { ...targetTab, data },
          };
        });
        toast.success("Đã xóa dòng");
      },
      [updateAppData],
    );

    const handleDeleteSelection = useCallback(
      (range: { startR: number; endR: number; startC?: number; endC?: number }) => {
        const currentRef = ref as any;
        let rowsToDelete: any[] = [];
        
        if (currentRef?.current?.getFilteredAndSortedData) {
          const allRenderedData = currentRef.current.getFilteredAndSortedData();
          const minR = Math.min(range.startR, range.endR);
          const maxR = Math.max(range.startR, range.endR);
          rowsToDelete = allRenderedData.slice(minR, maxR + 1);
        } else {
          // Fallback if ref is not available
          const minR = Math.min(range.startR, range.endR);
          const maxR = Math.max(range.startR, range.endR);
          rowsToDelete = filteredData.data.slice(minR, maxR + 1);
        }

        if (rowsToDelete.length === 0) return;

        updateAppData((prev: any) => {
          const targetTab = prev.Hold_AE;
          if (!targetTab || !targetTab.data) return prev;

          const data = [...targetTab.data].filter((r) => {
            return r && !rowsToDelete.some(
              (rowToDelete) =>
                rowToDelete &&
                ((rowToDelete._originalIndex !== undefined &&
                  targetTab.data.indexOf(r) === rowToDelete._originalIndex) ||
                (r.id && rowToDelete.id && r.id === rowToDelete.id) ||
                r === rowToDelete ||
                (r["ID Number"] === rowToDelete["ID Number"] &&
                  r["TOTAL PAYMENT"] === rowToDelete["TOTAL PAYMENT"])),
            );
          });

          return {
            ...prev,
            Hold_AE: { ...targetTab, data },
          };
        });
        
        if (currentRef?.current?.clearSelection) {
          currentRef.current.clearSelection();
        }
        
        toast.success(`Đã xóa ${rowsToDelete.length} dòng`);
      },
      [filteredData.data, updateAppData, ref],
    );

    // 5. Dynamic Columns memoization
    const columns = useMemo(() => {
      let headers = filteredData.headers;
      if (!headers || headers.length === 0) {
        // Fallback headers to prevent empty rendering
        headers = [
          "Sheet Source", "STT", "Tháng báo cáo", "Phân quyền", "Mã AE", 
          "STK AE", "Beneficiary Name", "Business", "L07", "Sales/Rehiring AE GP Amount (Final)",
          "TOTAL PAYMENT", "Bank", "Note", "Tháng phát sinh", "Nghiệp vụ", "Tình trạng thanh toán", "Trạng thái"
        ];
      } else {
        headers = [...headers];
      }

      // Merge additional keys from data to ensure nothing is hidden
      if (filteredData.data && filteredData.data.length > 0) {
        const allKeys = Object.keys(filteredData.data[0]);
        allKeys.forEach(key => {
          const kUp = key.toUpperCase();
          if (
            !key.startsWith("_") &&
            kUp !== "ID" &&
            kUp !== "_ID" &&
            kUp !== "UUID" &&
            kUp !== "ROWID" &&
            kUp !== "RECORDID" &&
            !headers!.some(h => String(h).toUpperCase() === kUp)
          ) {
            headers!.push(key);
          }
        });
      }

      headers = headers!.filter(h => {
        const u = String(h).trim().toUpperCase();
        if (HOLD_HIDDEN_COLS.includes(u)) return false;
        return u !== "ID" && u !== "_ID" && u !== "UUID" && u !== "ROWID" && u !== "RECORDID" && !u.startsWith("_");
      });

      // Ensure "Tháng báo cáo" exists and is visible
      const hUpArr = headers.map(h => String(h).toUpperCase());
      if (!hUpArr.includes("THÁNG BÁO CÁO")) {
        headers.push("Tháng báo cáo");
      }

      const isNoCol = (h: string) => {
        const u = String(h).trim().toUpperCase();
        return u === "NO." || u === "NO" || u === "STT";
      };
      const isBusCol = (h: string) => {
        const u = String(h).trim().toUpperCase();
        return u === "BUSINESS" || u === "BU";
      };
      const isL07Col = (h: string) => {
        const u = String(h).trim().toUpperCase();
        return u === "L07";
      };
      const isNoteCol = (h: string) => {
        const u = String(h).trim().toUpperCase();
        return u === "NOTE" || u === "DIỄN GIẢI";
      };

      const noCol = headers.find(isNoCol);
      const busCol = headers.find(isBusCol);
      const l07Col = headers.find(isL07Col);
      const noteCol = headers.find(isNoteCol);

      const remaining = headers.filter(h => !isNoCol(h) && !isBusCol(h) && !isL07Col(h) && !isNoteCol(h));

      const finalHeaders: string[] = [];
      if (noCol) finalHeaders.push(noCol);
      else finalHeaders.push("STT");

      if (busCol) finalHeaders.push(busCol);
      if (l07Col) finalHeaders.push(l07Col);

      finalHeaders.push(...remaining);

      if (noteCol) finalHeaders.push(noteCol);
      else finalHeaders.push("Note");

      headers = finalHeaders;

      return headers
        .map((header: string) => {
          const h = header.toUpperCase();
          const isLabel = h === "LABEL";
          const isTextOnlyColumn = isNonSummableTextColumn(header);
          const isChargeAmount = isChargeAmountColumn(header);
          let type: "text" | "number" | "currency" | "label" = "text";

          let renderOption: ((value: any, row: any) => React.ReactNode) | undefined;
          if (h === "THÁNG BÁO CÁO") {
            renderOption = (val, row) => val || row["_fileMonth"] || row["Tháng"] || "";
          }

          if (isChargeAmount) {
            type = "currency";
          } else if (
            h.includes("TOTAL") ||
            h.includes("PAYMENT") ||
            h.includes("AE") ||
            h.includes("LỆCH") ||
            h.includes("TIỀN") ||
            h.includes("AMOUNT") ||
            h.includes("INCENTIVE") ||
            h.includes("PHẠT") ||
            h.includes("THƯỞNG") ||
            h.includes("CHI") ||
            h.includes("THU") ||
            h.includes("SALARY") ||
            h.includes("LƯƠNG") ||
            h.includes("CỘNG") ||
            h.includes("GP") ||
            h.includes("VALUE")
          ) {
            if (
              !(
                h.includes("ID") ||
                h.includes("ACCOUNT") ||
                h.includes("NUMBER") ||
                h.includes("CODE") ||
                h.includes("STK") ||
                h.includes("MÃ") ||
                h.includes("CENTER") ||
                h.includes("KHÁCH HÀNG")
              )
            ) {
              type = "currency";
            }
          }
          if (isTextOnlyColumn) type = "text";
          if (isLabel) type = "label";

          const isReadOnly = [
            "Tháng báo cáo",
            "Nghiệp vụ",
            "Trạng thái",
            "Tháng phát sinh",
            "Tình trạng thanh toán",
          ].includes(header);

          if (header === "Nghiệp vụ") {
            renderOption = (value: any, row: any) => {
              const nghiepVu = String(row["Nghiệp vụ"] || "").toUpperCase().trim();
              const isHold = nghiepVu.includes("HOLD") || nghiepVu === "H";
              const isCancel = nghiepVu.includes("CANCEL") || nghiepVu === "C";
              const isAdd = !isHold && !isCancel;

              const currentPeriodVal = appData.globalMonth || "03.2026";
              const currentPeriodParts = currentPeriodVal.split(".");
              const currentMonthNum = parseInt(currentPeriodParts[0], 10) || 3;
              const currentYearNum = parseInt(currentPeriodParts[1], 10) || 2026;
              const currentPeriod = `${String(currentMonthNum).padStart(2, "0")}.${currentYearNum}`;

              const rowReportingMonth = String(
                row["Tháng báo cáo"] || "",
              ).trim();
              const isPeriodMatch = rowReportingMonth === currentPeriod;

              return (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center w-full py-1"
                >
                  <button
                    onKeyDown={(e) => {
                      if (e.ctrlKey || e.metaKey || e.altKey || !isPeriodMatch) {
                        return;
                      }
                      const nextStatus =
                        OPERATION_KEY_SHORTCUTS[e.key.toUpperCase()];
                      if (!nextStatus) return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleCellChange(row, "Nghiệp vụ", nextStatus);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPeriodMatch) {
                        let nextStatus = "Add";
                        if (isAdd) nextStatus = "Hold";
                        else if (isHold) nextStatus = "Cancel";
                        else if (isCancel) nextStatus = "Add";
                        handleCellChange(row, "Nghiệp vụ", nextStatus);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg border shadow-sm transition-all select-none h-7 w-24 hover:brightness-95 active:scale-95 ${
                      !isPeriodMatch
                        ? "bg-secondary/30 border-border text-foreground/40 opacity-40 cursor-not-allowed pointer-events-none shadow-none"
                        : isHold
                          ? "bg-amber-500 border-amber-500 text-white"
                          : isCancel
                            ? "bg-rose-500 border-rose-500 text-white"
                            : "bg-primary border-primary text-white"
                    }`}
                    title={!isPeriodMatch ? `Chỉ sửa đổi được tại card tháng chọn` : `Chọn ô rồi bấm A/H/C, hoặc bấm nút để chuyển nghiệp vụ`}
                    disabled={!isPeriodMatch}
                  >
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/10 text-white text-[10px] font-extrabold">
                      {isHold ? "H" : isCancel ? "C" : "A"}
                    </span>
                    <span>{isHold ? "Hold" : isCancel ? "Cancel" : "Add"}</span>
                  </button>
                </div>

              );
            };
          }

          return {
            key: header,
            label: h === "STT" ? "No." : header,
            type,
            hidden: HOLD_HIDDEN_COLS.includes(h),
            sortable: header !== "Nghiệp vụ",
            filterable: true,
            readOnly: isReadOnly,
            render: renderOption,
            width: header === "Nghiệp vụ" ? 160 : undefined,
            showGrandTotal:
              !isTextOnlyColumn &&
              (isChargeAmount || type === "currency"),
          };
        });
    }, [filteredData.headers, filteredData.data, handleCellChange, appData.globalMonth]);

    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const handleRefresh = () => {
      setIsRefreshing(true);
      updateAppData((prev: any) => ({ ...prev }));
      setTimeout(() => {
        setIsRefreshing(false);
        toast.success("Đã làm mới dữ liệu Hold AE");
      }, 500);
    };

    const handleExportExcel = () => {
      import("xlsx").then((XLSX) => {
        const ws = XLSX.utils.json_to_sheet(filteredData.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hold_AE");
        XLSX.writeFile(wb, "Hold_AE_Export.xlsx");
        toast.success("Đã xuất file Excel thành công");
      });
    };

    const handleClearAll = () => {
      setShowClearConfirm(true);
    };

    const handleConfirmClearAll = () => {
      updateAppData((prev: any) => ({
        ...prev,
        Hold_AE: { ...prev.Hold_AE, data: [] },
      }));
      setShowClearConfirm(false);
      toast.success("Đã xóa tất cả dữ liệu Deductions");
    };

    const currentReportMonth = appData.globalMonth || "03.2026";
    const { eligibleHoldCount, savedHoldCount } = useMemo(() => {
      const rows = appData.Hold_AE?.data || [];
      const currentReportMonthIndex =
        parsePayrollMonth(currentReportMonth)?.index;
      let savedCount = 0;

      rows.forEach((row: any) => {
        const carriedFrom = parsePayrollMonth(row?._holdCarryFromReportMonth);
        if (
          currentReportMonthIndex !== undefined &&
          carriedFrom?.index === currentReportMonthIndex
        ) {
          savedCount += 1;
        }
      });

      return {
        eligibleHoldCount: getEligibleHoldRowsForReport(
          rows,
          currentReportMonth,
        ).length,
        savedHoldCount: savedCount,
      };
    }, [appData.Hold_AE?.data, currentReportMonth]);

    const handleSaveHolds = () => {
      if (eligibleHoldCount === 0) {
        toast.warning(
          "Không có khoản Hold nào có tháng phát sinh nhỏ hơn hoặc bằng tháng báo cáo.",
        );
        return;
      }

      updateAppData((prev: any) => {
        const holdCarryover = carryEligibleHoldsToNextMonth({
          sourceRows: appData.Hold_AE?.data || [],
          existingRows: prev.Hold_AE?.data || [],
          reportMonth: currentReportMonth,
        });

        return {
          ...prev,
          Hold_AE: {
            ...(prev.Hold_AE || { headers: [], data: [] }),
            data: holdCarryover.rows,
          },
        };
      });

      const nextMonth = getNextPayrollMonth(currentReportMonth)?.dot;
      toast.success(
        `Đã lưu ${eligibleHoldCount} khoản Hold${
          nextMonth ? ` và chuyển sang tháng ${nextMonth}` : ""
        }!`,
      );
    };

    return (
      <div 
        className="unified-table-frame flex-1 flex flex-col min-h-0 w-full h-full px-0 py-0 m-0 relative overflow-hidden gap-0 bg-card border border-border shadow-xs z-10"
      >
        {/* Top Toolbar Header with Settings Button */}
        <div 
          className="unified-table-frame-header flex min-h-[56px] items-center justify-between gap-3 bg-[var(--table-header-bg,#FAF3E8)] px-3 py-2 shrink-0 select-none"
          style={{ backgroundColor: "var(--table-header-bg, #FAF3E8)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Columns2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 
                className="truncate font-bold tracking-tight text-foreground"
                style={{ fontSize: "13px", lineHeight: "23px", height: "18.0012px" }}
              >
                DEDUCTIONS AND BENEFITS
              </h3>
              <p 
                className="truncate font-medium text-muted-foreground"
                style={{ fontSize: "10px", lineHeight: "14.375px" }}
              >
                Theo dõi Hold, Cancel, Bonus và Add · {filteredData.data.length} dòng
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {cameFromBulkPayment && (
              <button
                onClick={() => onBackToBulkPayment?.()}
                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all shadow-3xs rounded-full active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 font-bold text-[10px] h-7 uppercase tracking-wider"
                title="Quay lại Bảng Reconciliation"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Về Reconciliation</span>
              </button>
            )}

            <button
              onClick={handleSaveHolds}
              className={`group flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[10px] font-extrabold uppercase tracking-wider shadow-sm transition-all active:scale-95 ${
                savedHoldCount > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-primary bg-primary text-primary-foreground hover:brightness-95"
              }`}
              title={
                savedHoldCount > 0
                  ? `Đã chuyển ${savedHoldCount} khoản Hold. Bấm để lưu lại dữ liệu hiện tại.`
                  : `Lưu ${eligibleHoldCount} khoản Hold hợp lệ sang tháng tiếp theo.`
              }
              aria-label="Lưu các khoản Hold sang tháng báo cáo tiếp theo"
            >
              {savedHoldCount > 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="whitespace-nowrap">
                {savedHoldCount > 0 ? "Đã lưu Hold" : "Lưu Hold"}
              </span>
            </button>
            
            {/* Search Input shown dynamically */}
            {isSearchVisible && (
              <div 
                className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 animate-in fade-in slide-in-from-right duration-200"
                style={{ width: "clamp(220px, 30vw, 360px)" }}
              >
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => onSearchTermChange?.(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => onSearchTermChange?.("")}
                    className="text-slate-400 hover:text-slate-700 text-xs p-0.5 transition-colors cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSearch(false);
                    onSearchTermChange?.("");
                  }}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="Đóng tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Key statistics block perfectly matching the second image */}
            <div className="flex items-center gap-4 mr-1">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter whitespace-nowrap">NHÂN VIÊN</span>
                <span className="text-xs font-black text-foreground leading-tight">{filteredData.data.length}</span>
              </div>
              <div className="flex flex-col items-end border-l border-border pl-4">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter whitespace-nowrap">TỔNG TIỀN</span>
                <div className="bg-muted/60 px-2 py-0.5 rounded border border-border/60 mt-0.5">
                  <span className="text-xs font-black text-foreground tracking-tight tabular-nums">{formatVNRobust(holdAETotalSum, 0)}</span>
                </div>
              </div>
            </div>

            {/* Nút Cài đặt (Settings Button) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-foreground shadow-sm transition-all hover:bg-muted active:scale-95"
                  title="Cài đặt & Thao tác"
                  aria-label="Mở cài đặt và thao tác bảng Deductions"
                >
                  <Settings className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover:rotate-45" />
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-100 z-[99999]">
                <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-2">
                  Action Center
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-50" />
                
                <DropdownMenuItem
                  onClick={handleToggleSearch}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-slate-700">
                    {isSearchVisible ? "Ẩn công cụ tìm kiếm" : "Tìm kiếm..."}
                  </span>
                </DropdownMenuItem>
                {onAddRow && (
                  <DropdownMenuItem
                    onClick={() => onAddRow()}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-slate-700">Thêm dòng mới</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleRefresh}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="text-xs font-bold text-slate-700">Làm mới dữ liệu</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const currentRef = ref as any;
                    if (currentRef?.current?.resetTableConfig) {
                      currentRef.current.resetTableConfig();
                    } else {
                      toast.error("Không tìm thấy cấu hình bảng");
                    }
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Khôi phục bố cục bảng</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.dispatchEvent(new Event("open-ui-settings"))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">Cài đặt Giao diện</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportExcel}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Xuất file Excel</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-50" />
                <DropdownMenuItem
                  onClick={handleClearAll}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-rose-50 text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-bold">Xóa tất cả dữ liệu</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

          <DataTable
            className="flex-1 !overflow-visible"
            hideColumnVisibilityToggle={false}
            scrollContainerStyle={{ borderRadius: "0", border: "none" }}
            stickyFirstColumn={false}
            showPagination={true}
            defaultItemsPerPage={50}
            ignoreSavedPagination={true}
            ref={ref}
            columns={columns}
            data={filteredData.data}
            onFilteredDataChange={handleFilteredTableDataChange}
            onCellChange={handleCellChange}
            onDeleteRow={handleDeleteRow}
            onDeleteSelection={handleDeleteSelection}
            onAddRow={onAddRow}
            isEditable={true}
            showRowNumber={true}
            autoHideZeroSumColumns={false}
            selectable={false}
            bulkActions={[
              {
                label: "Xóa các dòng đã chọn",
                icon: <Trash2 className="w-3 h-3" />,
                variant: "destructive",
                onClick: (selectedRows) => {
                  updateAppData((prev: any) => {
                    const targetTab = prev.Hold_AE;
                    if (!targetTab || !targetTab.data) return prev;

                    const data = [...targetTab.data].filter((r) => {
                      return r && !selectedRows.some(
                        (rowToDelete) =>
                          rowToDelete &&
                          ((rowToDelete._originalIndex !== undefined &&
                            targetTab.data.indexOf(r) === rowToDelete._originalIndex) ||
                          (r.id && rowToDelete.id && r.id === rowToDelete.id) ||
                          r === rowToDelete ||
                          (r["ID Number"] === rowToDelete["ID Number"] &&
                            r["TOTAL PAYMENT"] === rowToDelete["TOTAL PAYMENT"])),
                      );
                    });

                    return {
                      ...prev,
                      Hold_AE: { ...targetTab, data },
                    };
                  });
                  const currentRef = ref as any;
                  if (currentRef?.current?.clearSelection) {
                    currentRef.current.clearSelection();
                  }
                  toast.success(`Đã xóa ${selectedRows.length} dòng`);
                },
              },
            ]}
          externalSearchTerm={searchTerm}
          onExternalSearchChange={onSearchTermChange}
          storageKey="master_ae_Hold_AE"
          ignoreSavedHiddenColumns={true}
          hideSearch={true}
          showFooter={true}
          footerClassName="bg-card text-foreground border-t border-border font-bold"
          totalCalculationOverride={(row: any, colKey: string) => {
            if (colKey === "TOTAL PAYMENT" && row._isPastMonthHoldOrCancel) return 0;
            return null;
          }}
          headerClassName="bg-slate-100 text-accent border-[#E2E8F0] font-bold"
        />

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent className="max-w-[440px] gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl">
            <AlertDialogHeader
              className="flex-row items-center gap-3 border-b border-border px-5 py-4 text-left"
              style={{ backgroundColor: "var(--table-header-bg, #FAF3E8)" }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
                  Deductions and Benefits
                </p>
                <AlertDialogTitle className="text-sm font-black uppercase tracking-tight text-foreground">
                  Xóa toàn bộ dữ liệu?
                </AlertDialogTitle>
              </div>
            </AlertDialogHeader>

            <div className="space-y-4 px-5 py-5">
              <AlertDialogDescription className="text-xs font-medium leading-5 text-muted-foreground">
                Thao tác này sẽ xóa toàn bộ dữ liệu Hold, Add và Cancel đang có
                trong bảng Deductions. Dữ liệu đã xóa chỉ có thể khôi phục bằng
                lịch sử hoàn tác hoặc tải lại file nguồn.
              </AlertDialogDescription>
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/35 px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Số dòng sẽ xóa
                </span>
                <span className="rounded-lg bg-card px-3 py-1 text-sm font-black tabular-nums text-foreground shadow-sm ring-1 ring-border">
                  {appData.Hold_AE?.data?.length || 0}
                </span>
              </div>
            </div>

            <AlertDialogFooter className="flex-row justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
              <AlertDialogCancel className="mt-0 h-9 rounded-full border-border bg-card px-5 text-[10px] font-extrabold uppercase tracking-wider text-foreground hover:bg-muted">
                Hủy
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmClearAll}
                className="h-9 rounded-full bg-destructive px-5 text-[10px] font-extrabold uppercase tracking-wider text-destructive-foreground shadow-sm hover:bg-destructive/90"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Xóa dữ liệu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  },
);

HoldAETable.displayName = "HoldAETable";
