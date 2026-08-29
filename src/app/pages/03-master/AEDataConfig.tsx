/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Link as LinkIcon,
  UploadCloud,
  Layers,
  Trash2,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wrench,
  Settings,
  Search,
  Folder,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { useAppData } from "../../lib/contexts/AppDataContext";
import {
  applyPivotMktTypeCache,
  buildPivotFromAppData,
  getPivotDataMonths,
  readPivotMktTypeCache,
  PIVOT_CACHE_VERSION,
  PIVOT_MKT_TYPE_CACHE_KEY,
  updatePivotMktTypeCache,
  writePivotMktTypeCache,
} from "../../lib/utils/pivot-utils";
import {
  parseMoneyToNumber,
  isMoneyColumn,
  fetchWithBackoff,
  removeVietnameseTones,
  formatIdNumber,
  generateUUID,
} from "../../lib/utils/master-data-utils";
import {
  isBankMasterSheetName,
  isHoldMasterSheetName,
  isRosterMasterSheetName,
  isSheetOneMasterSheetName,
  normalizeMasterSheetName,
} from "../../lib/utils/master-sheet-utils";
import {
  getHoldScopedIdentity,
  mergeDuplicateHoldRows,
  reconcileHoldTransactionRows,
} from "../../lib/utils/hold-carryover";
import MasterImportWorker from "../../workers/masterImport.worker?worker";
import type { MasterWorkbookPayload } from "../../workers/masterImport.worker";
import { clearMasterPageData } from "../../lib/utils/data-clear-scopes";
import { resolveGrossPayTotal } from "../../lib/utils/gross-pay";

function cleanIDNumber(val: any): string {
  return formatIdNumber(val);
}

function cleanFullName(val: any): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  return removeVietnameseTones(str).toUpperCase();
}
import {
  mapL07,
  getCenterInfoByL07,
  getCenterInfoByAECode,
  resolveMktAndCenterL07,
  resolveSummerBonusCenterL07,
} from "../../lib/utils/center-utils";
import { parseDurationToHours } from "../../lib/schemas/excel-schema";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ColumnMappingDialog } from "./components/ColumnMappingDialog";
import {

  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

function parseMonthFromFileName(fileName: string, globalMonth?: string): string | null {
  if (!fileName) return null;
  // Match patterns like 1.2026, 01.2026, 12.2026, or with dashes/slashes 01-2026
  const match = fileName.match(/\b(0?[1-9]|1[0-2])[./-](20\d{2})\b/);
  if (match) {
    const m = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    return `${m < 10 ? "0" + m : m}.${y}`;
  }
  // Try backup pattern: Month name or single digits like T1.2026 or Thang 1
  const tMatch = fileName.match(/(Th\w*|T|Month\s*)(0?[1-9]|1[0-2])\b/i);
  if (tMatch) {
    const m = parseInt(tMatch[2], 10);
    const ref = globalMonth || "03.2026";
    const refParts = ref.split(".");
    const currentMonthNum = parseInt(refParts[0], 10) || 3;
    const currentYearNum = parseInt(refParts[1], 10) || 2026;
    let y = currentYearNum;
    // Explicitly force 2025 for months 11 and 12 as requested
    if (m === 11 || m === 12) {
      y = 2025;
    } else if (m > currentMonthNum) {
      y = currentYearNum - 1;
    }
    return `${m < 10 ? "0" + m : m}.${y}`;
  }
  return null;
}

interface AERow {
  id: string;
  name: string;
  fileObj?: File | null;
  url?: string;
  status: string;
  bank?: string;
  month?: string;
  columnMapping?: Record<string, string>;
}

interface PendingUpload {
  file: File;
  existingRowId?: string;
}

type PendingMasterRequest = {
  resolve: (result: MasterWorkbookPayload) => void;
  reject: (error: Error) => void;
};

let masterImportWorker: Worker | null = null;
const pendingMasterRequests = new Map<string, PendingMasterRequest>();

function getMasterImportWorker() {
  if (masterImportWorker) return masterImportWorker;
  masterImportWorker = new MasterImportWorker();
  masterImportWorker.onmessage = (event: MessageEvent) => {
    const requestId = String(event.data?.requestId || "");
    const pending = pendingMasterRequests.get(requestId);
    if (!pending) return;
    pendingMasterRequests.delete(requestId);
    if (event.data?.success) {
      pending.resolve(event.data.result as MasterWorkbookPayload);
    } else {
      pending.reject(
        new Error(event.data?.error || "Không thể xử lý file Master."),
      );
    }
  };
  masterImportWorker.onerror = (event) => {
    const error = new Error(
      event.message || "Master Import Worker đã dừng bất thường.",
    );
    pendingMasterRequests.forEach(({ reject }) => reject(error));
    pendingMasterRequests.clear();
    masterImportWorker?.terminate();
    masterImportWorker = null;
  };
  return masterImportWorker;
}

function parseMasterFileInWorker(
  file: File,
  isMktFile: boolean,
  targetFields: string[],
) {
  const requestId = generateUUID();
  const worker = getMasterImportWorker();
  return new Promise<MasterWorkbookPayload>((resolve, reject) => {
    pendingMasterRequests.set(requestId, { resolve, reject });
    worker.postMessage({ requestId, file, isMktFile, targetFields });
  });
}



const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

export function AEDataConfig({
  onSwitchToFinal,
}: {
  onSwitchToFinal?: () => void;
}) {
  const navigate = useNavigate();
  const { appData, updateAppData } = useAppData();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preparedMasterFilesRef = useRef(
    new Map<string, MasterWorkbookPayload>(),
  );
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [choices, setChoices] = useState<
    { file: File; action: "update" | "new" | "skip"; targetId?: string }[]
  >([]);
  const [showDialog, setShowDialog] = useState(false);
  
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [activeLinkRowId, setActiveLinkRowId] = useState<string | null>(null);

  const [folderLinkDialogOpen, setFolderLinkDialogOpen] = useState(false);
  const [folderLinkInput, setFolderLinkInput] = useState("");
  const [isFetchingFolder, setIsFetchingFolder] = useState(false);

  // Initialize choices when pendingUploads changes
  useEffect(() => {
    setChoices(
      pendingUploads.map((p) => ({
        file: p.file,
        action: p.existingRowId ? "update" : "new",
        targetId: p.existingRowId,
      })),
    );
  }, [pendingUploads]);

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [mappingDialog, setMappingDialog] = useState<{
    isOpen: boolean;
    rowId: string | null;
  }>({
    isOpen: false,
    rowId: null,
  });

  const masterAeFields = [
    "No",
    "ID Number",
    "Full name",
    "Full Name",
    "HỌ VÀ TÊN",
    "Salary Scale",
    "From",
    "To",
    "Bank Account Number",
    "Bank Name",
    "CITAD code",
    "TAX CODE",
    "Contract No",
    "CHARGE TO LXO",
    "CHARGE TO EC",
    "CHARGE TO PT-DEMO",
    "Charge MKT Local",
    "CHARGE TO OTHER",
    "Charge Renewal Projects",
    "Charge Discovery Camp",
    "Charge Summer Outing",
    "Charge Summer Instructors",
    "TOTAL PAYMENT",
    "Center",
  ];

  const exportConfigListToExcel = () => {
    if (!appData.Ae_Global_Inputs || appData.Ae_Global_Inputs.length === 0) {
      toast.error("Không có file/bản ghi cấu hình nào để tải xuống!");
      return;
    }
    const exportData = appData.Ae_Global_Inputs.map((row, idx) => ({
      "STT": idx + 1,
      "Tên File": row.name,
      "Region / Bank": row.bank || "",
      "Tháng": row.month || "",
      "Trạng Thái": row.status || "ready",
      "Tên File Gốc": row.fileObj?.name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Config_List");
    XLSX.writeFile(wb, `Master_AE_Files_List_${Date.now()}.xlsx`);
    toast.success("Đã tải xuống danh sách cấu hình file Excel!");
  };

  const filteredData = appData.Ae_Global_Inputs.filter(
    (row) =>
      row.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (row.bank || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (row.month || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const clearPageData = () => {
    updateAppData(clearMasterPageData);
    localStorage.removeItem("pivot_master_processed_data");
    localStorage.removeItem(PIVOT_MKT_TYPE_CACHE_KEY);
    setShowClearDialog(false);
    toast.success("Đã xóa dữ liệu trang Master; Timesheet, Audit và Balance được giữ nguyên.");
  };

  const addRow = () => {
    const newRow: AERow = {
      id: Date.now().toString(),
      name: "",
      status: "ready",
      bank: "",
      month: "",
    };
    updateAppData((prev) => ({
      ...prev,
      Ae_Global_Inputs: [...prev.Ae_Global_Inputs, newRow],
    }));
  };

  const deleteRow = (id: string | undefined) => {
    if (!id) return;
    updateAppData((prev) => ({
      ...prev,
      Ae_Global_Inputs: prev.Ae_Global_Inputs.filter((row) => row.id !== id),
    }));
  };

  const updateRow = (id: string, field: keyof AERow, value: any) => {
    updateAppData((prev) => ({
      ...prev,
      Ae_Global_Inputs: prev.Ae_Global_Inputs.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          const uName = String(updated.name || "").toUpperCase();
          const uVal = String(value || "").toUpperCase();
          const uBank = String(updated.bank || "").toUpperCase();
          if (
            uName.includes("MKT") ||
            uName.includes("MARKETING") ||
            uVal.includes("MKT") ||
            uVal.includes("MARKETING") ||
            uBank.includes("MKT") ||
            uBank.includes("MARKETING")
          ) {
            updated.bank = "MKT LOCAL NORTH";
          }
          if (field === "name") {
            const guessedMonth = parseMonthFromFileName(value);
            if (guessedMonth) {
              updated.month = guessedMonth;
            }
          }
          return updated;
        }
        return row;
      }),
    }));
  };

  const handleFileUpload = async (id: string, file: File) => {
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".gsheet"];
    const maxSize = 100 * 1024 * 1024; // 100MB

    const guessBank = (name: string) => {
      const u = name.toUpperCase();
      if (u.includes("MKT") || u.includes("MARKETING")) return "MKT LOCAL NORTH";
      if (u.includes("NORTH")) return "NORTH";
      if (u.includes(" TN") || u.includes(" THAI NGUYEN") || u.includes("_TN_") || u.includes("TN.")) return "THAI NGUYEN";
      if (u.includes(" TH") || u.includes(" THANH HOA") || u.includes("_TH_") || u.includes("TH.")) return "THANH HOA";
      if (u.includes(" PT") || u.includes(" PHU THO") || u.includes("_PT_") || u.includes("PT.")) return "PHU THO";
      return "";
    };

    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      toast.error(
        `Định dạng file không hợp lệ: ${file.name}. Vui lòng tải lên file Excel (.xlsx, .xls).`,
      );
      return;
    }

    if (file.size > maxSize) {
      toast.error(
        `File quá lớn: ${file.name}. Vui lòng tải lên file nhỏ hơn 100MB.`,
      );
      return;
    }

    setIsProcessing(true);
    setProcessingMessage("Đang tự động map cột...");
    try {
      const guessedBank = guessBank(file.name);
      const parsed = await parseMasterFileInWorker(
        file,
        guessedBank === "MKT LOCAL NORTH",
        masterAeFields,
      );
      preparedMasterFilesRef.current.set(id, parsed);

      updateAppData((prev) => ({
        ...prev,
        Ae_Global_Inputs: prev.Ae_Global_Inputs.map((row) =>
          row.id === id
            ? {
                ...row,
                fileObj: file,
                name: file.name,
                status: "Uploaded",
                bank: guessedBank || row.bank,
                month:
                  parseMonthFromFileName(file.name) ||
                  prev.globalMonth ||
                  row.month,
                columnMapping: parsed.mapping,
              }
            : row,
        ),
      }), false);
      toast.success(`Đã tải lên và tự động map cột cho file: ${file.name}`);
    } catch (error: any) {
      toast.error(`Lỗi đọc ${file.name}: ${error?.message || String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLinkSubmit = async () => {
    if (!activeLinkRowId || !linkInput.trim()) return;
    setIsFetchingLink(true);
    try {
      const currentRow = appData.Ae_Global_Inputs.find(r => r.id === activeLinkRowId);
      const response = await fetchWithBackoff(`/api/fetch-google-sheet?url=${encodeURIComponent(linkInput)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Không thể tải dữ liệu. Hãy đảm bảo link đã được share.");
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      let baseName = currentRow?.name || `GoogleSheet_Export_${Date.now()}`;
      if (baseName.endsWith(".csv") || baseName.endsWith(".xlsx") || baseName.endsWith(".xls") || baseName.endsWith(".gsheet")) {
        baseName = baseName.substring(0, baseName.lastIndexOf("."));
      }
      const fileName = `${baseName}.xlsx`;
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Map file and upload to the specific row
      await handleFileUpload(activeLinkRowId, file);
      
      toast.success("Đã tải dữ liệu từ Google Sheet!");
      setLinkDialogOpen(false);
      setLinkInput("");
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải Google Sheet");
    } finally {
      setIsFetchingLink(false);
      setActiveLinkRowId(null);
    }
  };

  const handleFolderLinkSubmit = async () => {
    if (!folderLinkInput.trim()) return;
    setIsFetchingFolder(true);
    try {
      let folderId = folderLinkInput.trim();
      const match = folderLinkInput.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (match) {
        folderId = match[1];
      } else {
        try {
          const url = new URL(folderLinkInput);
          if (url.searchParams.has("id")) {
            folderId = url.searchParams.get("id") || folderId;
          }
        } catch {
          // Ignore invalid URL
        }
      }

      const response = await fetchWithBackoff(`/api/drive-folder-files?folderId=${encodeURIComponent(folderId)}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể lấy danh sách file từ thư mục. Vui lòng kiểm tra lại link hoặc file credentials.json.");
      }

      const data = await response.json();
      if (!data.success || !data.files || data.files.length === 0) {
        throw new Error("Không tìm thấy file nào trong thư mục này.");
      }

      const newPending: PendingUpload[] = [];
      data.files.forEach((f: any) => {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${f.id}`;
        const fileContent = JSON.stringify({ url: sheetUrl });
        const blob = new Blob([fileContent], { type: 'application/json' });
        
        let name = f.name || `GoogleSheet_${f.id}`;
        if (!name.endsWith(".gsheet") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
          name += ".gsheet";
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          // If it already has an extension but is fetched via Drive, just append .gsheet so our parser treats it as URL
          // Wait, actually Google Drive might return name with .xlsx, but we want it to act like .gsheet 
          name = name.replace(/\.(xlsx|xls)$/i, ".gsheet");
        }

        const file = new File([blob], name, { type: 'application/json' });

        const existingRow = appData.Ae_Global_Inputs.find(
          (row) => row.name === name || row.name === name.replace(".gsheet", ".csv"),
        );

        if (existingRow) {
          newPending.push({ file, existingRowId: existingRow.id });
        } else {
          newPending.push({ file });
        }
      });

      setPendingUploads(newPending);
      setShowDialog(true);
      setFolderLinkDialogOpen(false);
      setFolderLinkInput("");
      toast.success(`Đã tìm thấy ${data.files.length} file trong thư mục.`);

    } catch (error: any) {
      toast.error(error.message || "Lỗi tải dữ liệu từ Google Drive Folder");
    } finally {
      setIsFetchingFolder(false);
    }
  };

  const handleMultiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPending: PendingUpload[] = [];
    Array.from(files).forEach((file) => {
      const existingRow = appData.Ae_Global_Inputs.find(
        (row) => row.name === file.name,
      );
      if (existingRow) {
        newPending.push({ file, existingRowId: existingRow.id });
      } else {
        newPending.push({ file });
      }
    });

    setPendingUploads(newPending);
    setShowDialog(true);
    e.target.value = ""; // Reset input
  };

  const confirmUploads = (
    choices: {
      file: File;
      action: "update" | "new" | "skip";
      targetId?: string;
    }[],
  ) => {
    const newRows: AERow[] = [];
    const updates: {
      id: string;
      file: File;
      bank?: string;
      columnMapping?: Record<string, string>;
      status: string;
    }[] = [];

    const guessBank = (name: string) => {
      const u = name.toUpperCase();
      if (u.includes("MKT") || u.includes("MARKETING")) return "MKT LOCAL NORTH";
      if (u.includes("NORTH")) return "NORTH";
      if (u.includes(" TN") || u.includes(" THAI NGUYEN") || u.includes("_TN_") || u.includes("TN.")) return "THAI NGUYEN";
      if (u.includes(" TH") || u.includes(" THANH HOA") || u.includes("_TH_") || u.includes("TH.")) return "THANH HOA";
      if (u.includes(" PT") || u.includes(" PHU THO") || u.includes("_PT_") || u.includes("PT.")) return "PHU THO";
      return "";
    };

    const activeChoices = choices.filter((choice) => choice.action !== "skip");
    for (let index = 0; index < activeChoices.length; index++) {
      const choice = activeChoices[index];

      const guessedBank = guessBank(choice.file.name);
      const id =
        choice.action === "update" && choice.targetId
          ? choice.targetId
          : `${Date.now()}-${index}-${generateUUID()}`;
      preparedMasterFilesRef.current.delete(id);

      if (choice.action === "update" && choice.targetId) {
        updates.push({
          id: choice.targetId,
          file: choice.file,
          bank: guessedBank,
          columnMapping: {},
          status: "ready",
        });
      } else if (choice.action === "new") {
        newRows.push({
          id,
          name: choice.file.name,
          status: "ready",
          fileObj: choice.file,
          bank: guessedBank,
          month: parseMonthFromFileName(choice.file.name) || appData.globalMonth || "",
          columnMapping: {},
        });
      }
    }

    const nextInputs = appData.Ae_Global_Inputs.map((row) => {
        const update = updates.find((u) => u.id === row.id);
        return update
          ? {
              ...row,
              fileObj: update.file,
              status: update.status,
              bank: update.bank || row.bank,
              month:
                parseMonthFromFileName(update.file.name) ||
                appData.globalMonth ||
                row.month,
              columnMapping: update.columnMapping,
            }
          : row;
      }).concat(newRows);

    updateAppData(
      (prev) => ({
        ...prev,
        Ae_Global_Inputs: nextInputs,
      }),
      false,
    );

    setShowDialog(false);
    setPendingUploads([]);
    const uploadedCount = newRows.length + updates.length;
    if (uploadedCount === 0) {
      toast.info("Không có file nào được thêm vào danh sách.");
      return;
    }

    toast.success(
      `Đã tải ${uploadedCount} file lên danh sách. Bấm “Xử lý dữ liệu” khi bạn muốn bắt đầu xử lý.`,
    );
  };

  const processAEData = async (
    targetOverride?: AERow[],
    preparedOverride?: Map<string, MasterWorkbookPayload>,
  ) => {
    const targets = (targetOverride || appData.Ae_Global_Inputs).filter(
      (item) => item.fileObj,
    );
    if (targets.length === 0) {
      toast.error("Vui lòng chọn ít nhất một File AE Final!");
      return;
    }

    const normalizeMonth = (m: any) => {
      const str = String(m || "").trim().toUpperCase();
      if (!str) return "";
      const match = str.match(/(?:THÁNG|THANG|T)?\s*(\d{1,2})[./\- ]\s*(\d{4})/i);
      if (match) {
        const mm = match[1].padStart(2, "0");
        const yyyy = match[2];
        return `${mm}.${yyyy}`;
      }
      const parts = str.split(/[./]/);
      if (parts.length === 2) {
        const mm = parts[0].trim().padStart(2, "0");
        const yyyy = parts[1].trim();
        if (mm.length === 2 && yyyy.length === 4) {
          return `${mm}.${yyyy}`;
        }
      }
      return str;
    };

    const getColIndex = (
      headers: string[],
      targetField: string,
      mapping?: Record<string, string>,
      fuzzyKeywords: string[] = [],
    ) => {
      if (mapping && mapping[targetField]) {
        const mappedHeader = mapping[targetField].toUpperCase().trim();
        const idx = headers.findIndex(
          (h) => String(h).toUpperCase().trim() === mappedHeader,
        );
        if (idx !== -1) return idx;
      }
      
      // 1. Exact Match on targetField
      let idx = headers.findIndex((h: any) => String(h).toUpperCase().trim() === targetField.toUpperCase());
      if (idx !== -1) return idx;

      // 2. Exact Match on fuzzy keywords
      if (fuzzyKeywords && fuzzyKeywords.length > 0) {
        idx = headers.findIndex((h: any) => {
          const hUp = String(h).toUpperCase().trim();
          return fuzzyKeywords.some((k) => hUp === k.toUpperCase().trim());
        });
        if (idx !== -1) return idx;
      }

      // 3. Contains Match on targetField
      idx = headers.findIndex((h: any) => String(h).toUpperCase().trim().includes(targetField.toUpperCase()));
      if (idx !== -1) return idx;

      // 4. Contains Match on fuzzy keywords
      if (fuzzyKeywords && fuzzyKeywords.length > 0) {
        return headers.findIndex((h: any) => {
          const hUp = String(h).toUpperCase().trim();
          return fuzzyKeywords.some((k) => hUp.includes(k.toUpperCase().trim()));
        });
      }
      return -1;
    };

    setIsProcessing(true);
    setProgress(0);
    setProcessingMessage("Đang chuẩn bị xử lý dữ liệu AE...");
    await new Promise((resolve) => setTimeout(resolve, 10));

    const totalFiles = targets.length;
    let processedFiles = 0;

    try {
      const bankData: any[] = [];
      const sheet1Data: any[] = [];
      const holdData: any[] = [];
      const soSanhAeData: any[] = [];
      const rosterDataToAppend: any[] = [];
      const statusById = new Map<string, string>();
      const preparedFiles =
        preparedOverride || preparedMasterFilesRef.current;

      const sheet1Headers = [
        "No.",
        "Tháng báo cáo",
        "L07",
        "Business",
        "ID Number",
        "Full name",
        "Salary Scale",
        "From",
        "To",
        "Bank Account Number",
        "Bank Name",
        "CITAD code",
        "TAX CODE",
        "Contract No",
        "CHARGE TO LXO",
        "CHARGE TO EC",
        "CHARGE TO PT-DEMO",
        "Charge MKT Local",
        "CHARGE TO OTHER",
        "Charge Renewal Projects",
        "Charge Discovery Camp",
        "Charge Summer Outing",
        "Charge Summer Instructors",
        "Extra Summer Instructors",
        "TOTAL PAYMENT",
        "TÊN FILE",
        "Center",
      ];

      let foundAnySheet = false;
      const aeMap = appData.AE_Map;

      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        if (!item.fileObj) continue;

        const itemMonth = item.month || parseMonthFromFileName(item.name || item.fileObj.name) || appData.globalMonth || "03.2026";

        processedFiles++;
        setProgress(Math.round((processedFiles / totalFiles) * 100));
        setProcessingMessage(
          `Đang xử lý file ${i + 1}/${targets.length}: ${item.name}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10));

        const isMktFile =
          String(item.bank || "").toUpperCase().includes("MKT") ||
          String(item.name || "").toUpperCase().includes("MKT") ||
          String(item.name || "").toUpperCase().includes("MARKETING");

        const effectiveBank = isMktFile ? "MKT LOCAL NORTH" : item.bank || "";

        try {
          const parsedWorkbook =
            preparedFiles.get(item.id) ||
            (await parseMasterFileInWorker(
              item.fileObj,
              isMktFile,
              masterAeFields,
            ));
          preparedMasterFilesRef.current.set(item.id, parsedWorkbook);
          const itemColumnMapping =
            item.columnMapping && Object.keys(item.columnMapping).length > 0
              ? item.columnMapping
              : parsedWorkbook.mapping;
          let fileProcessedSuccessfully = false;

          if (parsedWorkbook.sheetNames.length === 0) {
            throw new Error("File không có sheet nào.");
          }

          for (const parsedSheet of parsedWorkbook.sheets) {
            const { sheetName, rows } = parsedSheet;
            try {
              if (rows.length <= 1) continue;

              const normalizedSheetName = normalizeMasterSheetName(sheetName);
              let sheetProcessed = false;

              const isRosterSheet = isRosterMasterSheetName(sheetName);
              const isBankSheet = isBankMasterSheetName(sheetName);
              const isHoldSheet = isHoldMasterSheetName(sheetName);
              const isSheetOneSheet = isSheetOneMasterSheetName(sheetName);

              if (isRosterSheet) {
                let headerRowIndex = -1;
                for (let r = 0; r < Math.min(30, rows.length); r++) {
                  const rowStr = rows[r]
                    .map((c) => String(c || "").toUpperCase())
                    .join(" ");
                  if (
                    (rowStr.includes("FULL NAME") ||
                      rowStr.includes("HỌ VÀ TÊN") ||
                      rowStr.includes("HỌ TÊN") ||
                      rowStr.includes("TÊN") ||
                      rowStr.includes("NAME")) &&
                    (rowStr.includes("ID") ||
                      rowStr.includes("MÃ NV") ||
                      rowStr.includes("MANV") ||
                      rowStr.includes("DATE") ||
                      rowStr.includes("NGÀY") ||
                      rowStr.includes("TYPE") ||
                      rowStr.includes("CLASS"))
                  ) {
                    headerRowIndex = r;
                    break;
                  }
                }

                if (headerRowIndex === -1) {
                  headerRowIndex = 0;
                }

                foundAnySheet = true;
                sheetProcessed = true;
                const h = rows[headerRowIndex].map((c) => String(c || "").trim());

                const iCenter = getColIndex(h, "Center", {}, ["CENTER", "TRUNG TÂM", "MÃ AE", "AE CODE", "AE", "LOCATION"]);
                const iId = getColIndex(h, "ID Number", {}, ["ID", "MÃ NV", "MANV", "TEACHER ID", "EMP ID", "CODE"]);
                const iName = getColIndex(h, "Full name", {}, ["FULL NAME", "NAME", "HỌ VÀ TÊN", "TÊN", "HỌ TÊN"]);
                const iDate = getColIndex(h, "Date", {}, ["DATE", "NGÀY", "TK_DATE", "SESSION DATE", "DAY"]);
                const iType = getColIndex(h, "Type", {}, ["TYPE", "TASK TYPE", "CODE", "LOẠI", "ACTIVITY", "TASKTYPE"]);
                const iClass = getColIndex(h, "Class", {}, ["CLASS", "LỚP", "CLASS CODE", "MÃ LỚP"]);
                const iFrom = getColIndex(h, "From", {}, ["FROM", "START", "START TIME", "TỪ"]);
                const iTo = getColIndex(h, "To", {}, ["TO", "END", "END TIME", "ĐẾN"]);
                const iDuration = getColIndex(h, "Duration", {}, ["DURATION", "HOURS", "SỐ GIỜ", "GIỜ", "TK_DURATION", "TOTAL HOURS"]);
                const iNotes = getColIndex(h, "Notes", {}, ["NOTES", "NOTE", "GHI CHÚ", "REMARKS"]);
                const iChargeMkt = getColIndex(h, "Charge To Center MKT", {}, ["CHARGE TO CENTER MKT", "CHARGE TO CENTER", "CHARGETOCENTER"]);

                for (let r = headerRowIndex + 1; r < rows.length; r++) {
                  const row = rows[r];
                  if (!row || row.every((cell) => cell === "")) continue;

                  const rawCenter = iCenter !== -1 && row[iCenter] !== undefined ? String(row[iCenter]).trim() : "";
                  const info = getCenterInfoByAECode(rawCenter);
                  const l07 = info?.l07 || rawCenter || "UNKNOWN";
                  const business = info?.bus || "";

                  const ma_nv = iId !== -1 && row[iId] !== undefined ? String(row[iId]).trim() : "";
                  const full_name = iName !== -1 && row[iName] !== undefined ? String(row[iName]).trim() : "";
                  const ngay = iDate !== -1 && row[iDate] !== undefined ? String(row[iDate]).trim() : "";
                  const type = iType !== -1 && row[iType] !== undefined ? String(row[iType]).trim() : "";
                  const className = iClass !== -1 && row[iClass] !== undefined ? String(row[iClass]).trim() : "";
                  const gio_vao = iFrom !== -1 && row[iFrom] !== undefined ? String(row[iFrom]).trim() : "";
                  const gio_ra = iTo !== -1 && row[iTo] !== undefined ? String(row[iTo]).trim() : "";

                  const rawDuration = iDuration !== -1 && row[iDuration] !== undefined ? row[iDuration] : "";
                  const duration = parseDurationToHours(rawDuration);

                  const notes = iNotes !== -1 && row[iNotes] !== undefined ? String(row[iNotes]).trim() : "";
                  const chargeToCenterMkt = iChargeMkt !== -1 && row[iChargeMkt] !== undefined ? String(row[iChargeMkt]).trim() : "";
                  const pivotCenter = chargeToCenterMkt || rawCenter;
                  const pivotCenterInfo = getCenterInfoByAECode(pivotCenter);
                  const pivotL07 = pivotCenterInfo?.l07 || mapL07(pivotCenter) || l07;
                  const pivotBusiness = pivotCenterInfo?.bus || business;

                  rosterDataToAppend.push({
                    _rowId: generateUUID(),
                    _sourceFile: item.name || "",
                    center: rawCenter,
                    l07: pivotL07,
                    business: pivotBusiness,
                    ma_nv,
                    full_name,
                    ngay,
                    type,
                    class: className,
                    gio_vao,
                    gio_ra,
                    duration,
                    durationHours: duration,
                    notes,
                    chargeToCenterMkt,
                    chargeToCenterCode: chargeToCenterMkt,
                    employeeId: ma_nv,
                    fullName: full_name,
                    maAE: rawCenter,
                    date: ngay,
                    taskType: type,
                    classCode: className,
                    from: gio_vao,
                    to: gio_ra,
                    month: normalizeMonth(itemMonth),
                    _fileMonth: normalizeMonth(itemMonth),
                    isMktLocal: true
                  });
                }
              } else if (
                !isMktFile &&
                !isRosterSheet &&
                (isBankSheet ||
                  normalizedSheetName.includes("MKT") ||
                  normalizedSheetName.includes("MARKETING"))
              ) {
                let headerRowIndex = -1;
                for (let r = 0; r < Math.min(30, rows.length); r++) {
                  const rowStr = rows[r]
                    .map((c) => String(c || "").toUpperCase())
                    .join(" ");
                  if (
                    (rowStr.includes("FULL NAME") ||
                      rowStr.includes("HỌ VÀ TÊN") ||
                      rowStr.includes("TÊN")) &&
                    (rowStr.includes("ACCOUNT") ||
                      rowStr.includes("SỐ TÀI KHOẢN") ||
                      rowStr.includes("TÀI KHOẢN") ||
                      rowStr.includes("STK"))
                  ) {
                    headerRowIndex = r;
                    break;
                  }
                }

                if (headerRowIndex !== -1) {
                  foundAnySheet = true;
                  sheetProcessed = true;
                  const h = rows[headerRowIndex].map((c) =>
                    String(c || "").trim(),
                  );

                  const iS = getColIndex(h, "No", itemColumnMapping, [
                    "NO",
                    "STT",
                    "NO.",
                  ]);
                  const iId = getColIndex(h, "ID Number", itemColumnMapping, [
                    "ID",
                    "CMND",
                    "MÃ NV",
                  ]);
                  const iN = getColIndex(h, "Full name", itemColumnMapping, [
                    "NAME",
                    "TÊN",
                    "FULL NAME",
                    "HỌ VÀ TÊN",
                  ]);
                  const iA = getColIndex(
                    h,
                    "Bank Account Number",
                    itemColumnMapping,
                    ["ACCOUNT", "TÀI KHOẢN", "STK"],
                  );
                  const iT = getColIndex(
                    h,
                    "TOTAL PAYMENT",
                    itemColumnMapping,
                    ["TOTAL", "TỔNG", "THỰC NHẬN"],
                  );
                  const iP = getColIndex(
                    h,
                    "Payment details",
                    itemColumnMapping,
                    ["DETAILS", "NỘI DUNG", "DIỄN GIẢI", "DESCRIPTION"],
                  );
                  // const iBank = getColIndex(
                  //   h,
                  //   "Bank Name",
                  //   itemColumnMapping,
                  //   ["BANK", "NGÂN HÀNG", "TEN NGAN HANG", "TÊN NGÂN HÀNG"],
                  // );
                  const iCenter = getColIndex(h, "Center", itemColumnMapping, [
                    "CENTER",
                    "COST CENTER",
                    "TRUNG TÂM",
                    "AE CODE",
                    "AE",
                    "MÃ AE",
                  ]);

                  for (let r = headerRowIndex + 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.every((cell) => cell === "")) continue;

                    const rawTP =
                      iT !== -1 && row[iT] !== undefined ? row[iT] : "";
                    const t = parseMoneyToNumber(rawTP);
                    const nameVal =
                      iN !== -1 && row[iN] !== undefined
                        ? cleanFullName(row[iN])
                        : "";

                    // Force Bank Account Number to be string
                    let acc = "";
                    if (iA !== -1) {
                      const rawAcc = row[iA];
                      acc =
                        rawAcc !== undefined && rawAcc !== null
                          ? String(rawAcc).replace(/\s/g, "")
                          : "";
                      if (
                        typeof rawAcc === "number" &&
                        (acc.includes("E") || acc.includes("e"))
                      ) {
                        acc = rawAcc.toLocaleString("fullwide", {
                          useGrouping: false,
                        });
                      }
                    }

                    const idVal =
                      iId !== -1 && row[iId] !== undefined
                        ? cleanIDNumber(row[iId])
                        : "";

                    let type = "Liên ngân hàng";
                    if (!acc) type = "⚠️ Thiếu STK";
                    else if (acc.length < 6 || acc.length > 25)
                      type = "⚠️ Sai độ dài";
                    else if (acc.startsWith("0") || acc.startsWith("10"))
                      type = "Nội bộ VCB";

                    const rawCenterVal =
                      iCenter !== -1 && row[iCenter] !== undefined
                        ? String(row[iCenter]).trim()
                        : "";

                    const rawCenterKey = rawCenterVal.toLowerCase();
                    let l07 = rawCenterVal;
                    let business = "";

                    if (rawCenterVal) {
                      if (aeMap[rawCenterKey]) {
                        l07 = aeMap[rawCenterKey].name;
                        business = aeMap[rawCenterKey].bus;
                      } else {
                        const info = getCenterInfoByAECode(rawCenterVal);
                        if (info) {
                          l07 = info.l07;
                          business = info.bus;
                        } else {
                          const mapped = mapL07(rawCenterVal);
                          const info2 = getCenterInfoByL07(mapped);
                          if (info2) {
                            l07 = info2.l07;
                            business = info2.bus;
                          } else {
                            l07 = mapped;
                          }
                        }
                      }
                    }

                    // OVERRIDE FOR MKT
                    if (rawCenterVal.toUpperCase().trim() === "MKT LOCAL NORTH") {
                      l07 = "MKT LOCAL NORTH";
                      business = "AHN";
                    } else {
                      const mktRes2 = resolveMktAndCenterL07(rawCenterVal, "", item.name || "", l07);
                      if (mktRes2.isMktLocal) {
                        l07 = mktRes2.l07;
                        business = mktRes2.business;
                      }
                    }

                    bankData.push({
                      No: iS !== -1 && row[iS] !== undefined ? row[iS] : "",
                      "ID Number": idVal,
                      "Full name": nameVal,
                      L07: l07,
                      Business: business,
                      "Bank Account Number": acc,
                      "TOTAL PAYMENT": t,
                      "LOẠI CK": type,
                      "Payment details":
                        iP !== -1 && row[iP] !== undefined
                          ? String(row[iP]).trim()
                          : "",
                      "TÊN FILE": item.name || "",
                      _fileBank: effectiveBank,
                      _fileMonth: itemMonth,
                    });
                  }
                }
              }

              if (
                !isMktFile &&
                (normalizedSheetName.includes("SUMMER") ||
                  normalizedSheetName.includes("BONUS"))
              ) {
                let headerRowIndex = -1;
                for (let r = 0; r < Math.min(50, rows.length); r++) {
                  const rowStr = rows[r].map(c => String(c || "").toUpperCase()).join(" ");
                  if (rowStr.includes("BONUS") && (rowStr.includes("INSTRUCTOR") || rowStr.includes("CENTER"))) {
                    headerRowIndex = r;
                    break;
                  }
                }

                if (headerRowIndex !== -1) {
                  foundAnySheet = true;
                  sheetProcessed = true;
                  const h = rows[headerRowIndex].map(c => String(c || "").trim());
                  
                  const iCenter = getColIndex(h, "Center", itemColumnMapping, ["NORTH CENTER", "DEPARTMENT NAME", "CENTER", "CENTER NOTE", "CENTERS", "TRUNG TÂM", "MÃ AE", "L07"]);
                  const iName = getColIndex(h, "Full name", itemColumnMapping, ["HỌ & TÊN INSTRUCTOR", "NAME", "INSTRUCTOR"]);
                  const iId = getColIndex(h, "ID Number", itemColumnMapping, ["SỐ CCCD INSTRUCTOR", "ID NUMBER", "CCCD"]);
                  const iBonus = getColIndex(h, "TOTAL PAYMENT", itemColumnMapping, ["BONUS"]);

                  for (let r = headerRowIndex + 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.every(cell => cell === "")) continue;

                    const rawBonus = iBonus !== -1 ? row[iBonus] : 0;
                    const bonusVal = parseMoneyToNumber(rawBonus);
                    if (bonusVal === 0) continue;

                    const idVal = iId !== -1 ? cleanIDNumber(row[iId]) : "";
                    const nameVal = iName !== -1 ? cleanFullName(row[iName]) : "";
                    const centerVal = iCenter !== -1 ? String(row[iCenter] || "").trim() : "";

                    // Resolve Center to BU/L07
                    let l07 = centerVal;
                    let business = "";
                    const centerKey = centerVal.toLowerCase();
                    const mappedSummerCenter = aeMap[centerKey]?.name || centerVal;
                    const resolvedSummerCenter = resolveSummerBonusCenterL07(mappedSummerCenter);
                    l07 = resolvedSummerCenter.l07;
                    business = resolvedSummerCenter.business || aeMap[centerKey]?.bus || "";
                    
                    sheet1Data.push({
                      "No.": sheet1Data.length + 1,
                      "Tháng báo cáo": itemMonth,
                      "ID Number": idVal,
                      "Full name": nameVal,
                      "Extra Summer Instructors": bonusVal,
                      "CHARGE TO EXTRA SUMMER INSTRUCTORS": bonusVal,
                      "TOTAL PAYMENT": bonusVal,
                      "BU": business,
                      "Business": business,
                      "L07": l07,
                      "Sheet Source": sheetName,
                      "Note": `Summer Bonus - ${centerVal}`,
                      "TÊN FILE": item.name || "",
                      _fileMonth: itemMonth
                    });
                  }
                }
              }

              if (
                !isMktFile &&
                (isHoldSheet || normalizedSheetName.includes("ADD"))
              ) {
                let headerRowIndex = -1;
                for (let r = 0; r < Math.min(30, rows.length); r++) {
                  const rowStr = rows[r]
                    .map((c) => String(c || "").toUpperCase())
                    .join(" ");
                  if (
                    (rowStr.includes("FULL NAME") ||
                      rowStr.includes("HỌ VÀ TÊN") ||
                      rowStr.includes("TÊN") ||
                      rowStr.includes("CMND")) &&
                    (rowStr.includes("SỐ TÀI KHOẢN") ||
                      rowStr.includes("TÀI KHOẢN") ||
                      rowStr.includes("STK") ||
                      rowStr.includes("TOTAL PAYMENT") ||
                      rowStr.includes("THỰC NHẬN") ||
                      rowStr.includes("TỔNG") ||
                      rowStr.includes("CENTER") ||
                      rowStr.includes("SỐ TIỀN") ||
                      rowStr.includes("PHÁT SINH"))
                  ) {
                    headerRowIndex = r;
                    break;
                  }
                }

                foundAnySheet = true;
                sheetProcessed = true;

                // Identify file month 
                let fileMonthNum = -1;
                const monthStr = appData.globalMonth || "03.2026";
                const lowerMonth = String(monthStr).toLowerCase().trim();
                const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                for (let i = 0; i < monthNames.length; i++) {
                  if (lowerMonth.includes(monthNames[i])) {
                    fileMonthNum = i + 1;
                    break;
                  }
                }
                if (fileMonthNum === -1) {
                  const match = lowerMonth.match(/(?:t|tháng|thang)\s*(\d{1,2})/);
                  if (match) fileMonthNum = parseInt(match[1], 10);
                  else {
                    const match2 = lowerMonth.match(/(\d{1,2})\/\d{4}/);
                    if (match2) fileMonthNum = parseInt(match2[1], 10);
                    else {
                      const match3 = lowerMonth.match(/\b(0?[1-9]|1[0-2])\b/);
                      if (match3) fileMonthNum = parseInt(match3[1], 10);
                    }
                  }
                }

                const getRowShouldNegate = (_noteValue: string) => {
                  void _noteValue;
                  let rowShouldNegate = false;
                  const sheetSource = sheetName;
                  
                  // Determine negation ONLY from the sheetName itself, never from the adjacent Note column.
                  // The Note column has absolutely zero impact on the Sheet Source or whether the Total Payment is negated.
                  if (isHoldSheet && fileMonthNum !== -1) {
                    const ssMatch = normalizedSheetName.match(
                      /(?:T|THANG|HOLD T|HOLD THANG|HOLD)\s*(\d{1,2})/,
                    );
                    if (ssMatch) {
                      if (parseInt(ssMatch[1], 10) === fileMonthNum) rowShouldNegate = true;
                    } else {
                      const allNumbers = normalizedSheetName.match(/\d+/g);
                      if (allNumbers) {
                        for (const m of allNumbers) {
                          if (parseInt(m, 10) === fileMonthNum) {
                            rowShouldNegate = true;
                            break;
                          }
                        }
                      }
                    }
                  }
                  return { rowShouldNegate, sheetSource };
                };

                if (headerRowIndex !== -1) {
                  // Header found - use dynamic mapping
                  const h = rows[headerRowIndex].map((c) =>
                    String(c || "").trim(),
                  );
                  const iId = getColIndex(h, "ID Number", itemColumnMapping, [
                    "ID",
                    "CMND",
                    "MÃ NV",
                    "CĂN CƯỚC",
                  ]);
                  const iN = getColIndex(h, "Full name", itemColumnMapping, [
                    "NAME",
                    "TÊN",
                    "NV",
                    "GIÁO VIÊN",
                    "KHÁCH HÀNG",
                    "FULL NAME",
                    "HỌ VÀ TÊN",
                  ]);
                  const iA = getColIndex(
                    h,
                    "Bank Account Number",
                    itemColumnMapping,
                    ["ACCOUNT", "TÀI KHOẢN", "STK"],
                  );
                  const iT = getColIndex(
                    h,
                    "TOTAL PAYMENT",
                    itemColumnMapping,
                    ["TOTAL", "TỔNG", "THỰC NHẬN", "SỐ TIỀN", "TIỀN", "SỐ PHÁT SINH", "PHÁT SINH", "HOLD", "HOLD T3"],
                  );
                  // const iBank = getColIndex(
                  //   h,
                  //   "Bank Name",
                  //   itemColumnMapping,
                  //   ["BANK", "NGÂN HÀNG", "TEN NGAN HANG", "TÊN NGÂN HÀNG"],
                  // );
                  const iThang = getColIndex(h, "Tháng", itemColumnMapping, [
                    "THÁNG",
                    "MONTH",
                    "KỲ",
                  ]);
                  const iNghiepVu = getColIndex(
                    h,
                    "Nghiệp vụ",
                    itemColumnMapping,
                    ["NGHIỆP VỤ", "LOẠI", "OPERATION"],
                  );
                  const iTax = getColIndex(h, "TAX CODE", itemColumnMapping, [
                    "TAX",
                    "MST",
                  ]);
                  const iContract = getColIndex(
                    h,
                    "Contract No",
                    itemColumnMapping,
                    ["CONTRACT", "HỢP ĐỒNG"],
                  );
                  const iCenter = getColIndex(
                    h,
                    "Center",
                    itemColumnMapping,
                    ["CENTER NOTE", "CENTER", "CENTERS", "TRUNG TÂM", "MÃ AE"],
                  );
                  const iNote = getColIndex(h, "Note", itemColumnMapping, [
                    "NOTE",
                    "GHI CHÚ",
                  ]);

                  for (let r = headerRowIndex + 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length < 3) continue;

                    const idVal =
                      iId !== -1 && row[iId] !== undefined
                        ? cleanIDNumber(row[iId])
                        : "";
                    const nameVal =
                      iN !== -1 && row[iN] !== undefined
                        ? cleanFullName(row[iN])
                        : "";

                    let accVal = "";
                    if (iA !== -1) {
                      const rawAcc = row[iA];
                      accVal =
                        rawAcc !== undefined && rawAcc !== null
                          ? String(rawAcc).replace(/\s/g, "")
                          : "";
                      if (
                        typeof rawAcc === "number" &&
                        (accVal.includes("E") || accVal.includes("e"))
                      ) {
                        accVal = rawAcc.toLocaleString("fullwide", {
                          useGrouping: false,
                        });
                      }
                    }

                    const taxCode =
                      iTax !== -1 && row[iTax] !== undefined
                        ? String(row[iTax]).trim()
                        : "";
                    const contractNo =
                      iContract !== -1 && row[iContract] !== undefined
                        ? String(row[iContract]).trim()
                        : "";
                    const rawTP =
                      iT !== -1 && row[iT] !== undefined ? row[iT] : "";
                    const note =
                      iNote !== -1 && row[iNote] !== undefined
                        ? String(row[iNote]).trim()
                        : "";
                    const sourceMonth =
                      iThang !== -1 && row[iThang] !== undefined
                        ? String(row[iThang]).trim()
                        : "";
                    const sourceOperation =
                      iNghiepVu !== -1 && row[iNghiepVu] !== undefined
                        ? String(row[iNghiepVu]).trim()
                        : "";

                    const { rowShouldNegate, sheetSource } = getRowShouldNegate(note);

                    let numTP = parseMoneyToNumber(rawTP);
                    if (rowShouldNegate) {
                      numTP = -Math.abs(numTP);
                    }

                    const centerNote =
                      iCenter !== -1 && row[iCenter] !== undefined
                        ? String(row[iCenter]).trim()
                        : "";

                    if (!idVal && !nameVal && numTP === 0) continue;
                    
                    holdData.push({
                      "No.": holdData.length + 1,
                      "ID Number": idVal,
                      "Full name": nameVal,
                      "Bank Account Number": accVal,
                      "TAX CODE": taxCode,
                      "Contract No": contractNo,
                      "TOTAL PAYMENT": numTP,
                      "Mã ae": centerNote,
                      "Sheet Source": sheetSource,
                      "Nghiệp vụ": sheetSource.toUpperCase().includes("ADD") ? "ADD" : "Hold",
                      Note: note,
                      "TÊN FILE": item.name || "",
                      _fileBank: effectiveBank,
                      _fileMonth: itemMonth,
                      _sourceMonth: sourceMonth,
                      _sourceOperation: sourceOperation,
                    });
                  }
                } else {
                  // No header found - extract data from column B to I (indices 1 to 8)
                  // Columns expected: ID Number (B), Full name (C), Bank / Tax (D/E), Contract No (F), TOTAL PAYMENT (G), CENTER (H), NOTE (I)
                  const getValidVals = (cIndex: number) => {
                    const s = new Set<string>();
                    for (let r = 0; r < rows.length; r++) {
                      const row = rows[r];
                      if (!row || row.length === 0) continue;
                      const val = String(row[cIndex] || "").trim();
                      if (val && val.length > 2 && val.toUpperCase() !== "NULL" && val !== "0" && !val.match(/^[0]+$/)) {
                        s.add(val);
                      }
                    }
                    return s;
                  };

                  let cID = 1, cBank = 3, cTax = 4;
                  const s1 = getValidVals(1);
                  const s3 = getValidVals(3);
                  const s4 = getValidVals(4);

                  const intersects = (setA: Set<string>, setB: Set<string>) => {
                    for (const elem of setB) {
                      if (setA.has(elem)) return true;
                    }
                    return false;
                  };

                  if (intersects(s1, s3)) {
                    // Cột B trùng với cột D -> Cột B là ID, D là TAX, còn lại E là Bank
                    cID = 1; cTax = 3; cBank = 4;
                  } else if (intersects(s1, s4)) {
                    // Cột B trùng với cột E -> Cột B là ID, E là TAX, còn lại D là Bank
                    cID = 1; cTax = 4; cBank = 3;
                  } else if (intersects(s3, s4)) {
                    // Không xác định được với B, nhưng D và E trùng nhau -> D và E là ID và TAX, cột còn lại cột B quan trọng nhất là Bank
                    cBank = 1; cID = 3; cTax = 4;
                  }

                  for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || row.length === 0) continue;

                    const idVal = cleanIDNumber(row[cID]);
                    const nameVal = cleanFullName(row[2]);
                    let accVal = String(row[cBank] || "").trim();
                    const taxCode = String(row[cTax] || "").trim();
                    const contractNo = String(row[5] || "").trim();
                    
                    const centerNote = String(row[7] || "").trim();
                    const note = String(row[8] || "").trim();

                    const { rowShouldNegate, sheetSource } = getRowShouldNegate(note);
                    const nghiepVu = sheetSource.toUpperCase().includes("ADD") ? "ADD" : "Hold";

                    const rawTP = row[6] !== undefined ? row[6] : "";
                    let numTP = parseMoneyToNumber(rawTP);
                    if (rowShouldNegate) {
                      numTP = -Math.abs(numTP);
                    }

                    if (!idVal && !nameVal && numTP === 0) continue;
                    if (idVal && !nameVal && numTP === 0 && idVal.toUpperCase().includes("HOLD")) continue;
                    if (idVal.toUpperCase() === "ID NUMBER" || nameVal.toUpperCase() === "FULL NAME") continue;

                    if (row[cBank] !== undefined && row[cBank] !== null) {
                      accVal = String(row[cBank]).replace(/\s/g, "");
                      if (typeof row[cBank] === "number" && (accVal.includes("E") || accVal.includes("e"))) {
                        accVal = Number(row[cBank]).toLocaleString("fullwide", { useGrouping: false });
                      }
                    }

                    holdData.push({
                      "No.": holdData.length + 1,
                      "ID Number": idVal,
                      "Full name": nameVal,
                      "Bank Account Number": accVal,
                      "TAX CODE": taxCode,
                      "Contract No": contractNo,
                      "TOTAL PAYMENT": numTP,
                      "Mã ae": centerNote,
                      "Sheet Source": sheetSource,
                      "Nghiệp vụ": nghiepVu,
                      Note: note,
                      "TÊN FILE": item.name || "",
                      _fileBank: effectiveBank,
                      _fileMonth: itemMonth,
                    });
                  }
                }
              }

              if (!isMktFile && isSheetOneSheet) {
                let headerRowIndex = -1;
                for (let r = 0; r < Math.min(30, rows.length); r++) {
                  const rowStr = rows[r]
                    .map((c) => String(c || "").toUpperCase())
                    .join(" ");
                  let matchCount = 0;
                  if (
                    rowStr.includes("FULL NAME") ||
                    rowStr.includes("HỌ VÀ TÊN") ||
                    rowStr.includes("TÊN NHÂN VIÊN")
                  )
                    matchCount++;
                  if (
                    rowStr.includes("ID NUMBER") ||
                    rowStr.includes("MÃ NV") ||
                    rowStr.includes("ID")
                  )
                    matchCount++;
                  if (
                    rowStr.includes("TOTAL PAYMENT") ||
                    rowStr.includes("THỰC NHẬN") ||
                    rowStr.includes("TỔNG")
                  )
                    matchCount++;

                  if (matchCount >= 2) {
                    headerRowIndex = r;
                    break;
                  }
                }

                if (headerRowIndex !== -1) {
                  foundAnySheet = true;
                  sheetProcessed = true;
                  const h = rows[headerRowIndex].map((c) =>
                    String(c || "").trim(),
                  );
                  const colIndices: Record<string, number> = {};
                  sheet1Headers.forEach((th) => {
                    if (th === "L07" || th === "Business") return;

                    const fuzzyMap: Record<string, string[]> = {
                      "Full name": ["FULL NAME", "HỌ VÀ TÊN", "TÊN NHÂN VIÊN"],
                      "ID Number": ["ID", "MÃ NV", "CMND", "MÃ NHÂN VIÊN", "EMPLOYEE ID", "CĂN CƯỚC"],
                      "Bank Account Number": ["ACCOUNT", "TÀI KHOẢN", "STK", "SỐ TÀI KHOẢN"],
                      "TOTAL PAYMENT": ["TOTAL", "TỔNG", "THỰC NHẬN", "TỔNG THANH TOÁN"],
                      "Bank Name": ["BANK NAME", "NGÂN HÀNG"],
                      Bank: [
                        "BANK",
                        "NGÂN HÀNG",
                        "TEN NGAN HANG",
                        "TÊN NGÂN HÀNG",
                      ],
                      Tháng: ["THÁNG", "MONTH", "KỲ"],
                      "CHARGE TO LXO": ["LXO", "CHARGE LXO", "CHARGE TO LXO", "CHARGE LXP"],
                      "CHARGE TO EC": ["EC", "CHARGE EC", "CHARGE TO EC"],
                      "CHARGE TO PT-DEMO": ["PT-DEMO", "CHARGE PT-DEMO", "CHARGE TO PT-DEMO"],
                      "LDEC01": ["LDEC01", "LDEC", "CHARGE TO LDEC01", "CHARGE LDEC01"],
                      "LDEM01": ["LDEM01", "LDEM", "CHARGE TO LDEM01", "CHARGE LDEM01"],
                      "LPAR01": ["LPAR01", "LPAR", "CHARGE TO LPAR01", "CHARGE LPAR01"],
                      "LRET01": ["LRET01", "LRET", "CHARGE TO LRET01", "CHARGE LRET01"],
                      "MOTH01": ["MOTH01", "MOTH", "CHARGE TO MOTH01", "CHARGE MOTH01"],
                      "Charge MKT Local": ["MKT", "MKT LOCAL", "CHARGE MKT LOCAL", "CHARGE TO MKT LOCAL", "CHARGE MKT", "CHARGE TO CENTER MKT"],
                      "CHARGE TO OTHER": ["CHARGE OTHER", "CHARGE TO OTHER", "OTHER"],
                      "Charge Renewal Projects": ["RENEWAL", "RENEWAL PROJECTS", "CHARGE TO RENEWAL PROJECTS", "CHARGE RENEWAL"],
                      "Charge Discovery Camp": ["DISCOVERY", "DISCOVERY CAMP", "CHARGE TO DISCOVERY CAMP", "CHARGE DISCOVERY"],
                      "Charge Summer Outing": ["SUMMER OUTING", "CHARGE TO SUMMER OUTING", "CHARGE SUMMER"],
                      "Charge Summer Instructors": ["SUMMER INSTRUCTORS", "CHARGE TO SUMMER INSTRUCTORS", "CHARGE INSTRUCTOR", "CHARGE INSTRUCTORS"],
                      "Extra Summer Instructors": ["EXTRA SUMMER INSTRUCTORS", "CHARGE TO EXTRA SUMMER INSTRUCTORS", "EXTRA INSTRUCTOR", "EXTRA INSTRUCTORS", "EXTRA SUMMER INSTRUCTOR", "EXTRA INSTRUCTOR BONUS", "SUMMER INSTRUCTORS BONUS", "BONUS"],
                      "TAX CODE": ["TAX", "MST", "MÃ SỐ THUẾ", "TAX CODE", "MÃ ST"],
                      "Contract No": ["CONTRACT", "HỢP ĐỒNG", "SỐ HỢP ĐỒNG", "CONTRACT NO"],
                      "CITAD code": ["CITAD", "MÃ CITAD", "CITAD CODE", "CITAD CHECK"],
                    };

                    colIndices[th] = getColIndex(
                      h,
                      th,
                      itemColumnMapping,
                      fuzzyMap[th] || [],
                    );
                  });

                  let centerColIndex = getColIndex(
                    h,
                    "L07",
                    itemColumnMapping,
                    [
                      "L07",
                      "TRUNG TÂM (L07)",
                      "CƠ SỞ (L07)",
                      "MÃ L07",
                      "MA L07",
                      "L07/TRUNG TÂM",
                      "LOCATION",
                      "SITE",
                      "BRANCH",
                    ],
                  );

                  if (centerColIndex === -1) {
                    centerColIndex = getColIndex(
                      h,
                      "Center",
                      itemColumnMapping,
                      [
                        "CENTER",
                        "COST CENTER",
                        "CENTERS",
                        "TRUNG TÂM",
                        "CƠ SỞ",
                        "TRUNG TAM",
                      ],
                    );
                  }

                  if (centerColIndex === -1) {
                    centerColIndex = getColIndex(
                      h,
                      "Mã AE",
                      itemColumnMapping,
                      [
                        "MÃ AE",
                        "MÃ CENTERS",
                        "MÃ TT",
                        "AE",
                      ],
                    );
                  }

                  if (centerColIndex === -1) {
                    centerColIndex = h.findIndex((colHeader) => {
                      const u = String(colHeader || "").toUpperCase().trim();
                      return (
                        u === "L07" ||
                        u === "CENTER" ||
                        u.includes("(L07)")
                      );
                    });
                  }

                  for (let r = headerRowIndex + 1; r < rows.length; r++) {
                    const row = rows[r];
                    // const idxTP = colIndices["TOTAL PAYMENT"];
                    // const rawTP =
                    //   idxTP !== -1 && row[idxTP] !== undefined
                    //     ? row[idxTP]
                    //     : "";
                    // const numTP = parseMoneyToNumber(rawTP);

                    const idxAcc = colIndices["Bank Account Number"];
                    let accVal = "";
                    if (idxAcc !== -1) {
                      const rawAcc = row[idxAcc];
                      accVal =
                        rawAcc !== undefined && rawAcc !== null
                          ? String(rawAcc).trim()
                          : "";
                      if (
                        typeof rawAcc === "number" &&
                        (accVal.includes("E") || accVal.includes("e"))
                      ) {
                        accVal = rawAcc.toLocaleString("fullwide", {
                          useGrouping: false,
                        });
                      }
                    }

                    const idxName = colIndices["Full name"];
                    const nameVal =
                      idxName !== -1 && row[idxName] !== undefined
                        ? cleanFullName(row[idxName])
                        : "";

                    const idxT = colIndices["TOTAL PAYMENT"];
                    const rawTP = idxT !== -1 ? row[idxT] : 0;
                    const numTP = parseMoneyToNumber(rawTP);

                    if (!accVal && numTP === 0) continue;

                    if (
                      (nameVal !== "" || idxName === -1)
                    ) {
                      const obj: any = {};
                      sheet1Headers.forEach((th) => {
                        if (th === "L07" || th === "Business") return;
                        const idx = colIndices[th];
                        let val =
                          idx !== -1 && row[idx] !== undefined ? row[idx] : "";

                        const valStr = String(val).toUpperCase().trim();
                        if (
                          valStr === "NA" ||
                          valStr === "N/A" ||
                          valStr === "#N/A" ||
                          valStr === "NAN"
                        ) {
                          val = "";
                        }

                        if (th === "Bank Account Number") {
                          val = accVal;
                        } else if (isMoneyColumn(th)) {
                          val = parseMoneyToNumber(val);
                        }

                        obj[th] = val;
                      });

                      const rawCenterVal =
                        centerColIndex !== -1
                          ? String(row[centerColIndex] || "").trim()
                          : "";
                      obj["_rawAE"] = rawCenterVal;

                      let l07 = rawCenterVal;
                      let business = "";

                      if (rawCenterVal) {
                        const rawCenterKey = rawCenterVal.toLowerCase();
                        if (aeMap[rawCenterKey]) {
                          const mappedName = aeMap[rawCenterKey].name;
                          const formalInfo = getCenterInfoByL07(mappedName) || getCenterInfoByAECode(mappedName);
                          l07 = formalInfo ? formalInfo.l07 : mappedName;
                          business = aeMap[rawCenterKey].bus;
                        } else {
                          const info = getCenterInfoByAECode(rawCenterVal);
                          if (info) {
                            l07 = info.l07;
                            business = info.bus;
                          } else {
                            const mapped = mapL07(rawCenterVal);
                            const info2 = getCenterInfoByL07(mapped);
                            if (info2) {
                              l07 = info2.l07;
                              business = info2.bus;
                            } else {
                              l07 = mapped || rawCenterVal || "UNKNOWN";
                            }
                          }
                        }
                      }

                      // OVERRIDE FOR MKT
                      if (rawCenterVal.toUpperCase().trim() === "MKT LOCAL NORTH") {
                        l07 = "MKT LOCAL NORTH";
                        business = "AHN";
                      } else {
                        const mktRes3 = resolveMktAndCenterL07(rawCenterVal, "", item.name || "", l07);
                        if (mktRes3.isMktLocal) {
                          l07 = mktRes3.l07;
                          business = mktRes3.business;
                        }
                      }

                      obj["L07"] = l07;
                      obj["Business"] = business;
                      obj["TÊN FILE"] = item.name || "";
                      obj["_fileBank"] = effectiveBank;
                      obj["_fileMonth"] = normalizeMonth(itemMonth);
                      obj["Tháng báo cáo"] = normalizeMonth(itemMonth);
                      obj["Tháng"] = normalizeMonth(itemMonth);
                      obj["month"] = normalizeMonth(itemMonth);
                      sheet1Data.push(obj);
                    }
                  }
                }
              }

              if (!isMktFile && normalizedSheetName.includes("SO SANH AE")) {
                foundAnySheet = true;
                sheetProcessed = true;
                for (let r = 1; r < rows.length; r++) {
                  const row = rows[r];
                  soSanhAeData.push({
                    "ID Number": row[0] || "",
                    "Full name": row[1] || "",
                    "Sheet 1 AE": row[2] || 0,
                    "Bank North AE": row[3] || 0,
                    "Chênh Lệch": row[4] || 0,
                  });
                }
              }

              if (sheetProcessed) fileProcessedSuccessfully = true;
            } catch (sheetError: any) {
              console.error(
                `Lỗi xử lý sheet ${sheetName} trong file ${item.name}:`,
                sheetError,
              );
            }
          }

          if (fileProcessedSuccessfully) {
            statusById.set(item.id, "Success");
          } else {
            statusById.set(item.id, "Error: Invalid format");
          }
        } catch (e: any) {
          statusById.set(item.id, `Error: ${e.message}`);
        } finally {
          preparedMasterFilesRef.current.delete(item.id);
          preparedFiles.delete(item.id);
        }
      }

      if (!foundAnySheet) {
        updateAppData(
          (prev) => ({
            ...prev,
            Ae_Global_Inputs: prev.Ae_Global_Inputs.map((row) => ({
              ...row,
              status: statusById.get(row.id) || row.status,
            })),
          }),
          false,
        );
        toast.error(
          "Không tìm thấy Sheet 'BANK', 'SHEET 1', 'HOLD', 'ADD' hoặc 'SO SÁNH AE' hợp lệ!",
        );
        return;
      }

      setProcessingMessage("Đang tổng hợp và khử trùng dữ liệu...");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const finalSheet1Data: any[] = [];
      const seenSheet1Keys = new Set();
      sheet1Data.forEach((row) => {
        // TẠI CỘT L07 SẼ CHUYỂN HẾT SỐ LIỆU TỪ CỘT OTHER VỀ CỘT CHARGE MKT LOCAL
        const l07Upper = String(row["L07"] || "").trim().toUpperCase();
        if (

          l07Upper === "MKT LOCAL NORTH"
        ) {
          const otherAmt = parseMoneyToNumber(row["CHARGE TO OTHER"] || 0);
          if (otherAmt > 0) {
            const currentMkt = parseMoneyToNumber(row["Charge MKT Local"] || 0);
            row["Charge MKT Local"] = currentMkt + otherAmt;
            row["CHARGE TO OTHER"] = 0;
          }
        }

        // Sheet 1 TOTAL PAYMENT is authoritative. Only derive it from the
        // visible charge columns when the source file does not provide a
        // usable total; otherwise new/custom charge columns would be lost.
        const calcPayment = resolveGrossPayTotal(row);
        row["TOTAL PAYMENT"] = calcPayment;

        const idNum = String(row["ID Number"] || "").trim();
        const fname = String(row["Full name"] || "").trim();
        const l07 = String(row["L07"] || "").trim();
        const rowMonth = normalizeMonth(row["Tháng báo cáo"] || row["_fileMonth"] || appData.globalMonth || "03.2026");
        row["Tháng báo cáo"] = rowMonth;
        const total = calcPayment;
        const key = `${idNum}|${fname}|${l07}|${rowMonth}|${total}`;
        if (!seenSheet1Keys.has(key)) {
          row.id = generateUUID();
          finalSheet1Data.push(row);
          seenSheet1Keys.add(key);
        }
      });

      const finalBankData: any[] = [];
      const seenBankKeys = new Set();
      bankData.forEach((row) => {
        const idNum = String(row["ID Number"] || "").trim();
        const fname = String(row["Full name"] || "").trim();
        const acc = String(row["Bank Account Number"] || "").trim();
        const rowMonth = normalizeMonth(row["Tháng báo cáo"] || row["_fileMonth"] || appData.globalMonth || "03.2026");
        
        // Bỏ qua nếu Bank Account Number trống (theo yêu cầu)
        if (!acc) return;
        
        const total = parseMoneyToNumber(row["TOTAL PAYMENT"]);
        const key = `${idNum}|${fname}|${acc}|${rowMonth}|${total}`;
        if (!seenBankKeys.has(key)) {
          row.id = generateUUID();
          row["No"] = finalBankData.length + 1;
          finalBankData.push(row);
          seenBankKeys.add(key);
        }
      });

      const finalHoldData: any[] = [];
      holdData.forEach((row) => {
        row["No"] = finalHoldData.length + 1;

        const rawCenterVal = String(row["Mã ae"] || row["CENTER"] || "").trim();
        const aeMap = appData.AE_Map;

        let l07 = String(row["L07"] || "").trim() || rawCenterVal;
        let business = String(row["Business"] || row["BU"] || "").trim();

        if (rawCenterVal) {
          const rawKey = rawCenterVal.toLowerCase();
          if (aeMap[rawKey]) {
            const mappedName = aeMap[rawKey].name;
            const formalInfo = getCenterInfoByL07(mappedName) || getCenterInfoByAECode(mappedName);
            l07 = formalInfo ? formalInfo.l07 : mappedName;
            business = aeMap[rawKey].bus;
          } else {
            const info = getCenterInfoByAECode(rawCenterVal);
            if (info) {
              l07 = info.l07;
              business = info.bus;
            } else {
              const mapped = mapL07(rawCenterVal);
              const info2 = getCenterInfoByL07(mapped);
              if (info2) {
                l07 = info2.l07;
                business = info2.bus;
              } else {
                l07 = mapped;
              }
            }
          }
        }

        row["L07"] = l07;
        row["Business"] = business;
        row["BU"] = business;
        row.id = generateUUID();

        finalHoldData.push(row);
      });

      // 4. TỰ ĐỘNG ĐỐI SOÁT (RECONCILIATION LOGIC)
      setProcessingMessage("Đang tự động đối soát Sheet 1 và Bank...");
      setProgress(95);
      const finalSoSanhAeData: any[] = [];
      const sheet1Map: Record<string, any> = {};

      // Tạo Map cho Sheet 1 để tra cứu nhanh
      finalSheet1Data.forEach((row) => {
        const id = String(row["ID Number"] || "").trim();
        if (id) {
          if (!sheet1Map[id]) sheet1Map[id] = [];
          sheet1Map[id].push(row);
        }
      });

      const processedSheet1Ids = new Set<string>();

      // Duyệt qua dữ liệu Bank để so sánh
      finalBankData.forEach((bankRow) => {
        const id = String(bankRow["ID Number"] || "").trim();
        const bankAmount = parseMoneyToNumber(bankRow["TOTAL PAYMENT"]);
        const sheet1Rows = id ? sheet1Map[id] : null;

        if (sheet1Rows && sheet1Rows.length > 0) {
          const sheet1Total = sheet1Rows.reduce(
            (sum: number, r: any) =>
              sum + parseMoneyToNumber(r["TOTAL PAYMENT"]),
            0,
          );
          const diff = sheet1Total - bankAmount;

          finalSoSanhAeData.push({
            "ID Number": id,
            "Full name": bankRow["Full name"] || sheet1Rows[0]["Full name"],
            "Sheet 1 AE": sheet1Total,
            "Bank North AE": bankAmount,
            "Chênh Lệch": diff,
            "Ghi chú":
              diff === 0
                ? "Khớp"
                : diff > 0
                  ? "Thừa AE duyệt"
                  : "Thiếu AE duyệt",
          });
          processedSheet1Ids.add(id);

          // (Removed auto-pushing to Hold based on user requirement: 'chỉ lấy các sheet chứa từ Hold')
        } else {
          const diff = -bankAmount;
          finalSoSanhAeData.push({
            "ID Number": id,
            "Full name": bankRow["Full name"],
            "Sheet 1 AE": 0,
            "Bank North AE": bankAmount,
            "Chênh Lệch": diff,
            "Ghi chú": "Thiếu Sheet 1 (Chưa duyệt)",
          });

          // (Removed auto-pushing to Hold based on user requirement)
        }
      });

      // Kiểm tra những người có trong Sheet 1 nhưng không có trong Bank
      Object.keys(sheet1Map).forEach((id) => {
        if (!processedSheet1Ids.has(id)) {
          const sheet1Rows = sheet1Map[id];
          const sheet1Total = sheet1Rows.reduce(
            (sum: number, r: any) =>
              sum + parseMoneyToNumber(r["TOTAL PAYMENT"]),
            0,
          );

          finalSoSanhAeData.push({
            "ID Number": id,
            "Full name": sheet1Rows[0]["Full name"],
            "Sheet 1 AE": sheet1Total,
            "Bank North AE": 0,
            "Chênh Lệch": sheet1Total,
            "Ghi chú": "Thừa Sheet 1 (Bank không gửi)",
          });
        }
      });

      // Lọc các bản ghi có số tiền thanh toán khác 0 cho Sheet 1 và KHÔNG ĐƯỢC TRỐNG ID NUMBER
      const verifiedSheet1Data = finalSheet1Data.filter(r => {
        const idNum = String(r["ID Number"] || r["id_number"] || "").trim();
        if (!idNum) return false; // Trống ID Number tại Gross Pay thì hoàn toàn bỏ qua
        const tp = parseMoneyToNumber(r["TOTAL PAYMENT"] || 0);
        const hasAcc = r["Bank Account Number"] && String(r["Bank Account Number"]).trim() !== "";
        return tp !== 0 || hasAcc;
      });
      const verifiedHoldData = finalHoldData;

      // Cập nhật map BU, L07 từ Sheet 1 cho Hold Data
      verifiedHoldData.filter(Boolean).forEach((row) => {
        const id = row["ID Number"];
        if (id && sheet1Map[id] && sheet1Map[id].length > 0) {
          row["L07"] = row["L07"] || sheet1Map[id][0]["L07"];
          row["BU"] = row["BU"] || sheet1Map[id][0]["Business"] || sheet1Map[id][0]["BU"];
        }
      });

      updateAppData((prev) => {
        const currentMonth = prev.globalMonth || "03.2026";
        const existingHoldData = prev.Hold_AE?.data || [];
        const uploadTime = new Date().toISOString();

        // Standardize monthly values and fields for new incoming rows
        verifiedHoldData.filter(Boolean).forEach((row) => {
          let rMonth = currentMonth;
          let rNghiepVu = row["Nghiệp vụ"] || "";

          if (row._sourceMonth) rMonth = String(row._sourceMonth).trim();
          if (row._sourceOperation) {
            rNghiepVu = String(row._sourceOperation).trim();
          }

          const rawMonth = row["Tháng báo cáo"] || row["_fileMonth"] || rMonth;
          row["Tháng báo cáo"] = normalizeMonth(rawMonth) || normalizeMonth(currentMonth);
          if (!row["Nghiệp vụ"]) row["Nghiệp vụ"] = rNghiepVu || "Hold";
          delete row._sourceMonth;
          delete row._sourceOperation;
          row.id = row.id || generateUUID();
          row._uploadTimestamp = row._uploadTimestamp || uploadTime;
        });

        const holdKeyFn = (r: any) => {
          if (!r) return "";
          const exactScopedKey = getHoldScopedIdentity(r, currentMonth);
          if (exactScopedKey) return exactScopedKey;

          // Keep malformed legacy rows isolated instead of collapsing them by
          // the old broad ID + amount comparison.
          const reportMonth = normalizeMonth(
            r["Tháng báo cáo"] || r["_fileMonth"] || currentMonth,
          );
          return `LEGACY|${reportMonth}|${String(
            r._recordId || r.id || generateUUID(),
          )}`;
        };

        // Group and map existing data by ID/Key and Timestamp
        const recordsMap = new Map<string, any>();
        const mergeSameScopedRecord = (existing: any, incoming: any) => {
          const reconciledPair = mergeDuplicateHoldRows(
            [existing, incoming],
            { scopeByReportMonth: true },
          );

          // HOLD-origin rows collapse to one transaction and preserve a
          // resolved CANCEL/ADD even when a newer workbook repeats the HOLD.
          if (reconciledPair.length === 1) return reconciledPair[0];

          const existingTime = new Date(existing._uploadTimestamp || 0).getTime();
          const incomingTime = new Date(incoming._uploadTimestamp || 0).getTime();
          return incomingTime >= existingTime ? incoming : existing;
        };

        existingHoldData.forEach((row) => {
          const key = holdKeyFn(row);
          row.id = row.id || generateUUID();
          row._recordId = row._recordId || key;
          if (!row._uploadTimestamp) {
            row._uploadTimestamp = new Date(0).toISOString(); // Backfill old records
          }
          
          const existing = recordsMap.get(key);
          if (!existing) {
            recordsMap.set(key, row);
          } else {
            recordsMap.set(key, mergeSameScopedRecord(existing, row));
          }
        });

        // Merge incoming verified hold data
        verifiedHoldData.forEach((row) => {
          const key = holdKeyFn(row);
          row._recordId = row._recordId || key;
          
          const existing = recordsMap.get(key);
          if (!existing) {
            recordsMap.set(key, row);
          } else {
            recordsMap.set(key, mergeSameScopedRecord(existing, row));
          }
        });

        const mergedHoldData = reconcileHoldTransactionRows(
          Array.from(recordsMap.values()),
        );

        // Re-calculate row numbers
        mergedHoldData.forEach((row, idx) => {
          row["No."] = idx + 1;
          row["No"] = idx + 1;
        });

        // Merge Sheet1_AE with existing data to keep multiple months
        const existingSheet1 = prev.Sheet1_AE?.data || [];
        const sheet1Map = new Map<string, any>();

        const getSheet1Key = (r: any) => {
          if (!r) return "";
          const id = String(r["ID Number"] || "").trim().toUpperCase();
          const fname = String(r["Full name"] || "").trim().toUpperCase();
          const l07 = String(r["L07"] || "").trim().toUpperCase();
          const m = normalizeMonth(r["Tháng báo cáo"] || r["_fileMonth"] || currentMonth);
          const tp = Math.round(parseMoneyToNumber(r["TOTAL PAYMENT"] || 0));
          return `${id}|${fname}|${l07}|${m}|${tp}`;
        };

        existingSheet1.forEach((row) => {
          if (!row) return;
          const k = getSheet1Key(row);
          if (k) sheet1Map.set(k, row);
        });

        verifiedSheet1Data.forEach((row) => {
          if (!row) return;
          const k = getSheet1Key(row);
          if (k) sheet1Map.set(k, row);
        });

        const mergedSheet1Data = Array.from(sheet1Map.values());
        mergedSheet1Data.forEach((row, idx) => {
          row["No."] = idx + 1;
          row["No"] = idx + 1;
        });

        return {
          ...prev,
          Ae_Global_Inputs: prev.Ae_Global_Inputs.map((row) => ({
            ...row,
            status: statusById.get(row.id) || row.status,
          })),
          Master_Roster: [
            ...(prev.Master_Roster || []).filter(r => !targets.some(t => t.name === r._sourceFile)),
            ...rosterDataToAppend
          ],
          Bank_North_AE: {
            headers: [
              "No",
              "L07",
              "Business",
              "ID Number",
              "Full name",
              "Bank Account Number",
              "TOTAL PAYMENT",
              "LOẠI CK",
              "Payment details",
            ],
            data: finalBankData,
          },
          Sheet1_AE: { headers: sheet1Headers, data: mergedSheet1Data },
          SoSanh_AE: {
            headers: [
              "ID Number",
              "Full name",
              "Sheet 1 AE",
              "Bank North AE",
              "Chênh Lệch",
              "Ghi chú",
            ],
            data: finalSoSanhAeData,
          },
          Hold_AE: {
            headers: [
              "No.",
              "TÊN FILE",
              "Tháng báo cáo",
              "BU",
              "L07",
              "ID Number",
              "Full name",
              "Bank Account Number",
              "TAX CODE",
              "Contract No",
              "TOTAL PAYMENT",
              "Mã ae",
              "Sheet Source",
              "Note",
              "Nghiệp vụ",
            ],
            data: mergedHoldData,
          },
        };
      }, false);

      // Đồng bộ dữ liệu Pivot Master
      try {
        const retainedRosterRows = (appData.Master_Roster || []).filter(
          (row: any) =>
            !targets.some((target) => target.name === row?._sourceFile),
        );
        const rosterRowsForPivot = [
          ...retainedRosterRows,
          ...rosterDataToAppend,
        ];
        const basePivotResult = buildPivotFromAppData(
          verifiedSheet1Data,
          [],
          [],
          appData.globalMonth || "03.2026",
        );
        const rosterPivotResult = buildPivotFromAppData(
          [],
          [],
          rosterRowsForPivot,
          appData.globalMonth || "03.2026",
        );

        let cachedPivotGroupedData = {};
        let cachedPivotTypeColumns: string[] = [];
        try {
          const rawPivotCache = localStorage.getItem(
            "pivot_master_processed_data",
          );
          if (rawPivotCache) {
            const parsedPivotCache = JSON.parse(rawPivotCache);
            if (parsedPivotCache.cacheVersion === PIVOT_CACHE_VERSION) {
              cachedPivotGroupedData = parsedPivotCache.groupedData || {};
              cachedPivotTypeColumns = Array.isArray(
                parsedPivotCache.typeColumns,
              )
                ? parsedPivotCache.typeColumns
                : [];
            }
          }
        } catch {
          // Nếu cache tổng bị lỗi, cache TYPE riêng vẫn tiếp tục được sử dụng.
        }

        let mktTypeCache = readPivotMktTypeCache(
          cachedPivotGroupedData,
          cachedPivotTypeColumns,
        );
        if (rosterRowsForPivot.length > 0) {
          mktTypeCache = updatePivotMktTypeCache(
            mktTypeCache,
            rosterPivotResult.groupedData || {},
            rosterPivotResult.typeColumns || [],
            getPivotDataMonths(rosterPivotResult.groupedData || {}),
          );
          writePivotMktTypeCache(mktTypeCache);
        }

        const pivotGroupedData = applyPivotMktTypeCache(
          basePivotResult.groupedData || {},
          mktTypeCache,
        );
        const pivotTypeColumns = Array.from(
          new Set([
            ...(basePivotResult.typeColumns || []),
            ...mktTypeCache.typeColumns,
          ]),
        );
        const pivotResult = {
          groupedData: pivotGroupedData,
          typeColumns: pivotTypeColumns,
          logs: [],
          sourceInfo: `Đồng bộ từ ${verifiedSheet1Data.length} dòng Gross Pay và ${rosterRowsForPivot.length} dòng Roster; giữ TYPE MKT đã lưu khi thiếu file`,
        };

        if (pivotResult && pivotResult.groupedData) {
          localStorage.setItem("pivot_master_processed_data", JSON.stringify({
            cacheVersion: PIVOT_CACHE_VERSION,
            groupedData: pivotResult.groupedData,
            typeColumns: pivotResult.typeColumns,
            diagnosticLogs: pivotResult.logs || [],
            sourceInfo: pivotResult.sourceInfo,
            reportingMonth: appData.globalMonth || "03.2026",
            updatedAt: Date.now()
          }));
          window.dispatchEvent(new CustomEvent("pivot-data-updated", {
            detail: {
              groupedData: pivotResult.groupedData,
              typeColumns: pivotResult.typeColumns,
              diagnosticLogs: pivotResult.logs || [],
              sourceInfo: pivotResult.sourceInfo
            }
          }));
        }
      } catch (pivotErr) {
        console.error("Error creating pivot master data:", pivotErr);
      }

      toast.success(
        `Xử lý xong: ${verifiedSheet1Data.length} Sheet1, ${finalBankData.length} Bank, ${verifiedHoldData.length} Hold.`,
      );
      localStorage.setItem("master_ae_active_tab", "Sheet1_AE");
      window.dispatchEvent(
        new CustomEvent("master-ae-request-tab-change", {
          detail: { tab: "Sheet1_AE" },
        }),
      );
      window.dispatchEvent(new Event("master-ae-request-refresh"));
      if (onSwitchToFinal) {
        onSwitchToFinal();
      } else {
        navigate("/master-ae");
      }
    } catch (error: any) {
      console.error("Error processing AE data:", error);
      toast.error("Lỗi xử lý file: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-master-config flex-1 flex flex-col min-h-0 bg-transparent m-0 gap-0 w-full h-full overflow-hidden"
      style={{ padding: "0px" }}
    >
      {/* One shared frame for title, data area and pagination. */}
      <div className="unified-table-frame bg-card text-card-foreground flex-1 flex flex-col min-h-0 w-full max-w-full relative overflow-hidden rounded-xl border border-border shadow-sm">

        {/* Integrated Header & Controls */}
        <div 
          className="master-config-header unified-table-frame-header relative z-10 flex w-full min-w-0 shrink-0 flex-col items-stretch justify-between gap-2 px-4 md:flex-row md:items-center border-b border-border bg-card/90 backdrop-blur-xs"
        >
          <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (onSwitchToFinal) onSwitchToFinal();
                else navigate("/master-ae");
              }}
              className="master-config-icon flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
              title="Quay lại Gross Pay"
              aria-label="Quay lại bảng Gross Pay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="master-config-icon flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <FileSpreadsheet className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-extrabold leading-5 tracking-tight text-foreground">
                Cài đặt &amp; Tải file (Master)
              </h1>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{appData.Ae_Global_Inputs.length || 0}</strong>
                  file cấu hình
                </span>
                <span aria-hidden="true" className="text-border">•</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{appData.Sheet1_AE.data.length || 0}</strong>
                  bản ghi Gross Pay
                </span>
                <span aria-hidden="true" className="text-border">•</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <strong className="font-bold text-foreground">{appData.Master_Roster?.length || 0}</strong>
                  bản ghi MKT
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-2">
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className="relative group"
                >
                  <input
                    id="search-input"
                    name="search-input"
                    type="text"
                    placeholder="TÌM KIẾM..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-56 rounded-full border border-border bg-card pl-9 pr-3 text-[11px] font-medium text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                    autoFocus
                  />
                  <Search className="w-4 h-4 text-primary/30 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              {/* Hidden multi-file upload input */}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleMultiUpload}
              />

              <button
                onClick={() => processAEData()}
                disabled={isProcessing}
                className="master-header-action flex items-center gap-1.5 rounded-full bg-primary px-4 text-[11px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Layers className="w-4 h-4 shrink-0" />
                )}
                <span>Xử lý</span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="master-header-action group relative z-10 flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
                    aria-label="Mở cài đặt Master"
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 group-hover:rotate-45" />
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-2xl border border-border/50 bg-card p-2 text-card-foreground shadow-2xl z-[999999]"
                >
                  <DropdownMenuLabel className="px-3 py-2 text-[0.625rem] font-bold uppercase tracking-widest text-muted-foreground">
                    Cài đặt &amp; tiện ích
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-primary/10 mx-1.5" />

                  <DropdownMenuItem
                    onClick={addRow}
                    className="cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 p-3 rounded-xl transition-all hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm dòng mới</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setShowSearch(!showSearch)}
                    className={`cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 p-3 rounded-xl transition-all ${showSearch ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-primary/5"}`}
                  >
                    <Search className="w-4 h-4" />
                    <span>{showSearch ? "Ẩn tìm kiếm" : "Hiện tìm kiếm"}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 hover:bg-primary/5 text-primary p-3 rounded-xl transition-all"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload nhiều File</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-primary/10 mx-1.5" />

                  <DropdownMenuItem
                    onClick={() => setFolderLinkDialogOpen(true)}
                    className="cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 hover:bg-blue-50 text-blue-600 p-3 rounded-xl transition-all"
                  >
                    <Folder className="w-4 h-4" />
                    <span>Upload thư mục Google Drive</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-primary/10 mx-1.5" />

                  <DropdownMenuItem
                    onClick={exportConfigListToExcel}
                    className="cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 hover:bg-teal-50 text-teal-600 p-3 rounded-xl transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất danh sách cấu hình Excel</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-primary/10 mx-1.5" />

                  <DropdownMenuItem
                    onClick={() => setShowClearDialog(true)}
                    className="cursor-pointer font-bold uppercase text-[0.6875rem] gap-3 hover:bg-rose-50 text-rose-500 p-3 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xóa dữ liệu trang Master</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="relative z-10 flex shrink-0 flex-col gap-1.5 border-b border-border bg-primary/[0.025] px-3 py-2 text-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-bold uppercase text-[0.625rem] tracking-widest">
                  {processingMessage}
                </span>
              </div>
              <span className="text-xs font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div
          ref={(element) => {
            element?.style.setProperty("padding", "0px", "important");
          }}
          className="data-table-wrapper master-config-data-table flex-1 min-h-0 flex flex-col w-full max-w-full p-0 font-[family-name:var(--font-table,var(--font-main))] overflow-hidden"
          style={{ padding: "0px" }}
        >
          <div className="table-body-region master-config-table-region relative flex-1 min-h-0 w-full max-w-full overflow-auto custom-scrollbar bg-card shadow-none">
            <table className="master-config-table relative z-10 min-w-max w-full border-separate border-spacing-0 table-auto text-left" style={{ borderWidth: "0px" }}>
              <thead>
                <tr className="bg-muted/20">
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] text-center border-b border-r border-border whitespace-nowrap min-w-[60px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    No
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b border-r border-border whitespace-nowrap text-center min-w-[280px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    TÊN FILE
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b border-r border-border whitespace-nowrap text-center min-w-[180px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    REGION / BANK
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b border-r border-border whitespace-nowrap text-center min-w-[120px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    THÁNG
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b border-r border-border whitespace-nowrap text-center min-w-[320px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    NGUỒN FILE
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b border-r border-border whitespace-nowrap text-center min-w-[150px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    TRẠNG THÁI
                  </th>
                  <th
                    style={{ padding: "12px 16px" }}
                    className="sticky top-0 z-20 text-[0.7rem] font-bold text-muted-foreground uppercase tracking-[0.15em] text-center border-b border-border whitespace-nowrap min-w-[70px] bg-muted/30 backdrop-blur-xs shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                  >
                    XÓA
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card text-card-foreground">
                {paginatedData.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="group transition-colors hover:bg-muted/20"
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="text-center border-b border-r border-border min-w-[50px]"
                      >
                        <span className="text-[0.875rem] font-medium text-foreground/40">
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="border-b border-r border-border min-w-[220px]"
                      >
                        <input
                          id={`name-${row.id}`}
                          name={`name-${row.id}`}
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updateRow(row.id, "name", e.target.value)
                          }
                          placeholder="Tên file..."
                          className="w-full bg-transparent border-none focus:ring-0 text-[0.875rem] font-semibold text-foreground placeholder:text-foreground/20 p-0 uppercase tracking-tight"
                        />
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="border-b border-r border-border min-w-[170px]"
                      >
                        <select
                          id={`bank-${row.id}`}
                          name={`bank-${row.id}`}
                          value={row.bank || ""}
                          onChange={(e) =>
                            updateRow(row.id, "bank", e.target.value)
                          }
                          className="w-full bg-transparent border-none focus:ring-0 text-[0.875rem] font-bold text-foreground/70 p-0 uppercase cursor-pointer appearance-none tracking-wider pr-4"
                        >
                          <option value="" className="text-foreground/40">
                            Chọn Region...
                          </option>
                          <option value="NORTH">NORTH</option>
                          <option value="THANH HOA">THANH HOA</option>
                          <option value="PHU THO">PHU THO</option>
                          <option value="THAI NGUYEN">THAI NGUYEN</option>
                          <option value="MKT LOCAL NORTH">MKT LOCAL NORTH</option>
                        </select>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="border-b border-r border-border text-center min-w-[110px]"
                      >
                        <select
                          id={`month-${row.id}`}
                          name={`month-${row.id}`}
                          value={row.month || parseMonthFromFileName(row.name) || appData.globalMonth || "03.2026"}
                          onChange={(e) =>
                            updateRow(row.id, "month", e.target.value)
                          }
                          className="w-full bg-transparent border-none focus:ring-0 text-[0.875rem] font-bold text-foreground/70 p-0 uppercase cursor-pointer appearance-none tracking-wider text-center"
                        >
                          {[
                            "01.2026", "02.2026", "03.2026", "04.2026", "05.2026", "06.2026",
                            "07.2026", "08.2026", "09.2026", "10.2026", "11.2026", "12.2026"
                          ].map((m) => (
                            <option key={m} value={m} className="text-foreground font-normal">{m}</option>
                          ))}
                        </select>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="border-b border-r border-border min-w-[280px]"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id={`file-${row.id}`}
                            name={`file-${row.id}`}
                            className="hidden"
                            accept=".xlsx,.xls"
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              handleFileUpload(row.id, e.target.files[0])
                            }
                          />
                          <button
                            onClick={() =>
                              document.getElementById(`file-${row.id}`)?.click()
                            }
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-bold text-[0.6875rem] tracking-wider uppercase transition-all flex-1 justify-center ${row.fileObj ? "bg-emerald-500 text-primary-foreground border-emerald-500 shadow-sm" : "bg-card text-card-foreground text-primary border-primary/20 hover:bg-primary/5"}`}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">{row.fileObj ? "ĐÃ CHỌN" : "CHỌN FILE"}</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveLinkRowId(row.id);
                              setLinkInput("");
                              setLinkDialogOpen(true);
                            }}
                            className="p-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-500 hover:bg-blue-100 transition-colors shrink-0"
                            title="Dán link Google Sheet"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>

                          {row.fileObj && (
                            <button
                              onClick={() =>
                                setMappingDialog({
                                  isOpen: true,
                                  rowId: row.id,
                                })
                              }
                              className="p-1.5 border border-primary/10 rounded-full bg-card text-card-foreground text-primary hover:bg-primary/5 transition-all shadow-sm shrink-0"
                              title="Cấu hình Mapping Cột"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                          {row.fileObj && (
                            <span
                              className="text-[0.625rem] font-bold text-foreground/50 truncate max-w-[100px] uppercase tracking-wider"
                            >
                              {row.fileObj.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          fontFamily: "var(--font-table, var(--font-main))",
                        }}
                        className="border-b border-r border-border min-w-[140px]"
                      >
                        <div className="flex items-center justify-center">
                          {row.status === "Success" ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border border-emerald-200">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Thành công</span>
                            </div>
                          ) : row.status === "ready" ? (
                            <div className="flex items-center gap-1.5 text-foreground/50 bg-foreground/5 px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border border-border">
                              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 shrink-0" />
                              <span className="whitespace-nowrap">Sẵn sàng</span>
                            </div>
                          ) : row.status.includes("Error") ? (
                            <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border border-rose-200">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">Lỗi</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border border-amber-200">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                              <span className="whitespace-nowrap">Xử lý...</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center border-b border-border min-w-[60px]">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-full transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {paginatedData.length === 0 && (
              <div
                className="master-config-empty-state absolute inset-x-0 bottom-0 top-[40px] z-0 flex min-h-[220px] items-center justify-center border-t border-border bg-[var(--table-data-bg,var(--card,#fff))] px-6 py-8 text-center text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <div className="flex max-w-md flex-col items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5">
                    <FileSpreadsheet className="h-9 w-9 text-primary/25" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-display text-base font-bold uppercase tracking-tight text-primary/55">
                      {appData.Ae_Global_Inputs.length === 0
                        ? "Chưa có file From AE"
                        : "Không tìm thấy file phù hợp"}
                    </p>
                    <p className="text-[0.625rem] font-bold uppercase tracking-widest text-muted-foreground/65">
                      {appData.Ae_Global_Inputs.length === 0
                        ? "Thêm dòng hoặc upload file để bắt đầu"
                        : "Hãy thay đổi hoặc xóa nội dung tìm kiếm"}
                    </p>
                  </div>
                  {appData.Ae_Global_Inputs.length === 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={addRow}
                        className="flex h-8 items-center gap-1.5 rounded-full border border-primary/20 bg-card px-3 text-[0.625rem] font-bold uppercase tracking-wide text-primary shadow-sm transition-colors hover:bg-primary/5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm dòng
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[0.625rem] font-bold uppercase tracking-wide text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        Upload file
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        <div 
          className="master-config-footer table-footer-pagination unified-table-frame-footer flex h-[52px] min-h-[52px] max-h-[52px] shrink-0 items-center justify-between border-t border-border bg-card/90 px-4 py-2"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => processAEData()}
              disabled={isProcessing}
              className="group rounded-full p-1.5 text-primary/40 transition-all hover:bg-primary/10 hover:text-primary disabled:opacity-50"
              title="Xử lý dữ liệu các file đã tải"
              aria-label="Xử lý dữ liệu các file đã tải"
            >
              <RefreshCw className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
            </button>
            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-foreground/40">
              Hiển thị{" "}
              <span className="text-foreground">
                {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              -{" "}
              <span className="text-foreground">
                {Math.min(currentPage * itemsPerPage, filteredData.length)}
              </span>{" "}
              / <span className="text-foreground">{filteredData.length}</span> file
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/10 text-primary/60 transition-all hover:bg-primary/10 disabled:opacity-30"
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[72px] text-center text-[0.625rem] font-bold uppercase tracking-widest text-foreground/60">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/10 text-primary/60 transition-all hover:bg-primary/10 disabled:opacity-30"
              aria-label="Trang sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      </div>

      <input
        type="file"
        id="file-upload"
        name="file-upload"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept=".xlsx,.xls,.gsheet"
        onChange={handleMultiUpload}
      />

      {/* Confirmation Dialog for Multi-Upload */}
      <Dialog open={folderLinkDialogOpen} onOpenChange={setFolderLinkDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border border-primary/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-primary text-sm">Nhập link Google Drive Folder</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Input
                id="folder-link"
                placeholder="https://drive.google.com/drive/folders/..."
                value={folderLinkInput}
                onChange={(e) => setFolderLinkInput(e.target.value)}
                disabled={isFetchingFolder}
              />
              <p className="text-[0.65rem] text-muted-foreground mt-1 font-medium">
                <span className="font-bold text-red-500">Lưu ý quan trọng:</span> File <span className="text-primary font-bold">credentials.json</span> (của Google Cloud) phải được tạo/upload vào <span className="font-bold">thư mục gốc của phần mềm này</span> (ở cột cây thư mục bên trái màn hình), KHÔNG phải tạo trên Google Drive. Thư mục Drive chỉ cần được cấp quyền View cho email Service Account.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFolderLinkDialogOpen(false)}
              disabled={isFetchingFolder}
              className="font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/5 transition-all bg-card text-card-foreground border-primary/10"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleFolderLinkSubmit}
              disabled={isFetchingFolder || !folderLinkInput.trim()}
              className="bg-primary text-primary-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              {isFetchingFolder ? "Đang tải..." : "Lấy danh sách file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border border-primary/10 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-primary text-sm">Nhập link Google Sheet</DialogTitle>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <div className="grid flex-1 gap-2">
              <Input
                id="link"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                disabled={isFetchingLink}
              />
              <p className="text-[0.65rem] text-muted-foreground mt-1 uppercase tracking-wider font-bold">
                Lưu ý: Chia sẻ dưới dạng <span className="text-primary">"Bất kỳ ai có liên kết"</span>
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLinkDialogOpen(false)}
              disabled={isFetchingLink}
              className="font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/5 transition-all bg-card text-card-foreground border-primary/10"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleLinkSubmit}
              disabled={isFetchingLink || !linkInput.trim()}
              className="bg-primary text-primary-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              {isFetchingLink ? "Đang tải..." : "Tải dữ liệu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl border border-primary/10 shadow-2xl bg-card text-card-foreground rounded-2xl p-6 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-primary text-sm">
              Xác nhận tải lên danh sách file
            </DialogTitle>
            <DialogDescription className="font-bold text-foreground/40 text-[0.625rem] uppercase tracking-widest mt-2">
              Phát hiện {pendingUploads.length} file. Vui lòng chọn hành động
              cho từng file.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto custom-scrollbar my-6 border border-primary/10 rounded-xl bg-primary/5 font-[family-name:var(--font-table,var(--font-main))]">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-card text-card-foreground z-10">
                <tr className="bg-primary/10">
                  <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-widest text-primary/60 border-b border-primary/10">
                    Tên File
                  </th>
                  <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-widest text-primary/60 border-b border-primary/10">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {choices.map((choice, idx) => (
                  <tr
                    key={idx}
                    className=""
                  >
                    <td className="px-4 py-3 text-[0.6875rem] font-bold text-foreground truncate max-w-[300px] uppercase tracking-tight">
                      {choice.file.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <select
                          id={`action-${idx}`}
                          name={`action-${idx}`}
                          value={choice.action}
                          onChange={(e) => {
                            const newChoices = [...choices];
                            newChoices[idx].action = e.target.value as any;
                            setChoices(newChoices);
                          }}
                          className="bg-card text-card-foreground border border-primary/10 rounded-lg px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="new">Tạo mới</option>
                          {choice.targetId && (
                            <option value="update">Ghi đè</option>
                          )}
                          <option value="skip">Bỏ qua</option>
                        </select>
                        {choice.action === "update" && (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                        )}
                        {choice.action === "new" && (
                          <Plus className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        {choice.action === "skip" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="border-primary/10 bg-card text-card-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/5 transition-all"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={() => confirmUploads(choices)}
              className="bg-primary text-primary-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Xác nhận tải lên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-md border border-primary/10 shadow-2xl bg-card text-card-foreground rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-bold uppercase tracking-widest text-primary text-sm">
              Xóa dữ liệu trang Master
            </DialogTitle>
            <DialogDescription className="font-bold text-foreground/40 text-[0.625rem] uppercase tracking-widest mt-2">
              Thao tác này xóa toàn bộ file tải lên, dữ liệu và kết quả thuộc
              trang Master. Dữ liệu Timesheet, Audit và Balance không bị ảnh hưởng.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              className="border-primary/10 bg-card text-card-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-primary/5 transition-all"
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={clearPageData}
              className="bg-rose-500 text-primary-foreground font-bold uppercase text-[0.625rem] tracking-widest px-6 py-2.5 rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20 transition-all"
            >
              Xóa trang Master
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ColumnMappingDialog
        isOpen={mappingDialog.isOpen}
        onClose={() => setMappingDialog({ isOpen: false, rowId: null })}
        file={
          appData.Ae_Global_Inputs.find((r) => r.id === mappingDialog.rowId)
            ?.fileObj || null
        }
        targetFields={masterAeFields}
        initialMapping={
          appData.Ae_Global_Inputs.find((r) => r.id === mappingDialog.rowId)
            ?.columnMapping || {}
        }
        onSave={(mapping) => {
          if (mappingDialog.rowId) {
            updateRow(mappingDialog.rowId, "columnMapping", mapping);
            toast.success("Đã lưu cấu hình mapping cột");
          }
        }}
      />
    </motion.div>
  );
}
