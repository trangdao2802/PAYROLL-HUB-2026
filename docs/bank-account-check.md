# Bank account checks / Vietcombank

Researched against official Vietcombank sources on 2026-09-08. These are payroll
data checks, not a bank account ownership or account-status verification service.

## Official conditions and their scope

| Source | Finding | Application in Payroll Hub |
| --- | --- | --- |
| [VCB payment accounts](https://www.vietcombank.com.vn/vi-VN/KHCN/SPDV/Dich-vu-tai-khoan/Tai-khoan-thanh-toan) | Online opening is available to eligible Vietnamese residents aged 15 or older; identity documents and face verification are required. Counter services also cover eligible foreign individuals. | Do not treat an internal employee Document ID as a CCCD, or reject a foreign name/passport. Age, nationality and eligibility cannot be inferred from STK. |
| [Online account terms, linked by VCB](https://www.vietcombank.com.vn/-/media/Project/VCB-Sites/VCB/KHCN/Bieu-mau-Bieu-phi-KHCN/Bieu-mau/Dich-vu-tai-khoan/Tai-khoan-thanh-toan/16122025-DKDK-mo-va-su--dung-TKTT-truc-tuyen.pdf) | The holder is the person in whose name the account was opened. Valid identity documents and biometric matching are required for the online service. Closed account numbers may be registered to another customer. | Compare the supplied beneficiary name and account history; a changed name requires evidence, not automatic reassignment or an accusation of fraud. The app cannot certify KYC or whether a number is active. |
| [Counter account terms, linked by VCB](https://www.vietcombank.com.vn/-/media/Project/VCB-Sites/VCB/KHCN/Bieu-mau-Bieu-phi-KHCN/Bieu-mau/Dich-vu-tai-khoan/Tai-khoan-thanh-toan/20240927_DKDK-mo-va-su-dung-TK-thanh-toan-KHCN.pdf) | The terms cover joint accounts and accounts used through legal representatives, including customers under 15. | Do not apply online-opening age restrictions to every account holder. A shared account with different names is a review finding; joint ownership requires supporting bank documents. |
| [VCB nickname transfers](https://www.vietcombank.com.vn/vi-VN/KHCN/Truy-cap-nhanh/Tin-noi-bat/Articles/chuyen-tien-lien-ngan-hang-toi-nickname-tai-khoan-vietcombank-that-de-dang) | Registered nicknames can replace numeric account numbers on supported transfer channels. | Letters are not conclusive evidence of an invalid VCB account. Require confirmation of the nickname and payroll-import channel before copying it. |
| [VCB phone-number account announcement](https://www.vietcombank.com.vn/vi-VN/Trang-thong-tin-dien-tu/Migration/Mien-phi-mo-tai-khoan-thanh-toan-theo-so-dien-thoai-tren-VCB-Digibank) | The 2022 announcement describes opening an additional selected-number account and matching its final nine digits to a phone number. | This is evidence of different account products, not a current universal account-count, prefix or length rule. Do not derive a person's phone number from an arbitrary STK. |

## Implemented data rules

- Preserve account strings and leading zeros. Scientific notation, embedded spaces,
  invisible characters, numeric input and all-zero placeholders need correction/review.
  A possible missing leading zero is flagged against historical data, never repaired by guessing.
- Scope comparisons by the recipient bank as well as account. Explicit bank data takes
  precedence. VCB is the visible, selectable default only for rows without a bank;
  users can choose “Chưa xác định”. No bank is inferred from an account prefix.
- Normalize case, Vietnamese diacritics and repeated name spaces for comparison only.
  Keep the stored beneficiary name unchanged. Do not use fuzzy name matching to copy money details.
- Index accounts across all checked rows and saved prior months, including different
  Document IDs. A conflicting beneficiary name blocks suggested ID/account sync until
  the user corrects or verifies the information. Same-name repeated payroll lines and
  multiple accounts for one person do not by themselves imply different owners.
- Check earlier names for the same Document ID and bank changes together with STK.
  Historical account options with suspicious input cannot be copied into the current month.
- New IDs with no history alone remain hidden. Material account/name warnings remain
  visible even when no historical Document ID match exists.
- Do not impose an unverified 10/13-digit VCB length rule, an account checksum, or a
  universal twelve-digit Document ID rule. No bank lookup API, registry or external
  personal-data service is called.

The validation thresholds and sync restrictions above are application decisions
informed by the sources; they are not statements that VCB has rejected an account.

## Latest saved source

1. Edit Transaction and press **Lưu sửa**. Saved identity fields take precedence over
   inferred Raw Timesheet repairs; legacy ID aliases are updated with Document ID.
2. Press **Lưu tháng**. Only the selected month is replaced on Supabase, then its
   latest version is read back. Pending unsaved cell edits disable cloud save/check.
3. **Check STK & ID** reads the latest current-month snapshot and the latest snapshot
   of each strictly earlier saved month, including previous years. It requires the
   current month to exist on Supabase; it does not fall back to local rows or old reports.
4. The version manifest is reread after loading to reject changes during the check.
   Before synchronization, donors, targets and the month list are checked again.
   These client preflight checks are not a database-level multi-month transaction.
5. The report identifies its current Supabase version and historical source versions.
   If local and cloud snapshots differ, it offers save-to-cloud or explicit loading
   of the saved month and disables sync meanwhile. Snapshot-relative indexes are
   applied to the checked month, preserving every other local month.

Tests cover updated saves, refreshed prior months, stale donors, a newly added
historical month, concurrent changes during reads, JSONB key order, mixed-month
row indexes, account/name findings, and precedence of explicitly saved edits.
