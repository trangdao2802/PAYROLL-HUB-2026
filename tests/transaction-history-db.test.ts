import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('monthly history enforces membership, atomic month replacement, period and retry rules', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      alter default privileges in schema public grant execute on functions to anon, authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
    `);
    await db.exec(readFileSync(new URL('../supabase/migrations/202609070001_transaction_history.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into public.transaction_history_members values ('00000000-0000-0000-0000-000000000001');
      set role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);`);
    const rows = JSON.stringify([{'Tháng báo cáo': '2026-01', 'Document ID': '001', 'Beneficiary Name': 'Employee', 'Beneficiary Account No.': '001234'}]);
    const request = '10000000-0000-0000-0000-000000000001';
    const append = (period: string, payload: string, id = request) => db.query<{id: number}>(
      'select public.append_transaction_version($1::date, $2::jsonb, $3::uuid) as id', [period, payload, id]);
    const first = await append('2026-01-01', rows);
    assert.deepEqual((await append('2026-01-01', rows)).rows, first.rows);
    await append('2026-01-01', rows, '10000000-0000-0000-0000-000000000002');
    const saved = await db.query<{rows: Record<string, string>[]}>('select rows from public.transaction_monthly_versions order by id desc');
    assert.equal(saved.rows.length, 2);
    assert.equal(saved.rows[0].rows[0]['Beneficiary Account No.'], '001234');
    await db.exec('reset role');
    await db.exec(readFileSync(new URL('../supabase/migrations/20260907110103_replace_transaction_month.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    const feb = rows.replace('2026-01', '2026-02');
    await append('2026-02-01', feb, '20000000-0000-0000-0000-000000000001');
    const updated = rows.replace('001234', '009999');
    const replacementRequest = '30000000-0000-0000-0000-000000000001';
    const replacement = await append('2026-01-01', updated, replacementRequest);
    assert.deepEqual((await append('2026-01-01', updated, replacementRequest)).rows, replacement.rows);
    const months = await db.query<{period: string; rows: Record<string, string>[]}>(
      'select period::text, rows from public.transaction_monthly_versions order by period');
    assert.equal(months.rows.length, 2);
    assert.equal(months.rows[0].rows[0]['Beneficiary Account No.'], '009999');
    assert.equal(months.rows[1].rows[0]['Beneficiary Account No.'], '001234');
    await assert.rejects(append('2026-01-01', rows), {code: 'P0002'});
    await assert.rejects(append('2026-01-01', rows, replacementRequest), {code: 'P0002'});
    await assert.rejects(db.query('select * from payroll_private.transaction_save_receipts'));
    // Force a failure after insertion: the delete and new snapshot must both roll back.
    await db.exec(`reset role;
      create function public.fail_delete() returns trigger language plpgsql as $$ begin raise exception 'forced delete failure'; end $$;
      create trigger fail_delete before delete on public.transaction_monthly_versions for each row execute function public.fail_delete();
      set role authenticated;`);
    await assert.rejects(append('2026-01-01', rows, '40000000-0000-0000-0000-000000000001'), /forced delete failure/);
    assert.deepEqual((await db.query('select period::text, rows from public.transaction_monthly_versions order by period')).rows, months.rows);
    await db.exec('reset role; drop trigger fail_delete on public.transaction_monthly_versions; set role authenticated');
    await assert.rejects(append('2026-02-01', rows));
    await assert.rejects(append('2026-01-01', '[]'));
    await assert.rejects(append('2026-01-01', '[null]'));
    await assert.rejects(append('2026-01-01', rows.replace('"001234"', '1234')));
    await assert.rejects(db.exec('delete from public.transaction_monthly_versions'));
    await assert.rejects(db.exec('update public.transaction_monthly_versions set rows = \'[]\''));
    await assert.rejects(db.exec("insert into public.transaction_history_members values ('00000000-0000-0000-0000-000000000002')"));
    await db.exec("select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false)");
    assert.equal((await db.query('select * from public.transaction_monthly_versions')).rows.length, 0);
    await assert.rejects(append('2026-01-01', rows));
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.transaction_monthly_versions'));
    await assert.rejects(append('2026-01-01', rows));
  } finally { await db.close(); }
});
