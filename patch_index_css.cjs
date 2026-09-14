const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// We want to remove the block that sets border-right: none !important on th:last-child and td:last-child
const regex1 = /\.table-container th:last-child[\s\S]*?border-right-width:\s*0px\s*!important;\n}/g;
css = css.replace(regex1, '/* removed border-right: none hack */');

// Also the border-bottom hack
const regex2 = /\.table-container tr:last-child td[\s\S]*?border-bottom-width:\s*0px\s*!important;\n}/g;
css = css.replace(regex2, '/* removed border-bottom: none hack */');

fs.writeFileSync('src/index.css', css);
console.log('patched index.css');
