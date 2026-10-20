// 18.10.2026: „→ EVE“ im Hauling-/Hub-Overlay zeigt den Zustand am Knopf (… / ✓ / ✗ mit Grund) – die Meldung oben war beim Klick
// unten in einer aufgeklappten Option nicht zu sehen; nach 25 s ohne Antwort „EVE antwortet nicht“.
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const i = html.indexOf('var haulEveSt = {};'), j = html.indexOf('\n  }', html.indexOf('function ovRouteBtns(arg){')) + 4;
  const env = new Function('escapeHtml', html.slice(i, j) + '\nreturn { st: haulEveSt, btns: ovRouteBtns };')(x => String(x).replace(/"/g, '&quot;'));
  assert(/>→ EVE<\/button>/.test(env.btns('1')), 'ohne Klick: „→ EVE“');
  env.st['1'] = { busy: true, t: Date.now() }; assert(/>→ EVE …<\/button>/.test(env.btns('1')), 'während des Setzens: „→ EVE …“');
  env.st['1'] = { ok: true, t: Date.now(), msg: 'Pilot Alpha: Ziel Amarr im Spiel gesetzt.' }; assert(/class="ok" title="Pilot Alpha: Ziel Amarr im Spiel gesetzt\.">✓ EVE</.test(env.btns('1')), 'Erfolg: ✓ mit Meldung');
  env.st['1'] = { ok: false, t: Date.now(), msg: 'Nicht gesetzt: ESI 401' }; assert(/class="bad" title="Nicht gesetzt: ESI 401">✗ EVE</.test(env.btns('1')), 'Fehler: ✗ mit Grund');
  env.st['1'] = { ok: true, t: Date.now() - 9000, msg: 'x' }; assert(/>→ EVE<\/button>/.test(env.btns('1')), 'nach 8 s wieder normal');
  assert(/setTimeout\(function\(\)\{ r\("timeout"\); \}, 25000\)/.test(html) && /EVE antwortet nicht – später noch einmal versuchen/.test(html), 'Zeitgrenze 25 s mit Meldung');
  console.log('\nALL HAUL-EVE TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
