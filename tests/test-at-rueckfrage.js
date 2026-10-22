// AT (22.10.2026): „Alle EVE-Clients beenden“ fragt im Design statt im Windows-Fenster; geht kein Fenster (EVE vorne) → 2. Klick in 4 s;
// kein Client → kurze Meldung. Seiten-Rückfragen (confirm/alert) laufen über H.ask. Prüft die echte main.js und EVE-Omni.html.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8'), html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
(async () => {
  let clients = 2, asks = [], notes = [], kills = [], askMode = 'ok', now = 1000;
  const execFile = (cmd, args, o, cb) => { if (cmd === 'tasklist') cb(null, Array(clients).fill('"exefile.exe","1"').join('\n')); else kills.push(args.join(' ')); };
  const e = new Function('execFile', 'eoAskAny', 'eoNote', 'Date', 'setTimeout',
    "const IS_WIN = true, win = null; let quitArm = 0;\n" + pick('quitEve') + '\nreturn { quitEve };')(
    execFile, (p, o) => { asks.push(o); return askMode === 'none' ? null : Promise.resolve({ response: askMode === 'ok' ? 0 : 1 }); }, (t, ms) => notes.push(t),
    { now: () => now }, f => f());
  const tick = () => new Promise(r => setImmediate(r));
  e.quitEve(); await tick();
  assert(asks.length === 1 && /alle 2 EVE-Clients/.test(asks[0].message) && kills.length === 2, 'Rückfrage im Design, „Alle beenden“ → normal + nach 5 s hart');
  kills = []; askMode = 'cancel'; e.quitEve(); await tick();
  assert(kills.length === 0, 'Abbrechen beendet nichts');
  askMode = 'none'; asks = []; e.quitEve(); await tick();
  assert(kills.length === 0 && notes.length === 1 && /noch einmal klicken/.test(notes[0]), 'kein Fenster möglich → Hinweis „noch einmal klicken“, nichts beendet');
  now += 3000; e.quitEve(); await tick();
  assert(kills.length === 2 && asks.length === 1, '2. Klick innerhalb von 4 s beendet ohne neue Rückfrage');
  kills = []; e.quitEve(); now += 5000; e.quitEve(); await tick();
  assert(kills.length === 0, '2. Klick nach mehr als 4 s beendet nicht');
  clients = 0; notes = []; asks = []; e.quitEve(); await tick();
  assert(notes[0] === 'Es läuft kein EVE-Client.' && asks.length === 0, 'kein Client → kurze Meldung, keine Rückfrage');
  assert(!/dialog\.showMessageBox\(/.test(pick('quitEve')), 'quitEve nutzt kein Windows-Fenster mehr');
  assert(/ipcMain\.handle\('evecore:ask'/.test(main) && /eoAskAny\(BrowserWindow\.fromWebContents\(ev\.sender\)/.test(main), 'Seite fragt über evecore:ask im Design');
  assert(/MAIN_EN[\s\S]*'Zum Beenden aller EVE-Clients noch einmal klicken \(4 s\)\.': 'Click again to quit all EVE clients \(4 s\)\.'/.test(main), 'Hinweis auch auf Englisch');
  const js = html.replace(/window\.eoConfirm = [\s\S]*?\n  window\.eoAlert = [^\n]*\n/, '');
  assert(!/[^.\w]confirm\(/.test(js.replace(/\["alert", "confirm", "prompt"\]/, '')) && !/[^.\w]alert\(/.test(js), 'Seite: kein confirm()/alert() mehr außer im Rückfall');
  assert((html.match(/await eoConfirm\(/g) || []).length === 6 && (html.match(/eoAlert\(/g) || []).length >= 2, '6 Rückfragen + 2 Meldungen umgebaut');
  assert(/cmd\.type === "eoNote"\) return eoNoteShow/.test(html) && /cmd\.type === "eoNote"\) eoNoteShow/.test(html), 'Meldung im Hauptfenster und in den Overlays');
  console.log('ALL TESTS PASSED');
})().catch(err => { console.error(err.message); process.exit(1); });
