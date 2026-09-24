import { runTimesheetImport } from "../lib/utils/timesheet-import-queue";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAppData } from "../lib/contexts/AppDataContext";
import { fetchGoogleSheetAsFile } from "../lib/utils/data-utils";
import { parseExcelInWorker } from "../lib/utils/excel-worker-client";
import { applyTimesheetLinkResult, resolveTimesheetLink } from "../lib/utils/timesheet-link-sync";
import { formatTimesheetSyncDate } from "../lib/utils/timesheet-sync-date";

// Shared by Settings Actions and the missing-center refresh controls.
const pendingSources = new Set<string>();

export function useTimesheetLinkSync() {
  const { appData: { Timesheet_InputList }, updateAppData } = useAppData();
  const syncRow = useCallback(async (
    id: string,
    urlOverride?: string,
    customUploadDate?: string,
    silentSuccess = false,
  ): Promise<number | null> => {
    const input = Timesheet_InputList.find((row) => row.id === id);
    if (!input) {
      toast.error("Không tìm thấy dòng tương ứng.");
      return null;
    }
    if (pendingSources.has(id)) return null;
    pendingSources.add(id);
    return runTimesheetImport(async () => {
      if (!silentSuccess) updateAppData((previous) => ({
        ...previous,
        Timesheet_InputList: previous.Timesheet_InputList.map((row) => row.id === id ? {
          ...row, status: "processing", ...(urlOverride ? { url: urlOverride } : {}),
        } : row),
      }), false);
      try {
        const source = await resolveTimesheetLink({ ...input, url: urlOverride || input.url });
        const file = await fetchGoogleSheetAsFile(source.url, input.sheetName || "Sheet1");
        if (!file) throw new Error("Không lấy được nội dung file.");
        const parsed = await parseExcelInWorker(file, { fileId: id, mode: "roster" });
        const syncedAt = formatTimesheetSyncDate(new Date());
        updateAppData((previous) => applyTimesheetLinkResult(previous, input, parsed.rows, {
          url: source.url,
          fileName: file.name,
          date: customUploadDate || source.date || syncedAt,
          lastSyncedAt: syncedAt,
        }), false);
        if (!silentSuccess) toast.success(`Đã đồng bộ ${input.l07}: ${parsed.rows.length} dòng (Đã ghi đè dữ liệu cũ).`);
        return parsed.rows.length;
      } catch (error) {
        updateAppData((previous) => ({
          ...previous,
          Timesheet_InputList: previous.Timesheet_InputList.map((row) => row.id === id ? { ...row, status: "error" } : row),
        }), false);
        toast.error(`${input.l07}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      } finally {
        pendingSources.delete(id);
      }
    });
  }, [Timesheet_InputList, updateAppData]);
  return { syncRow };
}
