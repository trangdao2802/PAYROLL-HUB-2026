const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

code = code.replace(/text-\[var\(--table-column-header-text-color,var\(--foreground\)\)\]/g, 'text-foreground');
fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('reverted text-foreground');
