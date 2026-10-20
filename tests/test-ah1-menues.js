// AH1 + AH3 (18.10.2026): Menüs im Stil EVE – Menüfenster des Programms (eoMenu/eoAsk) bekommen Stil + Farben (popLook) von der Seite,
// Menüs in der Seite (Rechtsklick ov-ctx, ⚙-Optionen ov-mini) eckig in der Grundfarbe; Stil EVE Omni unverändert.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    // main.js
    assert(/'ovScale', 'popLook', 'ovMark']/.test(main) && /payload\.look = S\.popLook \|\| null;/.test(main), 'main.js nimmt popLook an und gibt es jedem Menüfenster mit');
    assert(/if \(P\.look && P\.look\.eve\)\{ var de = document\.documentElement; de\.className = "eve";/.test(main), 'Menüfenster schaltet auf Stil EVE');
    assert(/html\.eve \.m\{background:var\(--bg,#0a1214\);border:1px solid var\(--bd,#1f2827\);border-radius:0/.test(main) && /html\.eve \.i\.on\{background:var\(--sel,#27444b\)/.test(main), 'Stil EVE: eckig, Grundfarbe, 1-px-Kante, Auswahl Akzent');
    // Seite schickt popLook (Stil EVE) bzw. null (EVE Omni)
    const sent = [];
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
        w.evecoreHost = { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: p => { sent.push(p); return Promise.resolve(p); }, publishView(){}, onCommand(){}, ready(){} }; } }).window;
    await tick(700);
    const looks = () => sent.filter(p => 'popLook' in p).map(p => p.popLook);
    assert(looks().length >= 1 && looks()[looks().length - 1] && looks()[looks().length - 1].eve === true && 'bg' in looks()[looks().length - 1], 'Stil EVE: Seite schickt popLook mit Farben');
    const n = looks().length, st = w.document.getElementById('ovs-style'); st.value = 'omni'; st.onchange(); await tick(50);
    assert(looks().length === n + 1 && looks()[n] === null, 'Stil EVE Omni: popLook = null (Menüs wie bisher)');
    st.value = 'eve'; st.onchange(); await tick(50);
    assert(looks()[looks().length - 1] && looks()[looks().length - 1].eve, 'zurück auf Stil EVE');
    w.close();
    // CSS Menüs in der Seite
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve \.ov-ctx\{background:color-mix\(in srgb, var\(--bg\) 94%, #a0b0c8\);border:1px solid color-mix\(in srgb, var\(--text\) 16%, var\(--bg\)\);border-radius:0/.test(css), 'Rechtsklick-Menü in der Seite im Stil EVE');
    assert(/html\.ov-eve \.ov-mini\{background:color-mix\(in srgb, var\(--bg\) 94%, #a0b0c8\);[^}]*border-radius:0/.test(css), '⚙-Optionen im Stil EVE');
    console.log('\nALL AH1 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
