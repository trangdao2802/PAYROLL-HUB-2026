const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

// Remove shadow from thead
code = code.replace(/shadow-\[0_1px_0_var\(--table-border-color,#e7dbdc\)\]/g, 'border-b border-[var(--table-border-color,#e7dbdc)]');

fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('patched DataTable.tsx');
