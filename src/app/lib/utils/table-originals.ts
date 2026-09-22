import type { AppData } from '../../types';

export const ORIGINAL_FIELDS = ['Sheet1_AE', 'Bank_North_AE', 'Hold_AE', 'BankExport',
  'Timesheet_Roster', 'Master_Roster', 'Q_Staff', 'Q_Salary_Scale', 'Q_Cache',
  'Q_TeacherHours', 'Q_CheckTAs', 'Q_AllowedTARules', 'SavedBal_PayrollTrial',
  'Timesheet_InputList', 'Ae_Global_Inputs'] as const;
export type OriginalField = typeof ORIGINAL_FIELDS[number];
export type TableOriginals = Partial<Pick<AppData, OriginalField>>;

/** Explicit imports replace the baseline; edits retain the first pre-edit value. */
export function trackTableOriginals(previous: AppData, next: AppData, isEdit: boolean,
  sourceFields: readonly OriginalField[] = []): AppData {
  if (previous === next || next.TableOriginals !== previous.TableOriginals) return next;
  const originals = { ...next.TableOriginals };
  let changed = false;
  for (const key of ORIGINAL_FIELDS) {
    if (previous[key] === next[key]) continue;
    if (sourceFields.includes(key)) {
      Object.assign(originals, { [key]: structuredClone(next[key]) });
      changed = true;
    } else if (isEdit && !Object.prototype.hasOwnProperty.call(originals, key)) {
      Object.assign(originals, { [key]: structuredClone(previous[key]) });
      changed = true;
    }
  }
  return changed ? { ...next, TableOriginals: originals } : next;
}

export function restoreTableOriginals(data: AppData, fields: readonly OriginalField[]): AppData {
  if (!fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(data.TableOriginals || {}, key))) {
    throw new Error('Chưa có bản gốc của bảng này. Hãy tải và xử lý lại file nguồn để tạo bản khôi phục.');
  }
  const restored = { ...data };
  for (const key of fields) Object.assign(restored, { [key]: structuredClone(data.TableOriginals![key]) });
  return restored;
}

export function grossPayRowVisible(row: Record<string, unknown>): boolean {
  return row._isNew === true || String(row['ID Number'] || row.id_number || '').trim() !== '';
}

export function sourceRowIndex(rows: Record<string, unknown>[], row: Record<string, unknown> | undefined): number {
  if (!row) return -1;
  if (row.id) return rows.findIndex(item => item.id === row.id);
  if (typeof row._originalIndex === 'number') return row._originalIndex;
  return rows.indexOf(row);
}
