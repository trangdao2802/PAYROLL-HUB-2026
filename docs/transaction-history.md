# Monthly Transaction history / Check STK & Document ID

## Provisioning (administrator)

This feature is for one shared payroll workspace per Supabase project. It does
not grant access to every signed-in user and does not support multiple tenants.

1. For a new Supabase project, review and apply the committed migrations in order:
   - `supabase/migrations/20260907034930_transaction_monthly_history.sql`
   - `supabase/migrations/20260907050303_repair_transaction_history_snapshot_validation.sql`
   - `supabase/migrations/20260907110442_replace_transaction_month.sql`

   These versions are already applied to the application's production project.
   For an existing project, compare migration history before applying changes.
2. Provision named Supabase Auth email/password accounts. Add approved user UUIDs:

   ```sql
   insert into public.transaction_history_members(user_id)
   values ('UUID-OF-APPROVED-AUTH-USER') on conflict do nothing;
   ```

3. Use the existing app Supabase URL and publishable/anon key settings. Never
   put a service-role/secret key into the browser. Confirm the existing client
   points to the project where the migration was applied.
4. Run Supabase security advisors after applying the migration. Test access with
   an approved member, non-member and signed-out client before uploading payroll.

RLS restricts shared history to the membership table. Clients can select, but
cannot insert directly, update/delete versions, or grant membership. The supplied
private SECURITY DEFINER RPC is intentionally privileged for atomic month
replacement: it checks `auth.uid()` membership, has an empty search path, validates
the snapshot, and revokes PUBLIC execution (only authenticated can call it).
Do not relax these restrictions to resolve login or setup errors.

## Workflow

- In Transaction, use **Đăng nhập kho**, select the month and **Lưu tháng**. The final
  migration above enables month replacement. Each successful save replaces all saved versions of
  that month with the current full snapshot. Other months stay unchanged. Validation
  or write failure rolls back the entire save. Existing history is not removed by
  the migration itself. A retry of the current request returns its saved ID; a
  superseded request is rejected. Private hash receipts prevent stale retries from
  restoring deleted payroll data. After a conflict, review the data before saving again.
- The full month's Transaction is saved, independent of display filters.
  Total/subtotal rows are excluded. Missing or invalid row months block saving
  and checking; valid rows from other months are excluded.
- **Check STK & ID** opens Reconcile and loads the latest saved current month from
  Supabase after **Lưu sửa → Lưu tháng**. It compares that snapshot to
  every saved month strictly before the selected reporting month (including prior
  years). Each month uses its highest version ID; superseded versions and the
  current/future months are excluded. Missing intervening months do not stop the check.
- A current row matches only when all historical occurrences found for its Document
  ID agree. Saved `ID Number` values from older builds are read as the same field and
  normalized to Transaction's canonical `Document ID`. Any older ID/account/name
  difference is flagged even if the most recent occurrence matches. An ID missing
  from one month is normal; an identity missing from all history is flagged.
  Conflicting duplicates within one snapshot remain ambiguous.
- The count remains one result per current Transaction row. Each warning and Excel
  export identifies the source month, version and historical account/name. The report
  lists all source versions and save timestamps. Metadata is read with keyset pagination;
  a failed source read fails the entire check rather than reporting a partial match.
- Matching first uses trimmed, uppercased **Document ID**. When an ID changed or is
  missing, an exact normalized name + exact account pair is used only to expose the
  historical ID difference; that fallback is always reported as a warning and never
  silently treated as matched. Account numbers are strings (leading zeros preserved).
  Zeros already lost in an upstream numeric import cannot be reconstructed.
- A name difference is reported separately; comparisons ignore case, Vietnamese
  diacritics and repeated spaces. Duplicate IDs with conflicting names/accounts are flagged, not guessed.
- The report shows historical/current Document ID, account and name, source version
  and warning.
  Missing identity/history is not MATCHED. It has 25-row pages and exports all
  warning rows to Excel. Checking never changes Transaction, Master or the
  existing financial Reconcile calculations/statuses.
- Changing month, source data or signed-in identity invalidates old results;
  delayed responses from another context are discarded.

Latest-cloud reads, bank checks and the official VCB source review are documented
in [Bank account checks](bank-account-check.md). The report is an internal data
comparison and does not certify bank ownership, KYC or active account status.

## Verification

`npm test`, `npm run test:transaction-db`, `npm run build`.
Database tests use PGlite (PostgreSQL WASM), not production. They simulate Supabase
Auth roles and exercise the actual SQL migration, membership/RLS, atomic month replacement
storage, period validation and retry handling. Production Auth/PostgREST and
multi-client concurrent saves still require deployment-environment verification.

At implementation time, all 86 repository tests and production build passed.
Lint passed for the new modules/tests. Full TypeScript checking found the same
40 diagnostics as base commit `656447b`, with no new diagnostics (line offsets
ignored). Browser interaction and a live Supabase project have not been tested.

## Month replacement verification (2026-09-07)

The replacement migration was applied to production. A synthetic save/replace/stale-retry
check ran inside a rolled-back transaction; the seven existing saved months were unchanged.
Database tests also force a delete failure to verify full rollback. Build and focused lint passed.
The private receipts table intentionally has no client policies (RPC owner only).
Existing project-wide advisor warnings remain outside this change; see
[Supabase database advisors](https://supabase.com/docs/guides/database/database-advisors).

## Migration history synchronization (2026-09-08)

The GitHub Supabase check failed with `Remote migration versions not found in local
migrations directory.` The repository had two different version IDs and omitted the
snapshot validation repair. All three migration files now contain the original SQL
recorded in production's `supabase_migrations.schema_migrations`, with matching
version IDs. This restores Git history alignment without replaying migrations or
rewriting production migration records. Database tests apply all three migrations
in order and cover validation before and after month replacement.
