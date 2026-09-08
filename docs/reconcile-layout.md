# Reconcile table layout

The historical report shows each common ID, account and beneficiary name once.
A field splits into source/current child columns only when the complete result
contains a difference. Matching rows within that split group span both columns.
The column plan uses all exceptions, so pagination does not move the headers.
A name-only discrepancy uses six columns instead of the previous ten.

Historical repetitions are grouped by comparison value, retaining every source
month and link. Missing values, conflicting values and leading zeroes are not
discarded. The existing name normalization is used for display grouping only.
Warnings and bank/source details share one column; sync actions stay alongside.
The full original report remains available for export.

Financial Reconcile similarly shares matching account and payment values and
shows AE/ACC subheaders for differences. Row and footer spans follow the actual
column count. This presentation does not change payroll calculations or sync.

The history toolbar contains Save month, Check STK & ID and a dedicated settings
icon. Bank choice, authentication, cloud load, export, versions and rules are
inside settings. Contextual row actions, pagination and source return buttons
remain at the point of use. Short errors and local/cloud mismatch states remain
visible, including how to resolve them.

## Evidence and implementation choices

W3C demonstrates two-tier grouped table headings using column spans and explicit
column-group associations. The table also names header associations for merged
data cells. [W3C WAI: irregular headers](https://www.w3.org/WAI/tutorials/tables/irregular/)
(updated 27 July 2019; accessed 8 September 2026).

Complex tables should also be considered for simplification. This design stays
within two header tiers and moves ancillary information into settings/details.
[W3C WAI: multi-level headers](https://www.w3.org/WAI/tutorials/tables/multi-level/)
(accessed 8 September 2026).

GOV.UK frames tables as a way to compare and scan information and supports row
and column spans. [GOV.UK Design System: table](https://design-system.service.gov.uk/components/table/)
(publication date not stated; accessed 8 September 2026).

Grouping equal values and the specific toolbar arrangement are product decisions
requested by the user. They have not been evaluated in a timed usability study.
Verification covers complete values, header/body/footer alignment, source access,
settings controls, saved-data behavior and unchanged financial calculations.
