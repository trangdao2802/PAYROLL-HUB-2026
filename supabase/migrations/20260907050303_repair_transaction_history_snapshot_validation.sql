create or replace function payroll_private.append_transaction_version(p_period date, p_rows jsonb, p_request_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare version_id bigint; item jsonb; declared_period text;
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
  select id into version_id from public.transaction_monthly_versions
    where request_id = p_request_id and created_by = auth.uid() and period = p_period and rows = p_rows;
  if version_id is not null then return version_id; end if;
  insert into public.transaction_monthly_versions(period, request_id, rows, created_by)
    values (p_period, p_request_id, p_rows, auth.uid()) returning id into version_id;
  return version_id;
end;
$$;
revoke all on function payroll_private.append_transaction_version(date,jsonb,uuid) from public, anon;
grant execute on function payroll_private.append_transaction_version(date,jsonb,uuid) to authenticated;