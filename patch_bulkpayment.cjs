const fs = require('fs');
let code = fs.readFileSync('src/app/pages/04-balance/BulkPayment.tsx', 'utf8');

code = code.replace(/headerClassName="([^"]*)text-slate-800([^"]*)"/g, 'headerClassName="$1text-[var(--table-column-header-text-color,#1e293b)]$2"');
code = code.replace(/footerClassName="([^"]*)text-slate-800([^"]*)"/g, 'footerClassName="$1text-[var(--table-column-header-text-color,#1e293b)]$2"');

fs.writeFileSync('src/app/pages/04-balance/BulkPayment.tsx', code);
console.log('patched BulkPayment.tsx');
