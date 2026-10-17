// PQ3 (12.10.2026): Jukebox-Taste an der MiraBox – 1. Druck Overlay als Miniplayer, 2. Druck aufklappen, 3. Druck zu.
// Prüft jbDeckStep aus der echten main.js (true = hier erledigt, false = Seite öffnet/schließt wie bisher).
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  assert(/a\.type === 'ov' && a\.arg === 'musik' && jbDeckStep\(\)/.test(main), 'Tasten-Anschluss fragt jbDeckStep vor dem Weiterreichen');
  const S = { windows: { musik: { open: false, bounds: { x: 0, y: 0, width: 320, height: 380 } } } }, sats = {}, satParked = {}, toggled = [];
  const step = new Function('S', 'sats', 'satParked', 'satMiniToggle', 'JB_MINI_H', pick('jbDeckStep') + '\nreturn jbDeckStep;')(S, sats, satParked, id => toggled.push(id), 84);
  assert(step() === false && S.windows.musik.mini === true && S.windows.musik.bounds.height === 84 && S.windows.musik.normalH === 380, '1. Druck (zu): Seite öffnet, vorher auf Mini gestellt, alte Höhe gemerkt');
  S.windows.musik.open = true; sats.musik = { isDestroyed: () => false };
  assert(step() === true && toggled.join() === 'musik', '2. Druck (offen + Mini): hier aufgeklappt, nicht weitergereicht');
  S.windows.musik.mini = false;
  assert(step() === false && toggled.length === 1, '3. Druck (offen + groß): Seite schließt wie bisher');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
