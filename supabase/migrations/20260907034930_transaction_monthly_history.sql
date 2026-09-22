-- Shared payroll workspace. Provision named Supabase Auth users, then add their
-- UUIDs to transaction_history_members as an administrator. Never grant anon access.
begin;
create schema if not exists payroll_private;
revoke all on schema payroll_private from public, anon;
grant usage on schema payroll_private to authenticated;
create table public.transaction_history_members (
  user_id uuid primary key references auth.users(id)
);
alter table public.transaction_history_members enable row level security;
revoke all on public.transaction_history_members from anon, authenticated;
grant select on public.transaction_history_members to authenticated;
create policy read_own_membership on public.transaction_history_members
  for select to authenticated using (user_id = (select auth.uid()));

create table public.transaction_monthly_versions (
  id bigint generated always as identity primary key,
  period date not null check (extract(day from period) = 1),
  request_id uuid not null unique,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  rows jsonb not null check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) > 0)
);
create index transaction_monthly_latest on public.transaction_monthly_versions(period, id desc);
alter table public.transaction_monthly_versions enable row level security;
revoke all on public.transaction_monthly_versions from anon, authenticated;
grant select on public.transaction_monthly_versions to authenticated;
create policy read_transaction_history on public.transaction_monthly_versions
  for select to authenticated using (exists (
    select 1 from public.transaction_history_members where user_id = (select auth.uid())
  ));

-- One insert commits the entire snapshot. Old versions cannot be updated/deleted
-- by the app. A retry with the same request UUID returns the original version.
create function payroll_private.append_transaction_version(p_period date, p_rows jsonb, p_request_id uuid)
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
revoke all on function payroll_private.append_transaction_version(date, jsonb, uuid) from public, anon;
grant execute on function payroll_private.append_transaction_version(date, jsonb, uuid) to authenticated;
create function public.append_transaction_version(p_period date, p_rows jsonb, p_request_id uuid)
returns bigint language sql security invoker set search_path = '' as $$
  select payroll_private.append_transaction_version(p_period, p_rows, p_request_id);
$$;
revoke all on function public.append_transaction_version(date, jsonb, uuid) from public, anon;
grant execute on function public.append_transaction_version(date, jsonb, uuid) to authenticated;
commit;
