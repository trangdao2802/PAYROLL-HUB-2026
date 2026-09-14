const fs = require('fs');
let code = fs.readFileSync('src/app/lib/ui-settings.ts', 'utf8');

code = code.replace(/--table-column-header-text"/g, '--table-column-header-text-color"');
fs.writeFileSync('src/app/lib/ui-settings.ts', code);
console.log('patched CSS variable name in ui-settings.ts');
