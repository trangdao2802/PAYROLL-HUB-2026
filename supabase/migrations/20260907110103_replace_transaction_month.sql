-- Replace only the saved month. Existing months are untouched until explicitly saved again.
begin;
create schema if not exists payroll_private;
grant usage on schema payroll_private to authenticated;
create table if not exists payroll_private.transaction_save_receipts (
  request_id uuid primary key,
  period date not null,
  created_by uuid not null,
  version_id bigint not null,
  payload_hash bytea not null
);
alter table payroll_private.transaction_save_receipts enable row level security;
revoke all on payroll_private.transaction_save_receipts from public, anon, authenticated;
create or replace function payroll_private.append_transaction_version(p_period date, p_rows jsonb, p_request_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare version_id bigint; current_id bigint; item jsonb; declared_period text; receipt record; payload_digest bytea;
begin
  if not exists (select 1 from public.transaction_history_members where user_id = auth.uid()) then
    raise exception 'Transaction access denied' using errcode = '42501';
  end if;
  if p_period is null or extract(day from p_period) <> 1 or p_request_id is null
    or p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Invalid transaction snapshot';
  end if;
  if jsonb_array_length(p_rows) = 0 then raise exception 'Empty snapshot'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) <> 'object' or item = 'null'::jsonb then
      raise exception 'Invalid transaction row';
    end if;
    if jsonb_typeof(item->'Beneficiary Account No.') is distinct from 'string'
      or jsonb_typeof(item->'Document ID') is distinct from 'string'
      or jsonb_typeof(item->'Beneficiary Name') is distinct from 'string' then
      raise exception 'Transaction identity fields must be strings';
    end if;
    declared_period := coalesce(nullif(trim(item->>'Tháng báo cáo'), ''), nullif(trim(item->>'_fileMonth'), ''));
    declared_period := regexp_replace(declared_period, '^Tháng\s*', '', 'i');
    if declared_period is null or not (
      declared_period = to_char(p_period, 'YYYY-MM') or
      declared_period = to_char(p_period, 'MM.YYYY') or
      declared_period = to_char(p_period, 'FMMM.YYYY') or
      declared_period = to_char(p_period, 'MM/YYYY') or
      declared_period = to_char(p_period, 'FMMM/YYYY')
    ) then raise exception 'Transaction row period mismatch'; end if;
  end loop;
  -- Serialize saves for a period so latest id also follows completed save order.
  perform pg_advisory_xact_lock(hashtext('transaction:' || p_period::text));
  payload_digest := sha256(convert_to(p_rows::text, 'UTF8'));
  -- Keep request receipts without retaining the old payroll rows.
  insert into payroll_private.transaction_save_receipts(request_id, period, created_by, version_id, payload_hash)
    select request_id, period, created_by, id, sha256(convert_to(rows::text, 'UTF8'))
    from public.transaction_monthly_versions where period = p_period
    on conflict (request_id) do nothing;
  select id into current_id from public.transaction_monthly_versions
    where period = p_period order by id desc limit 1;
  select * into receipt from payroll_private.transaction_save_receipts where request_id = p_request_id;
  if found then
    if receipt.period <> p_period or receipt.created_by <> auth.uid() or receipt.payload_hash <> payload_digest then
      raise exception 'Yêu cầu lưu không khớp dữ liệu ban đầu. Hãy kiểm tra và lưu lại.' using errcode = 'P0002';
    end if;
    if receipt.version_id is distinct from current_id then
      raise exception 'Tháng đã có dữ liệu mới hơn. Yêu cầu lưu cũ không được ghi đè. Hãy kiểm tra và lưu lại.' using errcode = 'P0002';
    end if;
    return receipt.version_id;
  end if;
  insert into public.transaction_monthly_versions(period, request_id, rows, created_by)
    values (p_period, p_request_id, p_rows, auth.uid()) returning id into version_id;
  insert into payroll_private.transaction_save_receipts(request_id, period, created_by, version_id, payload_hash)
    values (p_request_id, p_period, auth.uid(), version_id, payload_digest);
  -- In the same transaction: insert must succeed before old data is removed.
  delete from public.transaction_monthly_versions where period = p_period and id <> version_id;
  return version_id;
end;
$$;
revoke all on function payroll_private.append_transaction_version(date, jsonb, uuid) from public, anon, authenticated;
grant execute on function payroll_private.append_transaction_version(date, jsonb, uuid) to authenticated;
create or replace function public.append_transaction_version(p_period date, p_rows jsonb, p_request_id uuid)
returns bigint language sql security invoker set search_path = '' as $$
  select payroll_private.append_transaction_version(p_period, p_rows, p_request_id);
$$;
revoke all on function public.append_transaction_version(date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.append_transaction_version(date, jsonb, uuid) to authenticated;
commit;
