// AD (18.10.2026): aktives Overlay (zuletzt angeklickt) farbig markieren wie in EVE – main.js meldet „aktiv = id“ an alle Overlays,
// Overlay setzt html.ov-active, Einstellung „Aktives Overlay“ (full / bg / off) kommt über look.mark.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(url, host){
  return new JSDOM(html, { runScripts: 'dangerously', url, pretendToBeVisual: true,
    beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); if (host) w.evecoreHost = host; } }).window;
}
(async () => {
  try{
    // main.js: Fokus eines Overlays → „active“ an alle, OmniCom nie aktiv
    assert(/w\.on\('focus', \(\) => \{ satZTouch\(w\); satActiveSet\(w\); \}\)/.test(main), 'main.js: Fokus meldet das aktive Overlay');
    assert(/function satActiveSet\(w\)\{[^]*?id === 'neocom'\) return;[^]*?type: 'active', id/.test(main), 'main.js: OmniCom zählt nie als aktiv, alle Overlays bekommen „active“');

    // Hauptfenster: Einstellung + look.mark
    const S = { windows: { trades: { open: true } }, hotkeys: {}, hotkeyStatus: {}, backup: {} }, H = { pub: {} };
    const host = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))), setSettings: p => Promise.resolve(S),
      publishView: (id, data) => { H.pub[id] = data; }, onCommand(){}, ready(){} };
    let w = makeWindow('https://claude.ai/artifact/test', host);
    await tick(600);
    let d = w.document, $ = id => d.getElementById(id);
    assert($('ovs-mark') && $('ovs-mark').value === 'full', 'Einstellung „Aktives Overlay“ – Standard: farbig markieren');
    w.__test.ovPublishSatellites(); await tick(50);
    assert(H.pub.trades && H.pub.trades.look.mark === 'full', 'look.mark geht ans Overlay (full)');
    $('ovs-mark').value = 'bg'; $('ovs-mark').onchange(); await tick(80);
    assert(H.pub.trades.look.mark === 'bg', 'Umschalten auf „nur Hintergrund“ geht sofort ans Overlay');
    w.close();

    // Overlay-Fenster: data-ovmark + ov-active
    const SH = {};
    const shost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(){}, resizeTo(){}, resizeEnd(){} };
    w = makeWindow('https://claude.ai/artifact/test?fenster=trades', shost);
    await tick(400);
    d = w.document; const de = d.documentElement;
    SH.cmd({ type: 'view', data: { title: 'Trades', html: '<div>x</div>', foot: { age: '', next: '' }, look: { style: 'eve', mark: 'full' } } }); await tick(30);
    assert(de.getAttribute('data-ovmark') === 'full' && !de.classList.contains('ov-active'), 'Overlay startet nicht aktiv');
    SH.cmd({ type: 'active', id: 'trades' }); await tick(10);
    assert(de.classList.contains('ov-active'), 'eigenes Overlay angeklickt → aktiv');
    SH.cmd({ type: 'active', id: 'route' }); await tick(10);
    assert(!de.classList.contains('ov-active'), 'anderes Overlay angeklickt → nicht mehr aktiv');
    SH.cmd({ type: 'view', data: { title: 'Trades', html: '<div>x</div>', foot: { age: '', next: '' }, look: { style: 'eve', mark: 'off' } } }); await tick(30);
    assert(de.getAttribute('data-ovmark') === 'off', 'Einstellung „nicht markieren“ kommt im Overlay an');
    w.close();

    // CSS: Stil EVE Titelleiste + Kante, EVE Omni leuchtende Kante, „nur Hintergrund“ getönt; aus = keine Regel
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve\.ov-active\[data-ovmark="full"\] #ov-root > \.ov-bar\{background:linear-gradient\(color-mix\(in srgb, var\(--accent2\) 12%/.test(css) && /border-top-color:color-mix\(in srgb, var\(--accent2\) 65%/.test(css), 'Stil EVE wie im Spiel: Leiste im Thema getönt, Oberkante in Zweitfarbe mit Schein');
    assert(/html\.ov-eve\.ov-active\[data-ovmark="full"\]:not\(\.sat-neo\) #ov-root:has\(> \.ov-bar\) > :is\(\.ov-body, \.ov-foot\)\{background:color-mix/.test(css), 'Stil EVE: Inhalt im Thema getönt (inaktiv bleibt neutral grau)');
    assert(/var\(--bg\) 92%, #a0b0c8/.test(css) && /var\(--bg\) 97%, #a0b0c8/.test(css) && !/ov-active\[data-ovmark="full"\][^{]*\{[^}]*var\(--accent\) [37]%, var\(--bg\)/.test(css), 'Tönung aus der Grundfarbe des Themas (nicht aus dem Akzent – Amarr/Gallente/Minmatar)');
    assert(/html\.ov-omni\.ov-active\[data-ovmark="full"\] #ov-root\{border-color:var\(--accent\);box-shadow:inset/.test(css), 'Stil EVE Omni: leuchtende Kante');
    assert(/html\.ov-active\.ov-active\[data-ovmark="bg"\] #ov-root > :is\(\.ov-bar, \.ov-body, \.ov-foot\)\{background-image/.test(css), '„nur Hintergrund färben“: ganze Fläche getönt');
    assert(!/data-ovmark="off"\]/.test(css), '„nicht markieren“ = wie vorher (keine Regel)');
    console.log('\nALL AD TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
