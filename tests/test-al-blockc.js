// AL Block C (19.10.2026): Hauling wie Trading – Reiter Läufe suchen · Ergebnisse · Meine Läufe (beide Arten), Ergebnisse als Karten wie im Overlay,
// Trading mit Reiter „Ergebnisse“ (Einstellungen und Vorschläge getrennt), Suche springt zu den Ergebnissen, Knopf „Trades scannen“.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try{
    assert((html.match(/<div class="subtabs hl-vtabs al-nav" role="tablist"><button[^>]*data-hlv="search"[^>]*>Läufe suchen<\/button><button[^>]*data-hlv="res"[^>]*>Ergebnisse<\/button><button[^>]*data-hlv="runs"[^>]*>Meine Läufe<\/button><button[^>]*data-hlv="pnl"[^>]*>Gewinne<\/button><\/div>/g) || []).length === 2, 'Reiter in beiden Hauling-Arten (mit Gewinne)');
    assert(/id="tsc-view-res"[^>]*>Ergebnisse</.test(html) && /id="tsc-start" type="button">Trades scannen</.test(html), 'Trading: Reiter Ergebnisse, Knopf „Trades scannen“ (Nutzer)');
    assert(/try\{ if \(key === "tsc"\) tscShowView\("res"\); else if \(key === "hl" \|\| key === "is"\) hlView\("res"\); \}catch\(e\)\{\}/.test(html), 'Suche startet → Ergebnisse');
    assert(/ovFormWire\(box, function\(a\)\{ ovSatAction\("handel", a\); \}\)/.test(html) && /if \(id === "hl-cards"\) ovRenderHauling\(box\); else ovRenderHub\(box\);/.test(html), 'Karten wie im Overlay, Klicks wie im Overlay');
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-lang-v1', 'de'); } }).window;
    await tick(800);
    const d = w.document, $ = id => d.getElementById(id);
    d.getElementById('neo-btn-haul').click(); await tick(50);
    const pn = d.querySelector('#panel-haul.active, #panel-intensiv.active');
    assert(pn && pn.getAttribute('data-hlv') === 'search', 'Start: Läufe suchen');
    pn.querySelector('.hl-vtabs [data-hlv="res"]').click(); await tick(50);
    assert($('panel-haul').getAttribute('data-hlv') === 'res' && $('panel-intensiv').getAttribute('data-hlv') === 'res' && w.localStorage.getItem('eve-zentrale-haul-view-v1') === 'res', 'Ergebnisse gilt für beide Arten und wird gemerkt');
    const box = pn.querySelector('.hl-cards');
    assert(box && /Noch keine Ergebnisse\. Unter „Läufe suchen“/.test(box.textContent), 'Ergebnisse ohne Suche: Hinweis auf „Läufe suchen“');
    pn.querySelector('.hl-vtabs [data-hlv="runs"]').click(); await tick(50);
    assert($('hr-box').open === true && pn.querySelector('[data-hlv="runs"]').getAttribute('aria-selected') === 'true', 'Meine Läufe: Liste offen');
    assert($('hr-box').querySelector('#hr-tabs [data-hrv="active"]') && $('hr-box').querySelector('.controls #hr-refresh') && $('hr-list').classList.contains('tr-grid'), 'Meine Läufe aufgebaut wie Meine Trades (Reiter links, Aktualisieren rechts, Karten-Raster)');
    assert(pn.contains($('tro-box')) && pn.querySelector('.hl-top .tsc-charbar'), 'Übersicht „Laufend“ + Handelscharakter stehen auch bei Hauling (wie Trading)');
    pn.querySelector('.hl-vtabs [data-hlv="pnl"]').click(); await tick(50);
    assert(pn.getAttribute('data-hlv') === 'pnl' && pn.querySelector('.hl-pnl .stat-row') && /Noch kein Lauf erledigt|In diesem Zeitraum/.test(pn.querySelector('.hl-pnl').textContent), 'Hauling › Gewinne (wie Trading › Gewinne, Nutzer)');
    pn.querySelector('.hl-vtabs [data-hlv="search"]').click(); await tick(50);
    d.getElementById('neo-btn-station').click(); await tick(50);
    assert($('panel-station').contains($('tro-box')) && $('panel-station').querySelector('.tsc-topbar .tsc-charbar'), 'zurück bei Trading: Übersicht + Charakter wieder dort');
    d.getElementById('neo-btn-haul').click(); await tick(50);
    d.getElementById('neo-btn-station').click(); await tick(50);
    $('tsc-view-res').click(); await tick(30);
    assert($('tsc-scan-view').getAttribute('data-part') === 'res' && !$('tsc-scan-view').hidden && $('tsc-view-res').getAttribute('aria-selected') === 'true', 'Trading › Ergebnisse');
    $('tsc-view-scan').click(); await tick(30);
    assert($('tsc-scan-view').getAttribute('data-part') === 'search', 'Trading › Trades scannen');
    const css = html.slice(0, html.indexOf('</style>'));
    assert(/#tsc-scan-view\[data-part="search"\] > :is\(#tsc-summary, #tsc-result-wrap, #tsc-orders-wrap, #tsc-res-empty\)\{display:none !important\}/.test(css) && /\[data-hlv="res"\] > :not\(\.hl-top\):not\(#tro-box\):not\(\.status-line\):not\(\.hl-cards\):not\(#hl-shiprec-card\)\{display:none\}/.test(css), 'CSS trennt Einstellungen und Ergebnisse');
    ['"Läufe suchen": "Find runs"', '"Meine Läufe": "My runs"', '"Ergebnisse": "Results"', '"Trades scannen": "Scan trades"'].forEach(t => assert(html.includes(t), 'EN ' + t.split(':')[0]));
    console.log('\nALL AL BLOCK C TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
