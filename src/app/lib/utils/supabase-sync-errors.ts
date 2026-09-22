export interface SupabaseSyncFailure {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export class SupabaseSchemaError extends Error {
  constructor(readonly table: string, readonly code: string, message: string) {
    super(message);
    this.name = 'SupabaseSchemaError';
  }
}

export function describeSupabaseSyncError(table: string, error: SupabaseSyncFailure): Error {
  const code = error.code || 'UNKNOWN';
  if (code === 'PGRST205' || code === '42P01') {
    return new SupabaseSchemaError(table, code,
      `Không tìm thấy bảng public.${table} qua kết nối hiện tại [${code}]. Kiểm tra đúng dự án Supabase và tải lại schema. ${error.message}`);
  }
  if (code === 'PGRST204' || code === '42703') {
    return new SupabaseSchemaError(table, code,
      `Bảng public.${table} thiếu cột hoặc schema chưa cập nhật [${code}]: ${error.message}`);
  }
  if (`${error.message} ${error.details || ''}`.includes('unique_nv_ngay')) {
    return new SupabaseSchemaError(table, code,
      `Bảng public.${table} còn ràng buộc unique_nv_ngay, không cho nhiều ca trong một ngày. Cần cập nhật cấu trúc bảng.`);
  }
  return new Error(`Không thể đồng bộ public.${table} [${code}]: ${error.message}${error.details ? ` · ${error.details}` : ''}`);
}
