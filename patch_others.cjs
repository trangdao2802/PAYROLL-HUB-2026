const fs = require('fs');

const mktPath = 'src/app/pages/01-timesheet/tables/MktLocalNorthPivotTable.tsx';
let mkt = fs.readFileSync(mktPath, 'utf8');
mkt = mkt.replace(/shadow-\[0_1px_0_var\(--table-border-color,#e7dbdc\)\]/g, 'border-b border-[var(--table-border-color,#e7dbdc)]');
mkt = mkt.replace(/<thead className="sticky top-0 z-\[110\] bg-\[var\(--table-column-header-bg,#F4ECD8\)\] border-b border-\[var\(--table-border-color,#e7dbdc\)\]">/g, 
  '<thead className="sticky top-0 z-[110] bg-[var(--table-column-header-bg,#F4ECD8)]">');
fs.writeFileSync(mktPath, mkt);

const auditPath = 'src/app/pages/02-audit/AllowedTaRulesTable.tsx';
if (fs.existsSync(auditPath)) {
  let audit = fs.readFileSync(auditPath, 'utf8');
  audit = audit.replace(/shadow-\[0_1px_0_var\(--table-border-color,#d5d8dc\)\]/g, 'border-b border-[var(--table-border-color,#d5d8dc)]');
  audit = audit.replace(/<thead className="sticky top-0 z-20 bg-\[var\(--table-column-header-bg,#D9C9D0\)\] text-slate-800 border-b border-\[var\(--table-border-color,#d5d8dc\)\]">/g,
    '<thead className="sticky top-0 z-20 bg-[var(--table-column-header-bg,#D9C9D0)] text-slate-800">');
  fs.writeFileSync(auditPath, audit);
}

console.log('patched other tables');
