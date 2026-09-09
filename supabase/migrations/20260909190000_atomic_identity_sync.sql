-- A source-month choice must commit all selected months together and reject
-- a stale donor/target while holding the same period locks as ordinary saves.
begin;
create or replace function payroll_private.replace_transaction_versions(p_expected jsonb, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare expected record; change jsonb; latest_id bigint; saved_id bigint; result jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.transaction_history_members where user_id = auth.uid()) then
    raise exception 'Transaction access denied' using errcode = '42501';
  end if;
  if p_expected is null or jsonb_typeof(p_expected) <> 'array'
    or p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Invalid synchronization plan';
  end if;
  if jsonb_array_length(p_expected) = 0 or jsonb_array_length(p_changes) = 0 then
    raise exception 'Empty synchronization plan';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_expected) as e(period date, id bigint)
      where period is null or extract(day from period) <> 1 or id is null or id <= 0)
    or (select count(distinct e->>'period') from jsonb_array_elements(p_expected) e) <> jsonb_array_length(p_expected)
    or (select count(distinct e->>'period') from jsonb_array_elements(p_changes) e) <> jsonb_array_length(p_changes) then
    raise exception 'Invalid synchronization periods';
  end if;
  for expected in select * from jsonb_to_recordset(p_expected) as e(period date, id bigint) order by period loop
    perform pg_advisory_xact_lock(hashtext('transaction:' || expected.period::text));
    select id into latest_id from public.transaction_monthly_versions
      where period = expected.period order by id desc limit 1;
    if latest_id is distinct from expected.id then
      raise exception 'Dữ liệu tháng % đã thay đổi. Hãy Check STK & ID lại.', to_char(expected.period, 'MM/YYYY') using errcode = 'P0002';
    end if;
  end loop;
  if exists (
    select 1 from public.transaction_monthly_versions v
    where v.period <= (select max(e.period) from jsonb_to_recordset(p_expected) as e(period date))
      and not exists (select 1 from jsonb_to_recordset(p_expected) as e(period date) where e.period = v.period)
  ) then
    raise exception 'Có tháng nguồn mới. Hãy Check STK & ID lại.' using errcode = 'P0002';
  end if;
  for change in select value from jsonb_array_elements(p_changes) order by value->>'period' loop
    if not exists (select 1 from jsonb_to_recordset(p_expected) as e(period date)
        where e.period = (change->>'period')::date) then
      raise exception 'Target month was not checked';
    end if;
    saved_id := payroll_private.append_transaction_version(
      (change->>'period')::date, change->'rows', (change->>'request_id')::uuid);
    result := result || jsonb_build_array(jsonb_build_object('period', change->>'period', 'id', saved_id::text));
  end loop;
  return result;
end;
$$;
revoke all on function payroll_private.replace_transaction_versions(jsonb, jsonb) from public, anon, authenticated;
grant execute on function payroll_private.replace_transaction_versions(jsonb, jsonb) to authenticated;
create or replace function public.replace_transaction_versions(p_expected jsonb, p_changes jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select payroll_private.replace_transaction_versions(p_expected, p_changes);
$$;
revoke all on function public.replace_transaction_versions(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_transaction_versions(jsonb, jsonb) to authenticated;
commit;
