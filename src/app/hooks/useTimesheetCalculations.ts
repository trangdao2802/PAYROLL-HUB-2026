/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, useEffect, useRef } from "react";
import { generateUUID, parseAnyDate } from "../lib/utils/data-utils";
import { mapL07 } from "../lib/utils/center-utils";
import { TASK_COLUMNS } from "../constants/timesheet-logic";
import { useAppData } from "../lib/contexts/AppDataContext";
import { useUiSettings } from "../lib/ui-settings";
import TimesheetWorker from "../workers/timesheet.worker?worker";

// Global cache to prevent re-calculations during tab switching
let globalWorkerCacheKey = "";
let globalWorkerCacheResult: any = {
  processedRosterData: [],
  employeeSummary: [],
  centerSummary: [],
  isCalculating: false,
};

const referenceIds = new WeakMap<object, number>();
let nextReferenceId = 1;

function getReferenceId(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const objectValue = value as object;
  const existing = referenceIds.get(objectValue);
  if (existing) return existing;
  const id = nextReferenceId++;
  referenceIds.set(objectValue, id);
  return id;
}

export function useTimesheetCalculations(
  rosterData: any[],
  salaryScaleData: any[],
  staffData: any[],
  cacheData: any[],
  fromDateStr: string,
  toDateStr: string,
) {
  const { appData } = useAppData();
  const uiSettings = useUiSettings();

  const [result, setResult] = useState<any>({
    processedRosterData: [],
    employeeSummary: [],
    centerSummary: [],
    isCalculating: true,
  });

  const workerRef = useRef<Worker | null>(null);

  const fromDateVal = fromDateStr;
  let tempFDate: Date | null = null;
  if (fromDateVal) {
    const parts = fromDateVal.split("-");
    if (parts.length === 3) {
      tempFDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0);
    }
  }
  const preferredYear = uiSettings.defaultAuditYear || (tempFDate ? tempFDate.getFullYear() : new Date().getFullYear());

  const checkTAsData = appData?.Q_CheckTAs;
  const timesheetInputMetadataKey = (appData?.Timesheet_InputList || [])
    .map(
      (row: any) =>
        `${row.id || ""}|${row.l07 || ""}|${row.aeCode || ""}|${row.bus || ""}|${(row.legacyRowIds || []).join(",")}`,
    )
    .join("||");
  const timesheetInputMetadata = useMemo(
    () =>
      (appData?.Timesheet_InputList || []).map((row: any) => ({
        id: row.id,
        l07: row.l07,
        aeCode: row.aeCode,
        bus: row.bus,
        legacyRowIds: row.legacyRowIds || [],
      })),
    [appData?.Timesheet_InputList],
  );

  const { classSizeMap, checkTAsMap } = useMemo(() => {
    // Class-size inputs are Timesheet-owned. Payroll Master data must never
    // participate in a Timesheet calculation.
    const csMap: Record<string, number> = {};
    const ctaMap: Record<string, number> = {};

    const safeCheckTAsData = checkTAsData || [];
    safeCheckTAsData.forEach((row: any) => {
      const clsName = String(row["Class Name"] || row["Lớp"] || row["Class"] || row["Mã lớp"] || "").trim();
      const centerRaw = String(row["Center Name"] || row["Mã AE"] || row["Center"] || row["Center Code"] || row["L07"] || row["Trung tâm"] || "");
      const sessionDate = row["Session Date"] || row["Ngày"] || row["Date"] || row["Ngày học"] || row["Session"] || row["SessionDate"];
      const numStudents = parseInt(String(row["Number of Student"] || row["Number of Students"] || row["No of Student"] || row["Sĩ số"] || row["Sỹ số"] || row["Students"] || row["Số HV"] || row["Số học viên"] || row["Sĩ số lớp"] || row["Total Students"] || row["Số lượng học viên"] || row["Sĩ số thực tế"] || row["Sỹ số thực tế"] || row["Actual Size"] || row["Class Size"] || row["Size"] || row["Số lượng"] || row["Sĩ số cơ sở"] || ""), 10) || 0;

      const parsedDate = parseAnyDate(sessionDate, preferredYear);
      const normCls = clsName.replace(/\s+/g, "").toUpperCase();
      const centerL07 = mapL07(centerRaw);
      const normCenter = centerL07.replace(/\s+/g, "").toUpperCase();

      if (numStudents > 0 && normCls) {
        const classKey = `${normCenter}_${normCls}`;
        if (!csMap[classKey] || csMap[classKey] < numStudents) csMap[classKey] = numStudents;
      }
      if (parsedDate && clsName) {
        const dateStr = `${String(parsedDate.getDate()).padStart(2, "0")}/${String(parsedDate.getMonth() + 1).padStart(2, "0")}/${parsedDate.getFullYear()}`;
        const key = `${normCenter}_${normCls}_${dateStr}`;
        ctaMap[key] = numStudents;
      }
    });
    return { classSizeMap: csMap, checkTAsMap: ctaMap };
  }, [checkTAsData, preferredYear]);

  useEffect(() => {
    let inputSendTimer: ReturnType<typeof setTimeout> | undefined;

    if (rosterData.length === 0) {
      // Clear cache when roster is empty
      globalWorkerCacheKey = "";
      globalWorkerCacheResult = {
        processedRosterData: [],
        employeeSummary: [],
        centerSummary: [],
        isCalculating: false,
      };
      
      Promise.resolve().then(() => {
        setResult((prev: any) => {
          if (prev.processedRosterData.length === 0 && !prev.isCalculating) return prev;
          return {
            processedRosterData: [],
            employeeSummary: [],
            centerSummary: [],
            isCalculating: false,
          };
        });
      });
      return;
    }

    const currentArgsSignature = JSON.stringify({
      rosterLen: rosterData.length,
      salaryLen: salaryScaleData.length,
      staffLen: staffData.length,
      cacheLen: cacheData.length,
      from: fromDateStr,
      to: toDateStr,
      year: preferredYear,
      rosterRef: getReferenceId(rosterData),
      salaryRef: getReferenceId(salaryScaleData),
      staffRef: getReferenceId(staffData),
      cacheRef: getReferenceId(cacheData),
      checkTAsRef: getReferenceId(checkTAsData),
      inputs: timesheetInputMetadataKey,
    });

    if (currentArgsSignature === globalWorkerCacheKey && globalWorkerCacheResult.processedRosterData.length > 0) {
      // Return cached result instantly and avoid running the worker
      Promise.resolve().then(() => {
        setResult(globalWorkerCacheResult);
      });
      return;
    }

    Promise.resolve().then(() => {
      setResult((prev: any) => ({ ...prev, isCalculating: true }));
    });

    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    const params = {
      rosterData,
      salaryScaleData,
      staffData,
      cacheData,
      fromDateStr,
      toDateStr,
      appData: {
        Timesheet_InputList: timesheetInputMetadata,
        Timesheet_RosterFileName: appData?.Timesheet_RosterFileName,
      },
      preferredYear,
      checkTAsMap,
      classSizeMap,
      TASK_COLUMNS
    };

    try {
      const worker = new TimesheetWorker();
      workerRef.current = worker;
      const requestId = generateUUID();
      const chunkedResult: Record<string, any[]> = {
        processedRosterData: [],
        employeeSummary: [],
        centerSummary: [],
      };
      let chunkedError: string | undefined;

      const commitWorkerResult = (resultData: any) => {
        const finalResult = {
          processedRosterData: resultData.processedRosterData || [],
          employeeSummary: resultData.employeeSummary || [],
          centerSummary: resultData.centerSummary || [],
          isCalculating: false,
          error: resultData.error,
        };
        globalWorkerCacheKey = currentArgsSignature;
        globalWorkerCacheResult = finalResult;
        setResult(finalResult);
      };

      worker.onmessage = (e) => {
        const resultData = e.data || {};
        if (resultData.requestId && resultData.requestId !== requestId) return;

        if (resultData.type === "timesheet-result-start") {
          chunkedError = resultData.error;
          return;
        }

        if (resultData.type === "timesheet-result-chunk") {
          const target = chunkedResult[resultData.field];
          if (target && Array.isArray(resultData.rows)) {
            target.push(...resultData.rows);
          }
          return;
        }

        if (resultData.type === "timesheet-result-complete") {
          commitWorkerResult({ ...chunkedResult, error: chunkedError });
          return;
        }

        // Backwards-compatible fallback for an older cached worker bundle.
        if (resultData.error) {
          console.error("Timesheet worker error string:", resultData.error);
        }
        commitWorkerResult(resultData);
      };
      worker.onerror = (err: ErrorEvent | any) => {
        const errorDetails = err?.message || (err?.error?.message ? err.error.message : "Web Worker runtime error");
        console.warn("Timesheet worker warning:", errorDetails);
        setResult((prev: any) => ({
          ...prev,
          isCalculating: false,
          error:
            errorDetails ||
            "Không thể tính Timesheet trong Worker. Vui lòng tải lại trang và thử lại.",
        }));
      };
      const inputFields = [
        "rosterData",
        "salaryScaleData",
        "staffData",
        "cacheData",
      ] as const;
      const workerParams = {
        ...params,
        rosterData: undefined,
        salaryScaleData: undefined,
        staffData: undefined,
        cacheData: undefined,
      };
      // Reduce the number of structured-clone turns for large source files.
      // 10k rows keeps each message bounded but avoids hundreds of timer hops.
      const inputChunkSize = 10_000;
      let fieldIndex = 0;
      let rowOffset = 0;

      worker.postMessage({
        type: "timesheet-input-start",
        requestId,
        params: workerParams,
      });

      const sendNextInputChunk = () => {
        if (workerRef.current !== worker) return;
        if (fieldIndex >= inputFields.length) {
          worker.postMessage({ type: "timesheet-input-complete", requestId });
          return;
        }

        const field = inputFields[fieldIndex];
        const rows = params[field] || [];
        if (rowOffset >= rows.length) {
          fieldIndex += 1;
          rowOffset = 0;
          inputSendTimer = setTimeout(sendNextInputChunk, 0);
          return;
        }

        worker.postMessage({
          type: "timesheet-input-chunk",
          requestId,
          field,
          rows: rows.slice(rowOffset, rowOffset + inputChunkSize),
        });
        rowOffset += inputChunkSize;
        inputSendTimer = setTimeout(sendNextInputChunk, 0);
      };
      inputSendTimer = setTimeout(sendNextInputChunk, 0);
    } catch (workerError) {
      console.error("Failed to instantiate TimesheetWorker:", workerError);
      setResult((prev: any) => ({
        ...prev,
        isCalculating: false,
        error:
          workerError instanceof Error
            ? workerError.message
            : "Không thể khởi tạo Timesheet Worker.",
      }));
    }

    return () => {
      if (inputSendTimer) clearTimeout(inputSendTimer);
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [
    rosterData,
    salaryScaleData,
    staffData,
    cacheData,
    fromDateStr,
    toDateStr,
    classSizeMap,
    checkTAsMap,
    checkTAsData,
    appData?.Timesheet_RosterFileName,
    timesheetInputMetadata,
    timesheetInputMetadataKey,
    preferredYear,
  ]);

  return result;
}
