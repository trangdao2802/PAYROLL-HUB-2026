const fs = require('fs');
let code = fs.readFileSync('src/app/lib/ui-settings.ts', 'utf8');

// Replace tableColumnHeaderTextColor: "#FFFFFF" with tableColumnHeaderTextColor: "#F6F5BD" for soft-matcha
code = code.replace(/tableColumnHeaderTextColor: "#FFFFFF",\s*tableDataBg/g, 'tableColumnHeaderTextColor: "#F6F5BD",\n    tableDataBg');
// also primary-foreground to #F6F5BD in index.css
fs.writeFileSync('src/app/lib/ui-settings.ts', code);
console.log('patched soft matcha in ui-settings.ts');
