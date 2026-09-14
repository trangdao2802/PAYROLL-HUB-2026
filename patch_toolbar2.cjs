const fs = require('fs');
const files = [
  'src/app/pages/02-audit/AuditDataTable.tsx',
  'src/app/pages/04-balance/PivotSheet.tsx',
  'src/app/pages/04-balance/BulkPayment.tsx'
];
files.forEach(f => {
  if(fs.existsSync(f)) {
    let code = fs.readFileSync(f, 'utf8');
    code = code.replace(/var\(--table-toolbar-bg,/g, 'var(--table-header-bg,');
    fs.writeFileSync(f, code);
  }
});
console.log('patched table-toolbar-bg everywhere');
