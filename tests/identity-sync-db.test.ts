import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');

test('identity sync atomically rechecks donors, writes chosen months, rejects stale data and rolls back every month on failure', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001');`);
    for (const name of ['20260907034930_transaction_monthly_history', '20260907050303_repair_transaction_history_snapshot_validation', '20260907110442_replace_transaction_month', '20260909190000_atomic_identity_sync']) await db.exec(migration(name));
    await db.exec(`insert into public.transaction_history_members values ('00000000-0000-0000-0000-000000000001');
      set role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);`);
    let serial = 0;
    const request = () => `10000000-0000-0000-0000-${String(++serial).padStart(12, '0')}`;
    const rows = (period: string, account: string) => [{
      'Document ID': '001', 'Beneficiary Name': 'TEST PERSON', 'Beneficiary Account No.': account, 'Tháng báo cáo': period, Amount: 500,
    }];
    const append = (period: string, account: string) => db.query('select public.append_transaction_version($1::date,$2::jsonb,$3::uuid)', [period + '-01', JSON.stringify(rows(period, account)), request()]);
    for (const [period, account] of [['2026-01','001111'], ['2026-02','002222'], ['2026-03','003333']]) await append(period, account);
    const snapshot = async () => (await db.query<{period: string; id: string; rows: unknown}>('select period::text, id::text, rows from public.transaction_monthly_versions order by period')).rows;
    const before = await snapshot();
    const expected = before.map(({period, id}) => ({period, id}));
    const changes = (account: string) => ['2026-01','2026-02'].map(period => ({period: period + '-01', rows: rows(period, account), request_id: request()}));
    const sync = (checks: unknown, edits: unknown) => db.query<{saved: {period: string; id: string}[]}>(
      'select public.replace_transaction_versions($1::jsonb,$2::jsonb) as saved', [JSON.stringify(checks), JSON.stringify(edits)]);
    const invalid = changes('009999'); invalid[1].rows[0]['Tháng báo cáo'] = '2026-09';
    await assert.rejects(sync(expected, invalid), /period mismatch/);
    assert.deepEqual(await snapshot(), before, 'first month must roll back when second month fails');
    await assert.rejects(sync(expected, [{period:'2026-04-01',rows:rows('2026-04','009999'),request_id:request()}]), /not checked/);
    assert.deepEqual(await snapshot(), before);
    const result = await sync(expected, changes('003333'));
    assert.deepEqual(result.rows[0].saved.map(item => item.period), ['2026-01-01','2026-02-01']);
    const after = await snapshot();
    assert.deepEqual(after[2], before[2], 'donor remains untouched');
    for (const item of after.slice(0,2)) assert.deepEqual(item.rows, rows(item.period.slice(0,7), '003333'));
    await assert.rejects(sync(expected, changes('001111')), {code: 'P0002'});
    assert.deepEqual(await snapshot(), after);
    const donorChecks = after.map(({period,id}) => ({period,id}));
    await append('2026-03', '004444');
    const changedDonor = await snapshot();
    await assert.rejects(sync(donorChecks, changes('003333')), {code:'P0002'});
    assert.deepEqual(await snapshot(), changedDonor);
    await db.exec("select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false)");
    await assert.rejects(sync(donorChecks, changes('003333')), {code:'42501'});
    await db.exec('reset role; set role anon');
    await assert.rejects(sync(donorChecks, changes('003333')), {code:'42501'});
  } finally { await db.close(); }
});
