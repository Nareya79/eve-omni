// HZ23 (04.10.2026): Intel-Kanäle – main.js liest EVE-Chatlogs (UTF-16 LE) mit, nur neue Zeilen der gewählten Kanäle, schickt sie an die Seite.
// Prüft die echten Funktionen aus main.js mit einem Test-Ordner.
const fs = require('fs'), path = require('path'), os = require('os');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intel-')), sent = [];
  const line = (who, txt) => '[ 2026.10.04 18:00:00 ] ' + who + ' > ' + txt + '\r\n';
  const head = '﻿\r\n\r\n        ---------------------------------------------------------------\r\n          Channel Name:    Delve.Intel\r\n';
  fs.writeFileSync(path.join(dir, 'Delve.Intel_20261004_170000_111.txt'), Buffer.from(head + line('Alt', 'Charlie alt'), 'utf16le'));
  fs.writeFileSync(path.join(dir, 'Lokal_20261004_170000_111.txt'), Buffer.from(head + line('X', 'Charlie'), 'utf16le'));
  const code = ['const INTEL_FILE = ' + /const INTEL_FILE = (.+);/.exec(main)[1] + ';', 'const intel = { on: false, chans: [], dir: "", timer: null, pos: {} };',
    pick('intelDir'), pick('intelFiles'), pick('intelList'), pick('intelTick'), pick('intelSet'), 'return { intel, intelList, intelTick, intelSet };'].join('\n');
  const M = new Function('fs', 'path', 'app', 'send', 'TEST', 'setTimeout', code)(fs, path, { getPath: () => dir }, c => sent.push(c), false, () => 0);
  const L = M.intelSet({ on: true, chans: ['Delve.Intel'], dir: dir });
  assert(L.ok && L.chans.indexOf('Delve.Intel') >= 0 && L.chans.indexOf('Lokal') >= 0, 'Kanäle aus den Dateinamen');
  assert(sent.length === 0, 'Alte Zeilen beim Start werden nicht gemeldet');
  fs.appendFileSync(path.join(dir, 'Delve.Intel_20261004_170000_111.txt'), Buffer.from(line('Scout Ä', 'Charlie Bad Guy Sabre +3') + line('EVE-System', 'Kanal geändert'), 'utf16le'));
  fs.appendFileSync(path.join(dir, 'Lokal_20261004_170000_111.txt'), Buffer.from(line('Y', 'Delta'), 'utf16le'));
  M.intelTick();
  assert(sent.length === 1 && sent[0].type === 'intel' && sent[0].chan === 'Delve.Intel' && sent[0].who === 'Scout Ä' && sent[0].text === 'Charlie Bad Guy Sabre +3', 'Neue Zeile nur aus dem gewählten Kanal, UTF-16 mit Umlaut, ohne EVE-System');
  M.intelTick();
  assert(sent.length === 1, 'Dieselbe Zeile kommt nicht doppelt');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
