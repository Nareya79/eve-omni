// Kopfzeile: Uhr und Datenstand mit gleich breiten Ziffern – sonst zuckt die rechtsbuendige Knopfzeile jede Sekunde (Nutzer 06.10.2026)
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf8');
function assert(c, m){ if (!c){ console.log('ASSERTION FAILED: ' + m); process.exit(1); } console.log('OK:', m); }
assert(/header\.top \.clock, header\.top \.esi-stand\{font-variant-numeric:tabular-nums\}/.test(html), 'Uhr + Datenstand: tabular-nums');
console.log('\nALL KOPFZEILE TESTS PASSED');
