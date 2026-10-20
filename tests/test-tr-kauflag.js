// 19.10.2026 (Nutzer): Kauforder füllte die letzten 6 von 7, Order verschwand → Trade sprang mit „1 gekauft / 1 verkauft“ auf erledigt,
// weil EVE die letzten Käufe erst später als Buchung liefert. Jetzt: 90 Min. nach dem Verschwinden zählt der Einkauf nur mit ≥ Schwelle als fertig.
// Dazu AL2: aktueller Verkaufspreis schon beim Einkauf zum Kopieren.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/if \(!still\)\{ t\.buyDone = true; t\.buyGone = Date\.now\(\); changed = true; \}/.test(html), 'Verschwinden der Kauforder wird mit Zeit gemerkt');
  const line = html.match(/    var buyFin = [^\n]*\n    ev\.allSold = [^\n]*/)[0];
  const run = (t, p, now) => { const c = { t, p, thr: 0.9, TR_TX_LAG: 90 * 60000, Date: { now: () => now }, ev: {} }; vm.createContext(c); vm.runInContext(line, c); return c.ev.allSold; };
  const T0 = 1e12, t = { qty: 7, buyDone: true, buyGone: T0 };
  assert(run(t, { bought: 1, sold: 1, lost: 0 }, T0 + 5 * 60000) === false, 'Fall des Nutzers: 1/1 kurz nach dem Füllen → NICHT erledigt');
  assert(run(t, { bought: 7, sold: 7, lost: 0 }, T0 + 5 * 60000) === true, 'Buchungen da, alles verkauft → erledigt');
  assert(run(t, { bought: 3, sold: 3, lost: 0 }, T0 + 2 * 3600000) === true, 'abgelaufene Teil-Order: nach 90 Min. wie bisher erledigt');
  assert(run({ qty: 7, buyDone: true }, { bought: 3, sold: 3, lost: 0 }, T0) === true, 'alte Trades ohne buyGone wie bisher');
  assert(run({ qty: 7, buyDone: false }, { bought: 3, sold: 3, lost: 0 }, T0) === false, 'Einkauf läuft noch → nicht erledigt');
  assert(/!\(ev\.stock > 0 \|\| live\.own\.sell\) && ev\.sellNow !== null\)[^\n]*\n\s*ss\.appendChild\(trLine\("Markt jetzt", tscFmtPrice\(ev\.sellNow\), tscCopyPrice\(ev\.sellNow\)/.test(html) && /"Markt jetzt": "Market now"/.test(html), 'AL2: „Markt jetzt“ zum Kopieren, auch ohne Ware im Hangar (DE/EN)');
  assert(/lm\.appendChild\(ovCp\(tscFmtPrice\(ev\.sellNow\), tscCopyPrice\(ev\.sellNow\), "Aktuellen Verkaufspreis kopieren"\)\)/.test(html), 'AL2 auch im Trades-Overlay');
  console.log('\nALL TR KAUFLAG TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
