const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Remove the border-bottom: none hack
const regex2 = /\.table-container tr:last-child td[\s\S]*?border-bottom-width:\s*0px\s*!important;\n}/g;
css = css.replace(regex2, '/* removed border-bottom: none hack */');

fs.writeFileSync('src/index.css', css);
console.log('patched index.css 4');
