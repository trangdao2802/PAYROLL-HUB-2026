import { generateUUID, getExcelFileBuffer } from "./data-utils";
import ExcelWorker from "../../workers/excelParser.worker?worker";
import type {
  ExcelParseMode,
  ExcelParseResult,
} from "../../workers/excelParser.worker";

type PendingExcelRequest = {
  resolve: (result: ExcelParseResult) => void;
  reject: (error: Error) => void;
};

let excelWorker: Worker | null = null;
const pendingExcelRequests = new Map<string, PendingExcelRequest>();

function releaseExcelWorker() {
  if (!excelWorker) return;
  excelWorker.onmessage = null;
  excelWorker.onerror = null;
  excelWorker.terminate();
  excelWorker = null;
}

function getExcelWorker() {
  if (excelWorker) return excelWorker;
  excelWorker = new ExcelWorker();
  excelWorker.onmessage = (event: MessageEvent) => {
    const requestId = String(event.data?.requestId || "");
    const pending = pendingExcelRequests.get(requestId);
    if (!pending) return;
    pendingExcelRequests.delete(requestId);
    // Parsing expands a workbook substantially. Release that worker heap
    // before the calculation worker receives the imported rows.
    if (pendingExcelRequests.size === 0) releaseExcelWorker();
    if (event.data?.success) {
      pending.resolve(event.data.result as ExcelParseResult);
    } else {
      pending.reject(
        new Error(event.data?.error || "Không thể đọc dữ liệu Excel."),
      );
    }
  };
  excelWorker.onerror = (event) => {
    const error = new Error(event.message || "Excel Worker đã dừng bất thường.");
    pendingExcelRequests.forEach(({ reject }) => reject(error));
    pendingExcelRequests.clear();
    releaseExcelWorker();
  };
  return excelWorker;
}

export const parseExcelInWorker = async (
  file: File,
  options: { fileId?: string; mode?: ExcelParseMode } = {},
): Promise<ExcelParseResult> => {
  const { buffer, name } = await getExcelFileBuffer(file);
  const requestId = generateUUID();
  const worker = getExcelWorker();

  return new Promise((resolve, reject) => {
    pendingExcelRequests.set(requestId, { resolve, reject });
    try {
      worker.postMessage(
        {
          requestId,
          fileBuffer: buffer,
          fileName: name,
          fileId: options.fileId,
          mode: options.mode || "auto",
        },
        [buffer],
      );
    } catch (error) {
      pendingExcelRequests.delete(requestId);
      if (pendingExcelRequests.size === 0) releaseExcelWorker();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};
