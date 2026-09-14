const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Remove the border-right: none hack
const regex1 = /\.table-container th:last-child[\s\S]*?border-right-width:\s*0px\s*!important;\n}/g;
css = css.replace(regex1, '/* removed border-right: none hack */');

fs.writeFileSync('src/index.css', css);
console.log('patched index.css 3');
