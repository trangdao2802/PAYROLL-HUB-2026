const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

code = code.replace(/var\(--table-toolbar-bg,/g, 'var(--table-header-bg,');
fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('patched table-toolbar-bg in DataTable.tsx');
