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

export async function saveVersion(client: SupabaseClient, period: string, rows: TransactionRow[], requestId: string): Promise<string> {
  await requireHistoryMember(client);
  const { data, error } = await client.rpc('append_transaction_version', {
    p_period: `${normalizePeriod(period)}-01`, p_rows: rows, p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}
