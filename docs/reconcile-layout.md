# Check STK & ID: compact results and explicit choices

The history report uses five stable columns: Thông tin chung, Lịch sử,
Hiện tại (month), Cần kiểm tra, Xử lý. Shared ID/name/account values appear
once in the first column. Only differences appear in the two comparison
columns. Repeated historical values are grouped with their source months.
There are no links from cells back to Transaction. Rules and snapshot details
are collapsed above the table; full warnings remain in each row's details
and in the check report export. Transaction bank exports still blank Document ID.

| ID | Name | Account | Action |
|---|---|---|---|
| Same | Same | Same | Hidden unless another data-quality warning exists |
| Different/missing | Same | Same | Choose ID |
| Same | Different/missing | Same | Choose name |
| Same | Same | Different/missing | Choose account |
| Different | Different | Same | Verify identity; no sync |
| Different | Same | Different | Verify identity; no sync |
| Same | Different | Different | Verify identity; no sync |
| Different | Different | Different | Cannot link from these fields alone |

All choices require the two other fields to be complete and equal, the same
known bank, and no overlapping identities or contradictory values within a
month. Exact duplicate payment rows are retained. Matching a name alone or
an account alone exposes a candidate for review, never a synchronization
source. No matching fields cannot establish that two records are one person.

Name comparison ignores case, Vietnamese diacritics and repeated whitespace;
this does not alter the stored spelling. IDs and accounts preserve leading
zeroes. Empty, malformed and scientific-notation values cannot be donors.
Numeric accounts, account aliases and hidden characters need correction or
verification first. A valid account can repair an invalid target when ID and
name match. An account associated with another employee is excluded as a donor.
Missing values on either side may be filled; two missing anchors or no valid
donor offer no action. Multiple valid donor months remain explicit user choices.

The dialog starts without a selected source. Selecting a source previews the
old/new value and exact rows in every affected month. The user may uncheck
months whose changes are legitimate, or keep everything unchanged. Only the
chosen field and its existing aliases are changed; report month, amounts and
unrelated rows remain unchanged. No majority or latest-month choice is automatic.

`replace_transaction_versions` holds the ordinary save locks for every
checked month and rechecks all source/target version IDs before saving. All
selected months commit together; any error rolls back the complete operation.
The UI reads back each saved snapshot before updating local rows. The employee
directory is then synchronized from the resulting current Transaction month.
Directory errors are reported separately from the successful month save.

Financial amount reconciliation and payroll calculations are unchanged.

Validation: all eight complete-field combinations; missing fields on either
side; overlapping IDs; malformed or shared accounts; selected past months;
leading zeroes and unchanged payroll fields; source/target concurrency; batch
rollback; no-access roles; five-column rendering without source links.
