import { RefreshCw } from 'lucide-react';
import { useTableRestore } from '../hooks/useTableRestore';
import type { OriginalField } from '../lib/utils/table-originals';

export function TableRestoreButton({ fields, onRestore }: { fields?: readonly OriginalField[]; onRestore?: () => void }) {
  const restore = useTableRestore();
  return <button type="button" onClick={onRestore || (() => restore(fields || []))}
    title={onRestore ? "Tính lại bảng từ dữ liệu nguồn, bỏ chỉnh sửa riêng của bảng." : "Khôi phục toàn bộ dữ liệu của bảng trước chỉnh sửa (tất cả tháng), gồm dòng đã thêm hoặc xóa. Có thể Hoàn tác."}
    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs text-primary hover:bg-muted active:scale-[0.98]">
    <RefreshCw className="h-3.5 w-3.5" />Làm mới dữ liệu
  </button>;
}
