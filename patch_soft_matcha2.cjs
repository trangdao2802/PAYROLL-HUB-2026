const fs = require('fs');
let code = fs.readFileSync('src/app/lib/ui-settings.ts', 'utf8');

const matchaStart = code.indexOf('id: "soft-matcha"');
if (matchaStart !== -1) {
  const matchaEnd = code.indexOf('},', matchaStart);
  let matchaBlock = code.substring(matchaStart, matchaEnd);
  
  matchaBlock = matchaBlock.replace(/tableHeaderBg: "[^"]+"/, 'tableHeaderBg: "#EAF0EB"');
  matchaBlock = matchaBlock.replace(/tableColumnHeaderBg: "[^"]+"/, 'tableColumnHeaderBg: "#F6F5BD"');
  matchaBlock = matchaBlock.replace(/tableColumnHeaderTextColor: "[^"]+"/, 'tableColumnHeaderTextColor: "#4A5D4E"');
  matchaBlock = matchaBlock.replace(/tableFooterBg: "[^"]+"/, 'tableFooterBg: "#F6F5BD"'); // match footer to header for balance
  
  code = code.substring(0, matchaStart) + matchaBlock + code.substring(matchaEnd);
}

fs.writeFileSync('src/app/lib/ui-settings.ts', code);
console.log('patched soft-matcha block');
