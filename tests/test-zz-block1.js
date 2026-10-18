// ZZ1 (17.10.2026): Lauf unterwegs grün, Warnung (Sell-Order besser, einzelne Ware im Minus, zu langsam) gelb, rot nur hrBad.
// ZZ5: Lauftext im Jukebox-Overlay hängt an der Zeitleiste (kein Ruckeln beim Neuaufbau jede Sekunde).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document;
    // ZZ1: Rahmenfarben (CSS-Regeln) an einer Karte nachrechnen
    const css = [...d.querySelectorAll('style')].map(s => s.textContent).join('\n');
    assert(/:is\(\.trk-run,\.lf-run\)\.st-way:not\(\.trk-ob\)\{--st:var\(--st-done,var\(--profit\)\)\}/.test(css), 'Lauf unterwegs ohne Warnung = grün (Watchlist + Läufe-Overlay)');
    assert(/\.ov-card\.ov-card\.trk-ob:is\(\.trk-run,\.lf-run\)\{--st:#e8c547\}/.test(css), 'Lauf-Warnung = echtes Gelb (Watchlist + Läufe-Overlay)');
    assert(/if \(x\.kind === "Lauf" && slow && !x\.bad\) x\.warn = true;/.test(html) && /tkStCls\(x\.ph, x\.bad \|\| \(x\.kind !== "Lauf" && slow\)\)/.test(html), 'Watchlist: Lauf zu langsam = gelb statt rot, Trades unverändert');
    assert(/"ov-card lf-run" \+ tkStCls\(g\.phase, rBad\) \+ \(!rBad && \(vcRed\(run\) \|\| !!\(tmR && tmR\.slow\)\) \? " trk-ob" : ""\)/.test(html), 'Läufe-Overlay: rot nur hrBad, Warnung gelb');
    assert(/function hrBad\(run, g\)\{\s*return \(g\.forecast !== null && g\.forecast < 0\) \|\|/.test(html), 'rot bleibt: Minus insgesamt oder vergessene Ware (hrBad unverändert)');
    // ZZ5: jbMqSync setzt Verzögerung 0 und startTime 0 (Animation an der Zeitleiste)
    const box = d.createElement('div'); box.innerHTML = '<span class="jb-mq jb-on"><span style="animation-delay:-7.3s">Titel</span></span>'; d.body.appendChild(box);
    const anim = { startTime: 1234 }, s = box.querySelector('span > span'); s.getAnimations = () => [anim];
    w.__test.jbMqSync(box);
    assert(s.style.animationDelay === '0s' && anim.startTime === 0, 'jbMqSync: Lauftext an der Zeitleiste (startTime 0)');
    assert(/if \(view === "musik"\) jbMqSync\(body\);/.test(html), 'Overlay-Fenster ruft jbMqSync nach jedem Neuaufbau');
    console.log('\nALL ZZ BLOCK1 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
