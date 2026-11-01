// AZ (22.10.2026): Watchlist – Ort (📍) bei Trades nur aufgeklappt (Hauptfenster + Overlay); Stil EVE: alle grünen Elemente Neongrün #00ff00 mit Schein,
// Verlust-Linie bleibt rot.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(html.includes('trkWhere(x, !trkOpen[k])'), 'Hauptfenster: zugeklappt Ort klein (nur System)');   // 31.10.
  assert(html.includes('trkWhere(x, trkOpenIds(o).indexOf(String(x.id)) < 0)'), 'Overlay: zugeklappt Ort klein (nur System)');
  assert(/eveSysName\(x\.where\.replace/.test(html) && html.includes('.trk-where.sm{'), 'klein = nur Systemname, eigene kleine Schrift');
  assert(/html\.ov-eve:not\(\[data-scheme="light"\]\), html\.ov-eve:not\(\[data-scheme="light"\]\) body\{--profit:#00ff00;--profit-bg:rgba\(0,255,0,\.12\)\}/.test(html), 'Stil EVE: --profit = #00ff00 (Hauptfenster + Overlays)');
  assert(/:is\(\.pos, \.ok, \.ov-pf, \.profit, \.pill\.profit, \.pill\.gk-ok, \.gk-ok, \.sl-profit/.test(html) && /text-shadow:0 0 3px rgba\(0,255,0,\.28\)/.test(html), 'Schein auf allen grünen Texten inkl. Gank sicher (gk-ok) – BL3: halber Schein');
  assert(/\.ov-card:not\(\.dn-neg\) > \.ov-bar-mini\.dn\{background:#00ff00;box-shadow/.test(html), 'grüne Linie erledigter Lauf neongrün, Verlust-Linie bleibt rot');
  console.log('ALL TESTS PASSED');
}catch(e){ console.error(e.message); process.exit(1); }
