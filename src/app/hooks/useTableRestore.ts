import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAppData } from '../lib/contexts/AppDataContext';
import { restoreTableOriginals, type OriginalField } from '../lib/utils/table-originals';

export function useTableRestore() {
  const { appData, updateAppData } = useAppData();
  return useCallback((fields: readonly OriginalField[]) => {
    try {
      restoreTableOriginals(appData, fields);
      updateAppData(prev => restoreTableOriginals(prev, fields), true, true);
      toast.success('Đã khôi phục dữ liệu trước chỉnh sửa của bảng.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể khôi phục dữ liệu.');
    }
  }, [appData, updateAppData]);
}
