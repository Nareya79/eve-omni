// Vom Nutzer geoeffnete Overlays kommen nach vorne, auch wenn EVE gerade nicht vorne ist ("nur ueber EVE" legte sie sonst unsichtbar hinter das aktive Programm; Nutzer 06.10.2026)
const fs = require('fs');
const m = fs.readFileSync('/home/claude/main.js', 'utf8');
function assert(c, msg){ if (!c){ console.log('ASSERTION FAILED: ' + msg); process.exit(1); } console.log('OK:', msg); }
assert(/function syncSats\(show, front\)/.test(m) && /if \(front && w\) w\.once\('show'[^\n]*moveTop\(\)/.test(m), 'syncSats(front): neues Fenster nach dem Zeigen nach vorne');
assert(/if \(patch\.windows\) syncSats\(undefined, true\);/.test(m), 'OmniCom-Klick/Einstellungen (setSettings windows) öffnen vorne');
assert(/open: m\.checked \}\); saveSettings\(\); syncSats\(undefined, true\)/.test(m), 'Tray-Menü öffnet vorne');
assert(/setTimeout\(\(\) => syncSats\(!hidden\), 800\)/.test(m), 'Programmstart: wiederhergestellte Overlays weiter nach „nur über EVE“');
console.log('\nALL OVERLAY-VORNE TESTS PASSED');
