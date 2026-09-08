import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePeriod, type TransactionRow } from './utils/transaction-history';

export interface TransactionVersion {
  id: string;
  period: string;
  created_at: string;
  rows: TransactionRow[];
}

export async function requireHistoryMember(client: SupabaseClient): Promise<string> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Vui lòng đăng nhập kho Transaction.');
  const membership = await client.from('transaction_history_members').select('user_id').eq('user_id', user.id).maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  if (!membership.data) throw new Error('Tài khoản chưa được cấp quyền truy cập kho payroll.');
  return user.id;
}

export async function loadLatestVersion(client: SupabaseClient, period: string): Promise<TransactionVersion | null> {
  await requireHistoryMember(client);
  const { data, error } = await client.from('transaction_monthly_versions')
    .select('id, period, created_at, rows').eq('period', `${normalizePeriod(period)}-01`)
    .order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? {...data, id: String(data.id)} as TransactionVersion : null;
}

export class HistorySaveConflictError extends Error {}

export async function replaceVersionIfCurrent(
  client: SupabaseClient,
  expected: TransactionVersion,
  rows: TransactionRow[],
  requestId: string,
): Promise<string> {
  const period = expected.period.slice(0, 7);
  const latest = await loadLatestVersion(client, period);
  if (!latest || latest.id !== expected.id) {
    throw new HistorySaveConflictError(
      `Dữ liệu tháng ${period} đã thay đổi. Hãy Check STK & ID lại trước khi đồng bộ.`,
    );
  }
  return saveVersion(client, period, rows, requestId);
}

/** Pin the latest saved snapshot for every earlier saved month. */
export async function loadAllPriorVersions(client: SupabaseClient, period: string): Promise<TransactionVersion[]> {
  await requireHistoryMember(client);
  const before = `${normalizePeriod(period)}-01`;
  const latest = new Map<string, string>();
  let cursor: string | undefined;
  while (true) {
    let query = client.from('transaction_monthly_versions').select('id, period')
      .lt('period', before).order('id', { ascending: false }).limit(200);
    if (cursor) query = query.lt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const item of data) if (!latest.has(item.period)) latest.set(item.period, String(item.id));
    const nextCursor = String(data[data.length - 1].id);
    if (nextCursor === cursor) throw new Error('Không thể tải đầy đủ lịch sử Transaction. Hãy thử lại.');
    cursor = nextCursor;
  }
  const versions: TransactionVersion[] = [];
  const ids = [...latest.values()];
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = await Promise.all(ids.slice(offset, offset + 4).map(async id => {
      const { data, error } = await client.from('transaction_monthly_versions')
        .select('id, period, created_at, rows').eq('id', id).single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`Không đọc được phiên bản nguồn #${id}.`);
      return { ...data, id: String(data.id) } as TransactionVersion;
    }));
    versions.push(...batch);
  }
  return versions.sort((a, b) => a.period.localeCompare(b.period));
}

export async function saveVersion(client: SupabaseClient, period: string, rows: TransactionRow[], requestId: string): Promise<string> {
  await requireHistoryMember(client);
  const { data, error } = await client.rpc('append_transaction_version', {
    p_period: `${normalizePeriod(period)}-01`, p_rows: rows, p_request_id: requestId,
  });
  if (error?.code === 'P0002') throw new HistorySaveConflictError(error.message);
  if (error) throw new Error(error.message);
  return String(data);
}
