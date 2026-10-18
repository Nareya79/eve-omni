// AH2 (18.10.2026): OmniCom- und Vorschau-Menü als eigenes Menüfenster (Stil EVE) – vorgebaut, solange EVE nicht vorne ist; sonst Rückfall
// Windows-Menü (nie ein neues Fenster bei EVE vorne, NW2); nach dem Schließen Fokus zurück an EVE; Uhr-Menü über popMenu (-2 = Seite zeichnet selbst).
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/function satPopReady\(\)\{ return !!\(satPopWin && !satPopWin\.isDestroyed\(\)\) \|\| !eveFront\(\); \}/.test(main), 'eigenes Menü nur, wenn vorgebaut oder EVE nicht vorne');
  assert(/function eoMenuAt\(tpl, onClose, win\)\{\s*if \(!satPopReady\(\)\)\{ Menu\.buildFromTemplate\(tpl\)\.popup/.test(main), 'sonst Windows-Menü (Rückfall)');
  assert(/if \(!quitting && !eveFront\(\) && !TEST\) satPopGet\(\);/.test(main), 'Vorbau in satSpareMake, solange EVE nicht vorne ist');
  assert(/if \(was\)\{ satPopWin\.hide\(\); if \(fg\.eveBefore && fg\.lastEve\) activateClient\(fg\.lastEve\); \}/.test(main), 'nach dem Schließen Fokus zurück an EVE');
  assert(!/satPopWin[^\n]*loadURL\('about:blank'\)/.test(main) && !/w\.loadURL\('about:blank'\);\s*neoTraceAdd\('Menüfenster gebaut'\)/.test(main), 'kein about:blank im Menüfenster (Absturz)');
  assert(/eoMenuAt\(\[[\s\S]*?\], \(\) => \{ satMenuOpen = false; \}, w\);/.test(main) && /eoMenuAt\(\[[\s\S]*?\], null, w\);   \/\/ AH2/.test(main), 'OmniCom- und Vorschau-Menü über eoMenuAt');
  assert(/ipcMain\.handle\('evecore:popMenu'[^\n]*if \(!satPopReady\(\)\) return res\(-2\);/.test(main), 'popMenu: -2, wenn kein Menüfenster möglich');
  assert(/if \(i === -2\) neoCtxOwn\(ev2\);/.test(html) && /function neoCtxOwn\(ev\)/.test(html), 'Uhr-Menü: Rückfall auf das Menü in der Seite');
  assert(/\.ovn-l\{min-width:3\.2em;width:auto;flex:none;white-space:nowrap/.test(html), 'Navigation: Beschriftung wächst mit („Destination“)');
  console.log('\nALL AH2 TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
