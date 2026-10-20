// AI4 (18.10.2026): wieder gezeigte (geparkte/Reserve-)Overlays erscheinen unsichtbar und werden nach zwei Bildern eingeblendet und eingeordnet
// – vorher blitzte das durchsichtige Fenster kurz (altes Bild → leer → neu). Messung beim Nutzer: je Klick genau ein show/hide.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  assert(/function satShowSoft\(w, done\)\{[\s\S]*?applySatState\(w\); if \(done\) done\(\);[\s\S]*?w\.setOpacity\(0\); w\.showInactive\(\);[\s\S]*?requestAnimationFrame[\s\S]*?setTimeout\(show, 16\)/.test(main), 'unsichtbar zeigen, nach zwei Bildern einblenden + einordnen');
  assert(/setTimeout\(show, 400\);   \/\/ Sicherheitsnetz/.test(main), 'Sicherheitsnetz nach 400 ms');
  assert(/if \(show !== false\) satShowSoft\(pk\);/.test(main) && /setTimeout\(\(\) => \{ if \(!w\.isDestroyed\(\)\) satShowSoft\(w\); \}, 30\)/.test(main), 'gilt für geparkte und Reserve-Overlays');
  assert(/\['show', 'hide', 'minimize', 'restore'\]\.forEach\(e => w\.on\(e, \(\) => neoTraceAdd\('Fenster ' \+ nm\(\) \+ ' ' \+ e\)\)\)/.test(main), 'Messung im Diagnose-Protokoll bleibt');
  console.log('\nALL AI4 TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
