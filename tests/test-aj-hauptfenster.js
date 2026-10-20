// AJ (18.10.2026): Hauptfenster wie ein Overlay – Kopfleiste (Stil EVE: Knöpfe ohne Kasten, EVE-Symbole, Titel „EVE Omni Beta <Version>“),
// Neocom-Leiste wie die OmniCom-Kacheln; Läufe in der Watchlist ohne Preisverlauf-Knopf.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const css = html.slice(0, html.indexOf('</style>'));
  assert(/header\.top \.ov-ib:not\(\.win-eve\)\{border:0;background:none;/.test(css) && /header\.top :is\(#win-lock, #win-min, #win-max, #win-close\)::before\{content:"";[^}]*mask:var\(--eic\)/.test(css), 'Stil EVE: Kopfleiste ohne Kästen, EVE-Symbole');
  assert(/header\.top #win-lock\[aria-pressed="true"\]\{--eic:url\(/.test(css) && /header\.top #win-max\{--eic:url\(/.test(css), 'Schloss zu/offen, □ als Symbol');
  assert(/\.neo-grp\.neo-eve\.has-sel\{border-color:#fff;box-shadow:none;color:#fff\}/.test(css) && /\.neo-grp\.neo-eve\{border-radius:0;border-color:rgba\(255,255,255,\.14\)/.test(css), 'Neocom-Leiste wie OmniCom-Kacheln');
  assert(/html\.ov-omni body:not\(\.ov-mode\) header\.top \.ov-ib\{border-radius:6px\}/.test(css), 'Stil EVE Omni: Knöpfe wie im EVE-Omni-Overlay');
  assert(/bt\.textContent = "Beta " \+ EVECORE_VERSION;/.test(html), 'Titel mit Version');
  assert(/function mkBtn\(tid\)\{/.test(html) && /m\.lastChild\.appendChild\(mkBtn\(x\.tid\)\);/.test(html), 'AN1 (20.10.): Läufe im Hauptfenster wieder mit Preisverlauf-Knopf');
  console.log('\nALL AJ TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
