// DD5 (02.10.2026): Knopf „EVE starten“ oben im Hauptfenster + Tray-Menü → offizieller EVE-Launcher
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const mainJs = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
let launched = 0;
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.fetch = () => Promise.reject(new Error('offline'));
    w.evecoreHost = { getSettings: () => Promise.resolve({ windows: {} }), setSettings: p => Promise.resolve(p), onCommand(){}, ready(){}, setMode(){}, launchEve(){ launched++; } };
  } }).window;
setTimeout(() => {
  try{
    const b = w.document.getElementById('win-eve');
    assert(b && /EVE/.test(b.textContent) && /Launcher/.test(b.title), 'DD5: Knopf „▶ EVE“ in der Kopfleiste');
    b.click();
    assert(launched === 1, 'DD5: Klick öffnet den Launcher über das Programm');
    assert(/label: 'EVE starten \(Launcher\)', click: launchEve/.test(mainJs) && /eve-online', 'eve-online\.exe'/.test(mainJs), 'DD5: Tray-Menü + Launcher-Pfad in main.js');
    console.log('\nALL DD5 TESTS PASSED'); process.exit(0);
  }catch(e){ console.log(e.message); process.exit(1); }
}, 900);
