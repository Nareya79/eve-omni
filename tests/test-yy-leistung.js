// YY7/YY8 (17.10.2026): OmniBreaker zeichnet nicht, solange das Feld unsichtbar ist; höchstens 8 geparkte Overlays (echte main.js).
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  // YY8: echte satPark mit Platzhalter-Fenstern
  const max = Number((main.match(/const SAT_PARK_MAX = (\d+);/) || [])[1]);
  assert(max === 8, 'SAT_PARK_MAX = 8');
  const destroyed = [], trace = [];
  const win = id => ({ id, d: false, hide(){}, close(){}, getBounds(){ return {}; }, isDestroyed(){ return this.d; }, destroy(){ this.d = true; destroyed.push(id); } });
  const run = new Function('sats', 'S', 'saveSettings', 'pushSettings', 'neoTraceAdd', 'quitting', 'SAT_PARK_MAX',
    'const satParked = {}, stackDrop = () => {};\n' + pick('satPark') + '\nreturn { satPark, satParked };');
  const sats = {}, S = { windows: {} };
  const api = run(sats, S, () => {}, () => {}, t => trace.push(t), false, max);
  for (let i = 1; i <= 10; i++){ sats['v' + i] = win('v' + i); api.satPark('v' + i); }
  assert(Object.keys(api.satParked).length === 8, '10 geschlossen → 8 versteckt');
  assert(destroyed.join() === 'v1,v2', 'die zwei ältesten wirklich geschlossen');
  assert(Object.keys(api.satParked)[0] === 'v3', 'v3 ist jetzt das älteste');
  assert(trace.some(t => /v1 geschlossen/.test(t)), 'Eintrag im OmniCom-Protokoll');
  sats.neocom = win('neocom'); api.satPark('neocom');
  assert(!api.satParked.neocom, 'OmniCom wird nie geparkt');
  // YY7: Spielschleife zeichnet nur bei sichtbarem Feld (Desktop-Kopie aus der Quelle)
  const loop = html.slice(html.indexOf('  function loop(ts) {'), html.indexOf('  function loop(ts) {') + 900);
  assert(/if \(!canvas\.getClientRects\(\)\.length\) return;[^\n]*\n\s*updateHud\(\);\s*\n\s*draw\(/.test(loop), 'loop: unsichtbares Feld → kein updateHud/draw');
  assert(loop.indexOf('raf = win.requestAnimationFrame(loop)') < loop.indexOf('getClientRects'), 'Schleife läuft weiter (wacht beim Öffnen von selbst auf)');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
