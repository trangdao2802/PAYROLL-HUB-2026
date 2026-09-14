const fs = require('fs');
let code = fs.readFileSync('src/app/lib/ui-settings.ts', 'utf8');

// I will just read the current file and apply regex replacements.
// Wait, I can just replace `tableColumnHeaderTextColor: "#F6F5BD"` with `#FFFFFF` globally, and then explicitly set it for soft-matcha.
code = code.replace(/tableColumnHeaderTextColor: "#F6F5BD"/g, 'tableColumnHeaderTextColor: "#FFFFFF"');

// Now, for soft-matcha:
// find id: "soft-matcha" and replace down to tableColumnHeaderTextColor
const matchaStart = code.indexOf('id: "soft-matcha"');
if (matchaStart !== -1) {
  const matchaEnd = code.indexOf('},', matchaStart);
  let matchaBlock = code.substring(matchaStart, matchaEnd);
  matchaBlock = matchaBlock.replace(/tableColumnHeaderTextColor: "#FFFFFF"/, 'tableColumnHeaderTextColor: "#F6F5BD"');
  code = code.substring(0, matchaStart) + matchaBlock + code.substring(matchaEnd);
}

fs.writeFileSync('src/app/lib/ui-settings.ts', code);
console.log('patched ui-settings.ts again');
