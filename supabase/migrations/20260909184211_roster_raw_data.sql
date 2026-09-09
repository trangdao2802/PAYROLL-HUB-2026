-- Sync & Save preserves pivot allocations and edit metadata in raw_data.
-- Add the missing payload column without replacing roster rows or policies.
begin;
alter table public.roster_cham_cong add column if not exists raw_data jsonb;
notify pgrst, 'reload schema';
commit;
