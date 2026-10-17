// BB26 (30.09.2026): Hauptfenster beim Start öffnen – abschaltbar (Einstellungen › Programm › Start); Overlays kommen trotzdem,
// „Overlay zeigen, sobald EVE läuft“ öffnet das Hauptfenster dann nicht mehr von selbst
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    assert(/startMain: true,/.test(main) && /'autostart', 'startMain',/.test(main), 'BB26: Einstellung startMain (Standard an), vom Programm speicherbar');
    assert(/createWindow\(!hidden && S\.startMain !== false\)/.test(main) && /setTimeout\(\(\) => syncSats\(!hidden\), 800\)/.test(main), 'BB26: Start ohne Hauptfenster, Overlays kommen trotzdem');
    assert(/S\.eveAutoShow\)\{ if \(S\.startMain !== false \|\| \(win && win\.isVisible\(\)\)\) showWin\(false\); showSats\(\); \}/.test(main), 'BB26: EVE-Start holt das Hauptfenster nicht hervor, wenn es aus sein soll');
    let S = { startMain: false, windows: {} }; const patches = [];
    const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline'));
      x.evecoreHost = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))), setSettings: p => { patches.push(p); Object.assign(S, p); return Promise.resolve(JSON.parse(JSON.stringify(S))); }, publishView(){}, onCommand(){}, ready(){}, setMode(){} }; } }).window;
    await tick(800);
    const d = w.document, cb = d.getElementById('hs-start-main');
    w.__test.switchTab('settings'); await tick(100);
    assert(cb && d.getElementById('set-pane-program').contains(cb) && cb.checked === false, 'BB26: Haken unter Einstellungen › Programm zeigt den Stand');
    cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(50);
    assert(patches.some(p => p.startMain === true), 'BB26: Haken speichert im Programm');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
