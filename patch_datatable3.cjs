const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

// Replace border-t with nothing on footer rows
code = code.replace(/border-b border-r-0 border-l-0 border-t/g, 'border-b border-r-0 border-l-0');
code = code.replace(/border-b border-t border-r-0 border-l-0/g, 'border-b border-r-0 border-l-0');

fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('patched DataTable.tsx 3');
