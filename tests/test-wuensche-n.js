// Abschnitt N (Wuensche vom 24.09.2026, 7. Liste): N4 OmniCom-Rahmen, N6 Assets-Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const AS = { v: true, g: [
  { cid: '111', name: 'Eins', locs: [{ id: '60003760', name: 'Jita IV - Caldari Navy', sys: 30000142, rows: [{ tid: 34, name: 'Tritanium', qty: 1000, estValue: 4000 }, { tid: 587, name: 'Rifter', qty: 1, estValue: 500000 }] }] },
  { cid: '222', name: 'Zwei', locs: [{ id: '60003760', name: 'Jita IV - Caldari Navy', sys: 30000142, rows: [{ tid: 34, name: 'Tritanium', qty: 500, estValue: 2000 }] },
                                     { id: '60008494', name: 'Amarr VIII', sys: 30002187, rows: [{ tid: 35, name: 'Pyerite', qty: 10, estValue: 100 }] }] }] };
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */
    w.localStorage.setItem('eve-zentrale-listcache-v1', JSON.stringify({ assets: { t: Date.now(), d: AS } })); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, T = w.__test;
    // N4: OmniCom-Knoepfe tragen ihre Symbolfarbe als Rahmenfarbe
    assert(d.getElementById('neo-btn-wallet').style.getPropertyValue('--nc') === '#ffe29a', 'N4: Hauptleiste – Rahmenfarbe = Symbolfarbe');
    assert(/data-neo="wallet"[^>]*style="--nc:#ffe29a"/.test(T.neoOverlayHtml()), 'N4: OmniCom-Overlay – Rahmenfarbe = Symbolfarbe');
    // X3: Uhr oben im OmniCom-Overlay, Klick schaltet Ortszeit → EVE-Zeit → beides, „aus“ blendet sie aus
    const ck = () => T.neoOverlayHtml().match(/data-neo="clock"[^>]*data-tz="(\w+)"/);
    assert(ck() && ck()[1] === 'local' && T.neoOverlayHtml().indexOf('data-neo="clock"') < T.neoOverlayHtml().indexOf('data-neo="wallet"'), 'X3: Uhr (Ortszeit) steht oben');
    T.neoOverlayAction('clock'); assert(ck()[1] === 'eve' && /\d\d:\d\d<\/span><span class="clk e">EVE</.test(T.neoOverlayHtml()), 'X3: Klick → EVE-Zeit');
    T.neoOverlayAction('clock'); assert(ck()[1] === 'both' && /clk e/.test(T.neoOverlayHtml()), 'X3: Klick → beides');
    // Y13: Uhrfarbe aus den Einstellungen (Vorlage oder eigene), Standard = ohne Farbe
    const cs = d.getElementById('neo-clock-col'), cc = d.getElementById('neo-clock-cc');
    assert(cs && cs.options.length === 12 && cs.options[0].value === '', 'Y13: Uhrfarbe Standard + 10 Vorlagen + eigene');   // UU4: Standard = Farbe des Farbschemas (nicht mehr ohne Farbe)
    cs.value = '#4dffa3'; cs.onchange(); assert(/class="neo-clk col" style="--nc:#4dffa3;--clk:#4dffa3"/.test(T.neoOverlayHtml()), 'Y13: Vorlage färbt Uhr und Rahmen');
    cc.value = '#123456'; cc.oninput(); assert(cs.value === 'own' && /--clk:#123456/.test(T.neoOverlayHtml()), 'Y13: eigene Farbe');
    cs.value = ''; cs.onchange(); assert(!JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1') || '{}').neoClockCol, 'Y13: zurück auf Standard (UU4: Farbe kommt dann aus dem Farbschema)');
    const o = T.ovLoad(); o.neoClock = 'off'; w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify(o)); assert(!ck(), 'X3: „aus“ blendet die Uhr aus');
    // N6: Assets-Overlay
    const render = () => { const b = d.createElement('div'); T.ovRenderViewInto('assets', b); return b; };
    let b = render();
    const loc = re => [...b.querySelectorAll('.as-loc')].find(x => re.test(x.textContent));
    assert(b.querySelectorAll('.as-loc').length === 2 && loc(/Jita IV/) && /2<\/b> Orte/.test(b.innerHTML), 'N6/Q10: alle Charaktere, nach Ort');
    T.ovSatAction('assets', { type: 'asLoc', arg: '60003760' }); b = render();
    const rows = loc(/Jita IV/).querySelectorAll('.as-i');
    assert(rows.length === 2 && /Rifter/.test(rows[0].textContent) && /types\/587\/icon/.test(rows[0].querySelector('img').src), 'N6: Station aufgeklappt, Item-Icon');
    assert(/1\.500×/.test(rows[1].textContent), 'N6: bei „Alle“ werden gleiche Artikel addiert: ' + rows[1].textContent);
    // Q10: Reiter Besitzer – Kacheln, Mehrfachauswahl
    T.ovSatAction('assets', { type: 'asTab', arg: 'own' }); b = render();
    assert(b.querySelectorAll('.as-own .as-t').length === 3 && /characters\/111\/portrait/.test(b.querySelector('.as-own img').src) && b.querySelector('.as-t.on').getAttribute('data-arg') === 'all', 'Q10: Besitzer-Kacheln mit Porträt, „Alle“ gewählt');
    assert(/1\.001 Items/.test(b.querySelectorAll('.as-t')[1].textContent), 'Q10: Kachel zeigt Anzahl Items: ' + b.querySelectorAll('.as-t')[1].textContent);
    T.ovSatAction('assets', { type: 'asOwn', arg: '222' }); b = render();
    assert(b.querySelector('.as-t.on').getAttribute('data-arg') === '222' && /Besitzer \(1\)/.test(b.textContent), 'Q10: ein Besitzer gewählt');
    T.ovSatAction('assets', { type: 'asOwn', arg: '111' }); b = render();
    assert(b.querySelectorAll('.as-t.on').length === 2, 'Q10: Mehrfachauswahl');
    T.ovSatAction('assets', { type: 'asOwn', arg: '111' }); T.ovSatAction('assets', { type: 'asTab', arg: 'as' }); b = render();
    assert(/2<\/b> Orte/.test(b.innerHTML) && !/Rifter/.test(b.textContent), 'N6: nur ein Charakter');
    T.ovSatAction('assets', { type: 'asOwn', arg: 'all' });
    T.ovSatAction('assets', { type: 'asSort', arg: 'name' }); b = render();
    assert(/Amarr VIII/.test(b.querySelector('.as-loc').textContent), 'Q10: nach Name sortiert');
    T.ovSatAction('assets', { type: 'asSort', arg: 'isk' }); b = render();
    assert(/Jita IV/.test(b.querySelector('.as-loc').textContent) && b.querySelector('.as-loc .sec') && b.querySelector('.as-hd'), 'Q10: nach ISK sortiert, Spalten mit Sicherheit');
    T.ovSatAction('assets', { type: 'asFind', form: { q: 'pyer' } }); b = render();
    assert(/1<\/b> Orte/.test(b.innerHTML) && /Amarr VIII/.test(b.textContent) && /Pyerite/.test(b.textContent), 'N6: Suche findet Artikel und klappt auf');
    assert(b.querySelector('[data-ovf="q"]').value === 'pyer', 'N6: Suchbegriff bleibt im Feld');
    console.log('\nALL WUENSCHE-N TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
