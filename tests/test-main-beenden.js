// Fehler 04.10.2026: „Beenden“ im Infobereich schloss die Fenster, aber der Helfer meldete weiter FG/EVES –
// pvSync/openSat öffneten sofort neue Fenster, app.quit brach ab und EVE Omni lief weiter. Prüft die echte main.js.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  // Echte Kopfzeilen müssen die Sperre enthalten 
  assert(/if \(!VIEWS\[id\] \|\| quitting\) return null;/.test(pick('openSat')), 'openSat: Sperre beim Beenden in main.js');
  assert(/^\s*if \(quitting\) return;/.test(pick('pvSync').split('\n')[1]), 'pvSync: erste Zeile ist die Sperre beim Beenden');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
