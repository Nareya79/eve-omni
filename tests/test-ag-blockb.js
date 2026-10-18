// AG Block B (18.10.2026): AG3 Symbolrahmen eckig im Stil EVE, AG2 Discord skaliert mit der Overlay-Skalierung + Strg + Mausrad (eigener Faktor).
// AG4 (Leuchten) prüft test-af-knoepfe.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve svg\.ic2 > rect\[rx="44"\]\{rx:0\}/.test(css), 'AG3: Symbolrahmen im Stil EVE eckig');
    // main.js
    assert(/'icColor', 'ovScale'/.test(main) && /if \('ovScale' in patch\)\{ S\.ovScale = Math\.max\(0\.6, Math\.min\(2, Number\(S\.ovScale\) \|\| 1\)\); dcZoom\(\); \}/.test(main), 'AG2: main.js nimmt ovScale (0,6–2) an und zoomt Discord');
    const i = main.indexOf('function dcZoom(){'), j = main.indexOf('const DC_WHEEL_JS');
    assert(i > 0 && j > i, 'AG2: dcZoom + dcZoomStep vorhanden');
    let zf = 1; const S = { ovScale: 1.5, windows: { discord: { zoom: 1.2 } } };
    const env = new Function('S', 'dview', 'dcSet', main.slice(i, j) + '\nreturn { dcZoom: dcZoom, dcZoomStep: dcZoomStep };')(S, { webContents: { getZoomFactor: () => zf, setZoomFactor: z => { zf = z; } } }, p => { S.windows.discord = Object.assign({}, S.windows.discord, p); });
    env.dcZoom(); assert(Math.abs(zf - 1.8) < 1e-9, 'Zoom = Overlay-Skalierung × eigener Faktor (1,5 × 1,2 = ' + zf + ')');
    env.dcZoomStep(1); assert(S.windows.discord.zoom === 1.3 && Math.abs(zf - 1.95) < 1e-9, 'Strg + Mausrad hoch: +0,1 (gemerkt)');
    for (let k = 0; k < 30; k++) env.dcZoomStep(-1); assert(S.windows.discord.zoom === 0.5, 'untere Grenze 0,5');
    assert(/wc\.on\('before-mouse-event'/.test(main) && /wc\.on\('console-message', \(e, a, b\) => \{ const m = \/\^__eozoom:\(-\?1\)\$\//.test(main) && /wc\.executeJavaScript\(DC_WHEEL_JS\)/.test(main), 'Strg + Mausrad auf zwei Wegen (Eingabe abfangen + Meldung der Seite)');
    // Seite meldet die Overlay-Skalierung ans Programm (nur Hauptfenster)
    const sent = [];
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
        w.evecoreHost = { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: p => { sent.push(p); return Promise.resolve(p); }, publishView(){}, onCommand(){}, ready(){} }; } }).window;
    await tick(600);
    const r = w.document.getElementById('ovs-scale'); r.value = '1.4'; r.oninput.call(r); await tick(30);
    assert(sent.some(p => p.ovScale === 1.4), 'Overlay-Skalierung 140 % geht ans Programm');
    const n = sent.filter(p => 'ovScale' in p).length; r.oninput.call(r); await tick(30);
    assert(sent.filter(p => 'ovScale' in p).length === n, 'gleicher Wert wird nicht doppelt geschickt');
    w.close();
    console.log('\nALL AG BLOCK B TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
