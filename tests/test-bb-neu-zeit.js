// BB (22.10.2026): „neu: hh:mm“ auch zugeklappt – Watchlist (Hauptfenster + Overlay) bei Trades und Läufen, Trades-Overlay, Hauling-Overlay;
// Name kürzt sich (trk-nm, Tooltip), laufende zugeklappte Zeilen ohne Zeit hinten.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/tkMuteBtn\(x\) \+ tkNextHtml\(x\) \+ \(ctAny\(x\.items\)/.test(html) && !/\(trkOpen\[k\] \? tkNextHtml\(x\) : ""\)/.test(html), 'Hauptfenster-Watchlist: „neu:“ auch zugeklappt (Trades + Läufe)');
  assert(/trkNm\(x\.name\) \+ \(trkOpenIds\(o\)[\s\S]{0,80}tkMuteBtn\(x\) \+ tkNextHtml\(x\)/.test(html), 'Overlay-Watchlist: „neu:“ zugeklappt');
  assert(/tkNextHtml\(\{ state: "active", charId: t\.charId \}\)/.test(html) && /tkNextHtml\(\{ state: "active", charId: run\.charId \}\)/.test(html), 'Trades-Overlay + Hauling-Overlay: „neu:“ an jeder Karte');
  assert(/\(x\.tm && trkOpen\[k\] \? " · " \+ tkTimeHtml\(x\.tm, true\) : ""\)/.test(html) && /\(x\.tm && x\.state !== "active" \?/.test(html), 'zugeklappt laufend: Zeit hinten weg');
  assert(/\.trk-nm\{display:inline-block;max-width:13em;overflow:hidden;text-overflow:ellipsis/.test(html) && /function trkNm\(n\)\{ return '<span class="trk-nm" title="/.test(html), 'Name kürzt sich mit …, voller Name im Tooltip');
  console.log('ALL TESTS PASSED');
}catch(e){ console.error(e.message); process.exit(1); }
