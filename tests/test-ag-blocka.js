// AG Block A (18.10.2026): AG6 Markt-Knopf im Overlay zeigt ✓/✗ + Grund (mkMark), Charakter kurz nach dem Start = einziger laufender Client;
// AG1 „läuft ab“ in der Ortszeile der Trade-Karte; AG8 Gewinn in Ergebniszeilen grün (ovPfB).
const fs = require('fs');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // AG6
  const i = html.indexOf('function mkMark(html)'), fn = html.slice(i, html.indexOf('\n', i));
  const res = {};
  const mkMark = new Function('mkRes', 'escapeHtml', fn + ';return mkMark;')(res, esc);
  const btn = '<button type="button" class="tsc-cp-b mk-btn" data-mk="34" title="Marktfenster in EVE öffnen"><svg></svg></button><button type="button" class="tsc-cp-b mk-btn hc-btn" data-ova="hcTog" data-arg="34" title="Preisverlauf">K</button>';
  assert(mkMark(btn) === btn, 'ohne Ergebnis: Knopf unverändert');
  res[34] = { ok: false, msg: 'Nicht geöffnet: Token "abgelaufen"', t: Date.now() };
  let o = mkMark(btn);
  assert(/class="tsc-cp-b mk-btn fail" data-mk="34" title="Nicht geöffnet: Token &quot;abgelaufen&quot;">&#x2717;<\/button>/.test(o) && /hc-btn" data-ova="hcTog" data-arg="34" title="Preisverlauf">K</.test(o), 'Fehler: ✗ + Grund im Tooltip, Preisverlauf-Knopf bleibt');
  res[34] = { ok: true, msg: 'Alpha: Marktfenster in EVE geöffnet', t: Date.now() - 5000 };
  assert(mkMark(btn) === btn, 'nach 4 s wieder normal');
  res[34] = { ok: true, msg: 'Alpha: Marktfenster in EVE geöffnet', t: Date.now() };
  assert(/mk-btn ok" data-mk="34" title="Alpha: Marktfenster in EVE geöffnet">&#x2713;/.test(mkMark(btn)), 'Erfolg: ✓ + Charaktername');
  assert(/html: mkMark\(box\.innerHTML\)/.test(html) && /mkRes\[tid\] = \{ ok: ok, msg: msg, t: Date\.now\(\) \}; if \(typeof ovPublishSatellites === "function"\)\{ ovPublishSatellites\(\); setTimeout\(ovPublishSatellites, 4100\); \}/.test(html), 'Ergebnis geht an die Overlays (und nach 4 s zurück)');
  assert(/\(fg\.clients\.length === 1 \? fg\.clients\[0\] : null\)/.test(main), 'main.js: kurz nach dem Start zählt der einzige laufende Client');
  // AG1
  assert(/trStand\(t\) \+ \(oxh \? " · " \+ oxh\.replace\(\/<\[\^>\]\*>\/g, ""\) : ""\)/.test(html) && /var oxs = oxTrade\(t\.id, true\); if \(oxs\) card\.appendChild\(el\("div", "ov-l txt ov-keep", oxs\)\);/.test(html), 'AG1/CB: „läuft ab“ im ⓘ-Tooltip, unter 24 Std. sichtbar als Zeile');
  // AG8
  const j = html.indexOf('function ovPfB(n)'), pf = html.slice(j, html.indexOf('\n', j));
  const ovPfB = new Function('ovSigned', pf + ';return ovPfB;')(n => (n >= 0 ? '+' : '') + n);
  assert(ovPfB(5) === '<b class="ov-pf">+5</b>' && ovPfB(-3) === '<b class="ov-ls">-3</b>' && ovPfB(0) === '<b class="">+0</b>', 'AG8: Gewinn grün, Verlust rot, 0 neutral');
  assert((html.match(/ovPfB\(/g) || []).length >= 18 && !/<b>" \+ ovSigned\(/.test(html), 'AG8: alle fetten Gewinnzahlen in Ergebniszeilen über ovPfB');
  assert(/#ov-root b\.ov-pf, \.ov-pf\{color:var\(--profit\)\}/.test(html), 'AG8: Farbe = Gewinnfarbe des Schemas');
  console.log('\nALL AG BLOCK A TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
