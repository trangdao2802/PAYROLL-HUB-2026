# Table data refresh

- Gross Pay keeps manually inserted blank rows visible, including under search/column filters. It selects the page containing the new row. Entering ID Number completes the draft; normal filtering then applies. Source indexes prevent insertion/editing against a different month.
- **Làm mới dữ liệu** on editable source tables restores the saved pre-edit snapshot, including deleted rows, and discards inserted rows and cell edits. This covers the entire source table across all months, not only displayed/filtered rows. Undo remains available through the app history.
- Snapshots are stored separately in IndexedDB alongside app data. Explicit Master/Timesheet/Audit file processing and Transaction generation establish a new baseline. Manual changes preserve the first pre-edit baseline.
- Existing data from older releases has no guaranteed original snapshot. Reprocess the original files once to establish one; refresh reports missing originals instead of claiming success. The first edit after upgrading can preserve the current state, but cannot recover earlier edits.
- Raw Data, employee/center summaries and Pivot Timesheet share Timesheet Roster. Restoring this source recalculates all its dependent summaries. File-list refresh restores list edits; it does not re-download files.
- Audit/Reconcile/Trial Balance are calculated views; refresh recalculates from current source tables. Audit rules have their own restore scope. Pivot Master regenerates from Master without overlaying its manually edited main cache. Saved MKT source cache is retained when its file is absent.
- Deductions honors the existing month lock and preserves its legacy source fallback. Refresh does not write Transaction monthly versions to Supabase or change saved Hold carry-forward records.
- Global data deletion also removes the original snapshots.

Verification: `npm test`, `npm run build`, focused ESLint and TypeScript comparison. Browser verification requires Chromium; the current execution environment could not download it.
