const fs = require('fs');
let code = fs.readFileSync('src/app/components/DataTable.tsx', 'utf8');

// Remove from thead
code = code.replace(/<thead className=\{stickyHeader \? "sticky top-0 z-\[120\] bg-\[var\(--table-column-header-bg,#F4ECD8\)\] border-b border-\[var\(--table-border-color,#e7dbdc\)\]" : ""\}>/g, 
  '<thead className={stickyHeader ? "sticky top-0 z-[120] bg-[var(--table-column-header-bg,#F4ECD8)]" : ""}>');

fs.writeFileSync('src/app/components/DataTable.tsx', code);
console.log('patched DataTable.tsx 2');
