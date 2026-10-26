// AL Block D (19.10.2026): Kurier mit Region + „ab hier“ des Piloten, eigener Bereich Fittings (Meine Fittings + Workbench, vorher unter Assets),
// Industrie › Mining Ledger → Verweis aufs Mining-Tagebuch, PI mit Bildern (Planetenart + Anlage), Meine Läufe wie Meine Trades (Nutzer).
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try{
    // Kurier
    assert(/var pSys0 = await coPilotSys\(pilot\);[^\n]*\n\s*if \(pSys0\)\{[^\n]*regs\.unshift\(pr\.r\)/.test(html), 'Kurier: Region des Piloten wird mit durchsucht');
    assert(/if \(d\.here && L\.psys && \(L\.pst \? r\.fl !== L\.pst : r\.fs !== L\.psys\)\) return false;/.test(html) && /data-arg="here"[^>]*>ab hier</.test(html) && /"ab hier": "from here"/.test(html), 'Kurier: Filter „ab hier“ (Station angedockt, sonst System)');
    // PI
    assert(/var PI_PLANET_TID = \{ temperate: 11, ice: 12, gas: 13, oceanic: 2014, lava: 2015, barren: 2016, storm: 2017, plasma: 2063 \};/.test(html), 'PI: Typ-ID je Planetenart');
    assert(/"<h4>" \+ piPlanetImg\(pl, 32\)/.test(html) && /piImg\(e\.tid, 22\) \+ "Extraktor:/.test(html) && /piImg\(s\.tid, 22\) \+ escapeHtml\(s\.name\)/.test(html) && /piPlanetImg\(it\.pl, 26\)/.test(html), 'PI: Bilder für Planet, Extraktor, Lager (Seite + Overlay)');
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-lang-v1', 'de'); } }).window;
    await tick(800);
    const d = w.document, $ = id => d.getElementById(id);
    // Fittings
    $('neo-btn-fits').click(); await tick(100);
    assert($('panel-fits').classList.contains('active') && $('sec-title').textContent === 'Fittings', 'Fittings ist ein eigener Bereich');
    assert($('neo-btn-fits').querySelector('svg.ic2') && html.includes('// AL9: Fittings – Rumpf mit Modul-Steckplätzen'), 'Fittings hat ein Symbol im Neocom (Nutzer: fehlte)');
    assert(![...d.querySelectorAll('#neocom .neo-btn')].some(b => !b.querySelector('svg.ic2')), 'kein Neocom-Knopf ohne Symbol');
    const tabs = [...$('fits-page').querySelectorAll('.subtabs [data-ova="fitTab"]')];
    assert(tabs.map(b => b.textContent).join() === 'Meine Fittings,Workbench' && tabs[0].getAttribute('aria-selected') === 'true', 'Reiter Meine Fittings · Workbench (gleiche Reiter wie Trading/Hauling)');
    tabs[1].click(); await tick(100);
    assert(/Workbench/.test($('fits-page').textContent) && $('fits-page').querySelector('[data-ova="fitTab"][data-arg="wb"]').getAttribute('aria-selected') === 'true', 'Workbench-Reiter');
    $('neo-btn-assets').click(); await tick(100);
    assert(![...$('as-body').querySelectorAll('[data-ova="asTab"]')].some(b => /Fittings|Workbench/.test(b.textContent)), 'Assets ohne Fittings/Workbench');
    assert(/"besitz", "Besitz", \["wallet", "assets", "fits", "industry", "mining"\]/.test(html) && /workbench: \["fits"\], fits: \["fits"\]/.test(html), 'OmniCom-Gruppe Besitz + Workbench-Overlay groß → Fittings');
    // Mining Ledger → Tagebuch
    $('neo-btn-industry').click(); await tick(50);
    $('in-view-mining').click(); await tick(100);
    assert($('panel-mining').classList.contains('active') && JSON.parse(w.localStorage.getItem('eve-zentrale-mining-v1') || '{}').view === 'log', 'Industrie › Mining-Tagebuch → öffnet Mining › Tagebuch');
    // Meine Läufe
    assert(/var hrView = "active", hrFold = \{\};/.test(html) && /id="hr-tabs"><button class="tab-btn" data-hrv="active"[^>]*>Laufend<\/button><button[^>]*data-hrv="done"[^>]*>Erledigt<\/button><button[^>]*data-hrv="cancelled"[^>]*>Abgebrochen</.test(html) && /return hrFold\[k\] \? trkRow\(x\) : '<div class="tc-main" data-hr-card="' \+ escapeHtml\(k\) \+ '" data-tc-main="' \+ escapeHtml\(k\) \+ '"><\/div>';/.test(html) && /tcMount\(box, list, function\(k\)\{ hrFold\[k\] = true; hrRender\(\); \}\);/.test(html), 'Meine Läufe wie Meine Trades: Reiter Laufend · Erledigt · Abgebrochen, große Karten, zuklappbar');
    assert(/function trkOb\(x\)\{ return x\.state === "active" && /.test(html) && /\.ov-card\.trk-run:is\(\.st-buy,\.st-way,\.st-sell,\.st-bad\)\{background-image:/.test(html), 'erledigte/abgebrochene Läufe nicht gelb (Nutzer)');
    assert(/html:not\(\[data-scheme="light"\]\) body:not\(\.ov-mode\)\{--profit:#3ee07c;--loss:#ff5252\}/.test(html), 'Grün/Rot im Hauptfenster kräftiger (Nutzer)');
    ['"Meine Fittings": "My fittings"', '"Mining-Tagebuch →": "Mining log →"', '"Keine abgebrochenen Läufe.": "No cancelled runs."'].forEach(t => assert(html.includes(t), 'EN ' + t.split(':')[0]));
    console.log('\nALL AL BLOCK D TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
