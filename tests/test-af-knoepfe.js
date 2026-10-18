// AF2 + AF3 (18.10.2026): Stil EVE – Knöpfe (Zweit/Haupt/Dritt), Reiter mit Unterstrich, Karten ohne Rahmen, OmniCom-Kacheln wie das EVE-Neocom
// (offen = Kante in Symbolfarbe, zuletzt angeklicktes Overlay = weiß über data-view).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/html\.ov-eve\.ov-eve :is\(\.btn, #ov-root \.btn,[^)]*\.ovn-pref > button[^)]*\)\{background:color-mix\(in srgb, var\(--accent\) 18%, transparent\);border:1px solid color-mix\(in srgb, var\(--accent\) 50%/.test(css), 'Zweitknopf: Akzent leicht getönt + gedämpfte Akzentkante (Hauptfenster + Overlays)');
    assert(/html\.ov-eve\.ov-eve :is\(\.btn\.go, #ov-root \.btn\.go\)\{background:color-mix\(in srgb, var\(--accent\) 38%, transparent\);border-color:var\(--accent\);/.test(css), 'Hauptknopf: Akzent halbdeckend + Kante ringsum Akzent (AG4)');
    assert(/html\.ov-eve\.ov-eve :is\(\.btn\.ghost, #ov-root \.btn\.ghost\)\{background:rgba\(255,255,255,\.02\);border-color:color-mix\(in srgb, var\(--accent\) 38%/.test(css), 'Drittknopf: fast durchsichtig, Kante in Akzent (AG4)');
    assert(/:hover:not\(:disabled\)\{background:color-mix\(in srgb, var\(--accent\) 40%, transparent\);border-color:color-mix\(in srgb, var\(--accent\) 75%, #fff\);color:#fff;box-shadow:0 0 6px/.test(css) && /html\.ov-omni\.ov-omni :is\(\.btn,[^{]*:hover:not\(:disabled\)\{box-shadow:0 0 8px/.test(css), 'AG4: Leuchten unter der Maus in beiden Stilen');
    assert(/html\.ov-eve :is\(\.tab-btn, \.subtabs \.tab-btn\)\{background:none;border:0;border-bottom:2px solid transparent/.test(css) && /html\.ov-eve :is\(\.tab-btn, \.subtabs \.tab-btn\)\[aria-selected="true"\]\{color:#fff;background:none;border-bottom-color/.test(css), 'Reiter als Text mit Unterstrich statt Kasten');
    assert(/body:not\(\.ov-mode\) :is\(\.tr-card,[^)]*\)\{border-color:transparent;border-top-color:rgba\(255,255,255,\.07\)\}/.test(css), 'Karten ohne Rahmen, nur schwache Linie oben');
    // OmniCom: AF3-Regeln stehen NACH der alten A2-Regel (sonst bleibt „offen = weiß“)
    const a2 = css.indexOf('html.ov-eve .neo-ov button.on{background:rgba(255,255,255,.12)'), af3 = css.indexOf('html.ov-eve .neo-ov button.on{background:color-mix(in srgb, var(--nc');
    assert(a2 > 0 && af3 > a2 && /border-color:color-mix\(in srgb, var\(--nc, var\(--accent\)\) 70%, transparent\);box-shadow:none/.test(css), 'OmniCom offen = Kante in Symbolfarbe (ersetzt A2 weiß)');
    assert(/data-neo="' \+ id \+ '" data-view="' \+ \(v \|\| ""\) \+ '"/.test(html), 'OmniCom-Kachel trägt die Overlay-Kennung (data-view)');

    // Overlay-Fenster „neocom“: Befehl active → weiße Kante nur für die Kachel des aktiven Overlays
    const SH = {};
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=neocom', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
        w.evecoreHost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(){}, resizeTo(){}, resizeEnd(){}, satMenu(){} }; } }).window;
    await tick(400);
    SH.cmd({ type: 'active', id: 'route' }); await tick(10);
    const st = w.document.getElementById('neo-act-css');
    assert(st && st.textContent.indexOf('.neo-ov button.on[data-view="route"]{border-color:#fff') > 0 && /:not\(\[data-ovmark="off"\]\)/.test(st.textContent), 'aktives Overlay „route“ → weiße Kachel (nicht bei „nicht markieren“)');
    SH.cmd({ type: 'active', id: 'x"]{}*{color:red' }); await tick(10);
    assert(/data-view="xcolorred"/.test(w.document.getElementById('neo-act-css').textContent), 'Kennung wird für CSS gesäubert');
    w.close();
    console.log('\nALL AF TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
