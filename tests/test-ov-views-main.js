// 09.10.2026: Übersicht im OmniCom zeigte „Overlay an“, aber kein Fenster – main.js kannte die Ansicht „home“ nicht.
// Prüft: jede Overlay-Ansicht der Seite (OV_VIEWS) steht auch in main.js (VIEWS), sonst öffnet das Programm kein Fenster.
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8'), main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const keys = s => [...s.matchAll(/(\w+):\s*["']/g)].map(x => x[1]);
try{
  const ov = keys(html.match(/var OV_VIEWS = \{([\s\S]*?)\};/)[1]), vw = keys(main.match(/const VIEWS = \{([\s\S]*?)\};/)[1]);
  const miss = ov.filter(k => vw.indexOf(k) < 0);
  assert(miss.length === 0, 'alle Overlay-Ansichten in main.js bekannt' + (miss.length ? ' – fehlt: ' + miss.join(', ') : ''));
  // 09.10.: Vordergrund je Overlay – eigener Wert geht vor, sonst der allgemeine Schalter
  const src = main.match(/function satTop\(id\)\{[^\n]*\}/)[0];
  const satTop = S => new Function('S', src + '; return satTop;')(S);
  const S = { alwaysOnTop: true, windows: { karte: { top: false }, wallet: {} } };
  assert(satTop(S)('karte') === false && satTop(S)('wallet') === true && satTop(S)('browser') === true, 'satTop: Fenster-Wert vor allgemeinem Schalter');
  S.alwaysOnTop = false; S.windows.radar = { top: true };
  assert(satTop(S)('radar') === true && satTop(S)('wallet') === false, 'satTop: einzelnes Fenster vorne trotz allgemein aus');
  assert(/label: 'Immer im Vordergrund', type: 'checkbox', checked: satTop\(id\)/.test(main), 'Overlay-Menü schaltet nur dieses Fenster');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
