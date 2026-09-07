# Monthly Transaction history / Check STK

## Provisioning (administrator)

This feature is for one shared payroll workspace per Supabase project. It does
not grant access to every signed-in user and does not support multiple tenants.

1. Review and run `supabase/migrations/202609070001_transaction_history.sql`
   on the application's Supabase project. The migration is adapted from the
   user-supplied SQL; it has not been applied to production by this change.
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
append-only SECURITY DEFINER RPC is intentionally privileged for its single
insert: it checks `auth.uid()` membership, has an empty search path, validates
the snapshot, and revokes PUBLIC execution (only authenticated can call it).
Do not relax these restrictions to resolve login or setup errors.

## Workflow

- In Transaction, use **Đăng nhập kho**, select the month and **Lưu phiên bản**.
  Every successful save creates an immutable version; retrying the same payload
  after a lost response in the current session reuses the request UUID.
  Reloading the app or signing out clears retry state and a new save is a new version.
- The full month's Transaction is saved, independent of display filters.
  Total/subtotal rows are excluded. Missing or invalid row months block saving
  and checking; valid rows from other months are excluded.
- **Check STK** opens Reconcile and compares the current, unsaved Transaction to
  every saved month strictly before the selected reporting month (including prior
  years). Each month uses its highest version ID; superseded versions and the
  current/future months are excluded. Missing intervening months do not stop the check.
- A current row matches only when all historical occurrences found for its Document
  ID agree. Any older account/name difference is flagged even if the most recent
  occurrence matches. An ID missing from one month is normal; an ID missing from
  all history is flagged. Conflicting duplicates within one snapshot remain ambiguous.
- The count remains one result per current Transaction row. Each warning and Excel
  export identifies the source month, version and historical account/name. The report
  lists all source versions and save timestamps. Metadata is read with keyset pagination;
  a failed source read fails the entire check rather than reporting a partial match.
- Matching uses trimmed, uppercased **Document ID** only, never a name/account
  fallback. Account numbers are strings (leading zeros preserved). Zeros already
  lost in an upstream numeric import cannot be reconstructed.
- A name difference is reported separately; names ignore case and repeated
  spaces. Duplicate IDs with conflicting names/accounts are flagged, not guessed.
- The report shows previous/current account and name, source version and warning.
  Missing identity/history is not MATCHED. It has 25-row pages and exports all
  warning rows to Excel. Checking never changes Transaction, Master or the
  existing financial Reconcile calculations/statuses.
- Changing month, source data or signed-in identity invalidates old results;
  delayed responses from another context are discarded.

## Verification

`npm test`, `npm run test:transaction-db`, `npm run build`.
Database tests use PGlite (PostgreSQL WASM), not production. They simulate Supabase
Auth roles and exercise the actual SQL migration, membership/RLS, append-only
storage, period validation and retry handling. Production Auth/PostgREST and
multi-client concurrent saves still require deployment-environment verification.

At implementation time, all 86 repository tests and production build passed.
Lint passed for the new modules/tests. Full TypeScript checking found the same
40 diagnostics as base commit `656447b`, with no new diagnostics (line offsets
ignored). Browser interaction and a live Supabase project have not been tested.
