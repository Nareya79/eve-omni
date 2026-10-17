// DD3 (02.10.2026): PI-Planer – Übersicht Planet → P0 → P4 mit Linien, Kette per Klick, Planer (Mengen/Fabriken/Planeten), Overlay + OmniCom
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const mainJs = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const view = () => { const b = d.createElement('div'); T.ovRenderViewInto('piplan', b); return b; };
    let b = view();
    assert(b.querySelectorAll('.pp-c').length === 8 + 15 + 15 + 24 + 21 + 8, 'DD3: 8 Planetentypen + 15 P0 + 15 P1 + 24 P2 + 21 P3 + 8 P4');
    assert(b.querySelectorAll('.pp-l').length > 150 && /:has\(\.pp-c2867:hover\) \.pp-l2867/.test(b.innerHTML), 'DD3: Linien + Hover-Regel je Ware');
    T.ovSatAction('piplan', { type: 'ppSel', arg: '3645' }); b = view();   // Water (P1) = 3000 Aqueous Liquids / 30 Min. → 40 Stück
    assert(b.querySelector('.pp-c3645.sel') && b.querySelector('.pp-c2268.on') && b.querySelector('.pp-cp13.on') && b.querySelector('.pp-c2073.dim'), 'DD3: Klick hält Kette fest (Zutat, Planet), Rest blass');
    const rows = [...b.querySelectorAll('.pp-r:not(.pp-hd)')].map(r => r.textContent);
    assert(rows.length === 2 && /Water40/.test(rows[0].replace(/\s/g, '')) && /Aqueous Liquids6\.000Extraktor/.test(rows[1].replace(/P0\s*/, '')), 'DD3: Planer – 40 Water/Std. aus 6.000 P0/Std.');
    assert(/alles auf einem Planeten möglich/.test(b.textContent) && /Gemäßigt/.test(b.textContent), 'DD3: passende Planetentypen');
    T.ovSatAction('piplan', { type: 'ppSel', arg: 'p2015' }); b = view();
    assert(/Lava \(Lava\)/.test(b.textContent) && /P1 nur von diesem Planeten/.test(b.textContent), 'DD3: Planet gewählt → P0 + P1 dieses Planeten');
    T.ovSatAction('piplan', { type: 'ppSel', arg: 'p2015' }); b = view();
    assert(!b.querySelector('.pp-c.dim'), 'DD3: zweiter Klick hebt Auswahl auf');
    // Hauptfenster: Charaktere › PI-Planer; OmniCom-Symbol; Programm kennt das Fenster
    d.getElementById('ch-sub-pp').click(); await tick(50);
    assert(d.querySelectorAll('#pp-page .pp-c').length === 91, 'DD3: Seite Charaktere › PI-Planer');
    assert(/data-neo="piplan"/.test(T.neoOverlayHtml()), 'DD3: OmniCom-Overlay-Symbol „PI-Planer“');
    assert(/piplan: 'PI-Planer'/.test(mainJs), 'DD3: Overlay-Fenster im Programm');
    console.log('\nALL DD3 TESTS PASSED'); process.exit(0);
  }catch(e){ console.log(e.message); process.exit(1); }
})();
