// Fehler 23.10.2026: Release 5.2.0 zeigte im Titel 5.1.0 – eine alte EVE-Omni.html neben der exe ging vor der eingebauten.
// Prüft die echte main.js: neben der exe nur, wenn nicht älter (htmlOlder), sonst die eingebaute.
const fs = require('fs'), os = require('os'), path = require('path');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/existsSync\(besideExeHtml\(\)\) && !htmlOlder\(besideExeHtml\(\), bundledHtml\(\)\)/.test(main), 'effectiveHtml: neben der exe nur wenn nicht älter');
  const f = main.slice(main.indexOf('const htmlVerMemo'), main.indexOf('function backupDir'));
  const { htmlOlder } = new Function('fs', f + ';return { htmlOlder }')(fs);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hv')), w = (n, v) => { const p = path.join(d, n); fs.writeFileSync(p, 'x var EVECORE_VERSION = "' + v + '"; y'); return p; };
  const a = w('a', '5.1.0'), b = w('b', '5.2.0'), c = w('c', '5.10.0');
  assert(htmlOlder(a, b) === true, '5.1.0 ist älter als 5.2.0');
  assert(htmlOlder(b, a) === false && htmlOlder(b, b) === false, '5.2.0 gegen 5.1.0 / gleich: nicht älter');
  assert(htmlOlder(b, c) === true, '5.2.0 älter als 5.10.0 (Zahlen, nicht Text)');
  assert(htmlOlder(path.join(d, 'fehlt'), b) === true, 'unlesbare Datei gilt als älter');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
