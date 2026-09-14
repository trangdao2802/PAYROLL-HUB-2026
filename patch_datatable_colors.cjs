const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

// Replace text-slate-800 in headers with text-[var(--table-column-header-text-color,#1e293b)]
code = code.replace(/text-slate-800/g, 'text-[var(--table-column-header-text-color,#1e293b)]');
code = code.replace(/text-foreground/g, 'text-[var(--table-column-header-text-color,var(--foreground))]');

fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('patched text colors');
