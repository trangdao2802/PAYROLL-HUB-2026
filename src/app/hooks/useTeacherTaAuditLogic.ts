/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect, useRef } from "react";
import AuditWorker from "../workers/audit.worker?worker&inline";
import { runAuditComputation } from "../workers/audit.worker";
import * as XLSX from "xlsx";
import { useAppData } from "../lib/contexts/AppDataContext";
import { CENTER_MAPPING, getCenterInfoByAECode, getCenterInfoByL07, mapL07 } from "../lib/utils/center-utils";
import { getVal, getExcelFileBuffer } from "../lib/utils/data-utils";
import { sanitizeAllowedTaRules } from "../lib/utils/allowed-ta-rules";

// ==========================================
// 1. CONSTANTS & MAPPING PRE-CALCULATION
// ==========================================

// ==========================================
// 3. HOOK
// ==========================================

export function useTeacherTaAuditLogic(rosterData: any[], fromDate: string, toDate: string) {
  const { appData, updateAppData } = useAppData();
  const fileAData = useMemo(() => appData.Q_TeacherHours || [], [appData.Q_TeacherHours]);
  const fileNameA = appData.Q_TeacherHoursFileName || "";
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fuzzyThreshold, setFuzzyThreshold] = useState(75);
  // Cache key: trÃ¡nh re-run worker khi inputs khÃ´ng Ä‘á»•i vá» ná»™i dung
  const lastParamsCacheRef = useRef<string>("");
  const workerRef = useRef<Worker | null>(null);

  // NGUỒN 1: File Timesheet của Giáo Viên
  const handleUploadFileA = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg("");
    try {
      const { buffer, name: fileName } = await getExcelFileBuffer(file);
      const isCsv = fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".gsheet") || fileName.toLowerCase().endsWith(".txt");
      let workbook;
      if (isCsv) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(buffer);
        workbook = XLSX.read(text, { type: "string", raw: true });
      } else {
        workbook = XLSX.read(buffer, { type: "array", raw: true });
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const bonusSheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("SUMMER INSTRUCTORS BONUS"));
      const bonusDataRaw = bonusSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[bonusSheetName], { header: 1, defval: "", raw: false }) : null;

      const rawData = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: "",
        raw: false
      }) as any[][];
      
      updateAppData((prev) => ({
        ...prev,
        Q_TeacherHours: rawData,
        Q_TeacherHoursFileName: fileName,
        Q_BonusData: bonusDataRaw || undefined,
        Q_BonusSheetName: bonusSheetName || "Bonus",
      }));
    } catch (error) {
      console.error("Lỗi upload file A:", error);
      setErrorMsg("Lỗi đọc File A. Vui lòng kiểm tra định dạng file!");
    } finally {
      setIsProcessing(false);
    }
  };

  // NGUỒN 2: File Danh Sách TA (Roster / Source 2)
  const handleUploadFileB = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg("");
    try {
      const { buffer, name: fileName } = await getExcelFileBuffer(file);
      const isCsv = fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".gsheet") || fileName.toLowerCase().endsWith(".txt");
      let workbook;
      if (isCsv) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(buffer);
        workbook = XLSX.read(text, { type: "string", raw: true });
      } else {
        workbook = XLSX.read(buffer, { type: "array", raw: true });
      }
      
      const rosterSheetName = workbook.SheetNames.find(name => {
        const upper = name.toUpperCase().trim();
        return upper === "ROSTER" || upper === "Q_ROSTER";
      }) || workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[rosterSheetName];
      
      const rawData = XLSX.utils.sheet_to_json(firstSheet, {
        defval: "",
        raw: false
      });

      const mappedRosters = rawData.map((row: any) => {
        const rawCenter = String(getVal(row, [
          "l07", "trung tâm (l07)", "cơ sở (l07)", "mã l07", "ma l07", "center code", "office code", "center", "cơ sở", "trung tâm", "trung tam", "chi nhánh", "mã trung tâm", "ma trung tam", "location", "site", "branch", "region", "vùng", "miền", "khu vực", "campus", "office", "area", "ma co so", "trung tam", "co so", "mã ae", "ma ae", "ae", "ae code", "ae_code", "ae name", "ae_name", "ae-code"
        ]) || "").trim();
        const info = getCenterInfoByAECode(rawCenter) || getCenterInfoByL07(rawCenter) || getCenterInfoByL07(mapL07(rawCenter));
        const l07 = info?.l07 || rawCenter || "UNKNOWN";
        const business = info?.bus || "";
        const ma_nv = String(getVal(row, ["id number", "id", "teacher id", "emp id", "mã nv", "manv", "staff code", "emp code", "mã nhân sự"]) || "").trim();
        const full_name = String(getVal(row, ["full name", "name", "teacher name", "tên", "họ và tên", "họ tên"]) || "").trim();
        const ngayRaw = getVal(row, ["date", "ngay", "ngày", "tk_date", "session date", "sessiondate", "ngày học", "scheduledate", "ngày làm việc", "ngày tháng"]);
        const ngay = ngayRaw !== undefined && ngayRaw !== null ? String(ngayRaw).trim() : "";
        const type = String(getVal(row, ["type", "code", "task code", "activity code", "task type", "task", "loại", "loại hoạt động", "event type"]) || "").trim();
        const className = String(getVal(row, ["class", "class code", "lớp", "class name", "mã lớp", "tên lớp", "classcode"]) || "").trim();
        const gio_vao = String(getVal(row, ["from", "start", "start time", "từ"]) || "").trim();
        const gio_ra = String(getVal(row, ["to", "end", "end time", "đến"]) || "").trim();
        
        const rawDuration = getVal(row, ["duration", "quy ra số giờ làm", "total", "actual hours", "working hours", "giờ làm", "số giờ", "hours", "tk_duration", "total hours", "tổng giờ", "time"]);
        let duration = 0;
        if (typeof rawDuration === "number") {
          duration = rawDuration;
        } else if (rawDuration) {
          const sv = String(rawDuration).trim().replace(",", ".");
          if (sv.includes(":")) {
            const p = sv.split(":");
            duration = (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60;
          } else {
            duration = parseFloat(sv) || 0;
          }
        }
        
        const notes = String(getVal(row, ["notes", "note", "ghi chú", "ghi chu", "remarks"]) || "").trim();

        return {
          center: rawCenter,
          l07,
          business,
          ma_nv,
          full_name,
          ngay,
          type,
          class: className,
          gio_vao,
          gio_ra,
          duration,
          notes,
          
          employeeId: ma_nv,
          fullName: full_name,
          maAE: rawCenter,
          date: ngay,
          taskType: type,
          classCode: className,
          from: gio_vao,
          to: gio_ra,
          _sourceFile: fileName
        };
      });
      
      updateAppData((prev) => ({
        ...prev,
        Timesheet_Roster: mappedRosters,
        Timesheet_RosterFileName: fileName
      } as any));
    } catch (error) {
      console.error("Lỗi upload file B:", error);
      setErrorMsg("Lỗi đọc File B. Vui lòng kiểm tra định dạng file!");
    } finally {
      setIsProcessing(false);
    }
  };

  // NGUỒN 3: File Audit Config (Student Counts / Source 3)
  const handleUploadFileConfig = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg("");
    try {
      const { buffer, name: fileName } = await getExcelFileBuffer(file);
      const isCsv = fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".gsheet") || fileName.toLowerCase().endsWith(".txt");
      let workbook;
      if (isCsv) {
        const decoder = new TextDecoder("utf-8");
        const text = decoder.decode(buffer);
        workbook = XLSX.read(text, { type: "string", raw: true });
      } else {
        workbook = XLSX.read(buffer, { type: "array", raw: true });
      }
      
      // Look for a sheet with relevant names
      const targetSheetName = workbook.SheetNames.find(s => 
        s.toLowerCase().includes("check tas") || 
        s.toLowerCase().includes("danh sách lớp") || 
        s.toLowerCase().includes("schedule") ||
        s.toLowerCase().includes("so sánh")
      ) || workbook.SheetNames[0];
      
      const sheet = workbook.Sheets[targetSheetName];
      
      // Auto-detect header row
      const configRaw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false
      });
      
      updateAppData((prev) => ({
        ...prev,
        Q_CheckTAs: configRaw,
        Q_CheckTAsFileName: fileName
      } as any));
    } catch (error) {
      console.error("Lỗi upload file Config:", error);
      setErrorMsg("Lỗi đọc File Config. Vui lòng kiểm tra định dạng file!");
    } finally {
      setIsProcessing(false);
    }
  };

  const [auditResults, setAuditResults] = useState<any>({
    results: [], 
    summary: { sumTeacher: 0, sumActualTA: 0, sumExpected: 0 }, 
    missingCenters: [], 
    error: null,
    isCalculating: false
  });

  // Extract checkTAsData - stabilize reference
  const checkTAsDataRaw = useMemo(() => appData.Q_CheckTAs || [], [appData.Q_CheckTAs]);
  const allowedTaRules = useMemo(
    () => sanitizeAllowedTaRules(appData.Q_AllowedTARules),
    [appData.Q_AllowedTARules],
  );
  const allowedTaRulesKey = useMemo(() => JSON.stringify(allowedTaRules), [allowedTaRules]);
  const centerMappingParam = useMemo(() => CENTER_MAPPING || {}, []);

  useEffect(() => {
    if (fileAData.length === 0) {
      setTimeout(() => {
        setAuditResults({ results: [], summary: { sumTeacher: 0, sumActualTA: 0, sumExpected: 0 }, missingCenters: [], error: null, isCalculating: false });
      }, 0);
      return;
    }
    if (!rosterData || rosterData.length === 0) {
      setTimeout(() => {
        setAuditResults({ results: [], summary: { sumTeacher: 0, sumActualTA: 0, sumExpected: 0 }, missingCenters: [], error: "NO_ROSTER_B", isCalculating: false });
      }, 0);
      return;
    }

    // Cache check: khÃ´ng gá»­i worker náº¿u params giá»‘ng há»‡t láº§n trÆ°á»›c
    const cacheKey = `audit-in-class-v2|${fileNameA}|${fromDate}|${toDate}|${rosterData.length}|${fileAData.length}|${checkTAsDataRaw.length}|${allowedTaRulesKey}`;
    if (cacheKey === lastParamsCacheRef.current) return;
    lastParamsCacheRef.current = cacheKey;

    // Terminate previous worker náº¿u cÃ²n Ä‘ang cháº¡y
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setAuditResults((prev: any) => ({ ...prev, isCalculating: true }));

    const bonusData = appData.Q_BonusData || null;
    const bonusSheetNameActual = appData.Q_TeacherHoursFileName?.includes("Bonus") ? "Summer Instructors Bonus" : (appData.Q_BonusSheetName || "Bonus");

    const params = {
      fileAData,
      rosterData,
      fromDate,
      toDate,
      checkTAsDataRaw,
      fileNameA,
      centerMappingParam,
      bonusData,
      bonusSheetName: bonusSheetNameActual,
      allowedTaRules,
    };

    const runMainThreadFallback = () => {
      console.warn("Audit Worker failed or is unavailable. Executing calculation on main thread as a fallback.");
      try {
        const resultData = runAuditComputation(params);
        setAuditResults(resultData || {
          results: [], 
          summary: { sumTeacher: 0, sumActualTA: 0, sumExpected: 0 }, 
          missingCenters: [], 
          error: "Fallback returned undefined data",
          isCalculating: false
        });
      } catch (err: any) {
        console.error("Main thread audit fallback also failed:", err);
        setAuditResults((prev: any) => ({
          ...prev,
          isCalculating: false,
          error: err.message || String(err),
        }));
      }
    };

    try {
      const worker = new AuditWorker();
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        setAuditResults(e.data || {
          results: [], 
          summary: { sumTeacher: 0, sumActualTA: 0, sumExpected: 0 }, 
          missingCenters: [], 
          error: "Worker returned undefined data",
          isCalculating: false
        });
        workerRef.current = null;
      };
      worker.onerror = (err) => {
        console.error("Audit worker error, falling back to main thread:", err);
        runMainThreadFallback();
        workerRef.current = null;
      };

      worker.postMessage(params);
    } catch (workerError) {
      console.error("Failed to instantiate AuditWorker, falling back to main thread:", workerError);
      runMainThreadFallback();
    }

    return () => {
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    };
  }, [fileAData, rosterData, fromDate, toDate, checkTAsDataRaw, fileNameA, fuzzyThreshold, centerMappingParam, appData.Q_BonusData, appData.Q_TeacherHoursFileName, appData.Q_BonusSheetName, allowedTaRules, allowedTaRulesKey]);

  const fileNameB = appData.Timesheet_RosterFileName || "";
  const fileNameConfig = appData.Q_CheckTAsFileName || "";

  const clearData = () => {
    updateAppData((prev) => ({
      ...prev,
      Q_TeacherHours: [],
      Q_TeacherHoursFileName: "",
      Timesheet_Roster: [],
      Timesheet_RosterFileName: "",
      Q_CheckTAs: [],
      Q_CheckTAsFileName: "",
    }));
  };

  return {
    state: { fileAData, fileNameA, fileNameB, fileNameConfig, isProcessing, errorMsg, fuzzyThreshold },
    computed: { auditResults },
    actions: { handleUploadFileA, handleUploadFileB, handleUploadFileConfig, setErrorMsg, clearData, setFuzzyThreshold },
  };
}
