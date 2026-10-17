// Abschnitt Z (Patch vor 3.0, 27.09.2026)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */ } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    // Z8: Seite im großen Fenster zählt nur als „offen“, wenn das Hauptfenster sichtbar ist
    const on = id => new RegExp('data-neo="' + id + '"[^>]*class="on').test(T.neoOverlayHtml());
    const sel = d.querySelector('.neo-btn[aria-selected="true"]').id.replace('neo-btn-', '');
    assert(on(sel), 'Z8: sichtbares Hauptfenster – offene Seite (' + sel + ') markiert');
    T.onHostCommand({ type: 'mainVis', on: false });
    assert(!on(sel), 'Z8: Hauptfenster versteckt/minimiert – nichts mehr als offen markiert');
    T.onHostCommand({ type: 'mainVis', on: true });
    assert(on(sel), 'Z8: wieder sichtbar – wieder markiert');
    // Z3: Stationsnamen wie im deutschen Client (Art übersetzt + *), Struktur unverändert, Korrektur hat Vorrang, Englisch = ESI-Name
    const cp = n => T.stCell(n).querySelector('.tsc-cp-b').getAttribute('data-copy');
    [['Amarr VIII (Oris) - Emperor Family Academy', 'Amarr VIII (Oris) - Emperor Family Akademie*'],
     ['Jita IV - Moon 4 - Caldari Navy Assembly Plant', 'Jita IV - Moon 4 - Caldari Navy Montagewerk*'],
     ['Hek VIII - Moon 12 - Boundless Creation Factory', 'Hek VIII - Moon 12 - Boundless Creation Fabrik*'],
     ['Rens VI - Moon 8 - Brutor Tribe Treasury', 'Rens VI - Moon 8 - Brutor Tribe Vermögensverwaltung*'],
     ['Dodixie IX - Moon 20 - Federation Navy Assembly Plant', 'Dodixie IX - Moon 20 - Federation Navy Montagewerk*']]
      .forEach(x => assert(cp(x[0]) === x[1], 'Z3: ' + x[1]));
    assert(cp('Jita IV - Moon 4 - Caldari Business Tribunal Law School') === 'Jita IV - Moon 4 - Caldari Business Tribunal Juristische Fakultät*', 'Z3: längste Art zuerst (Law School, nicht School)');
    assert(cp('1DQ1-A - 1-st Thetastar of Dickbutt Factory') === '1DQ1-A - 1-st Thetastar of Dickbutt Factory', 'Z3: Struktur unverändert');
    const unk = T.stCell('Jita IV - Moon 5 - Some Corp Weirdplace');
    assert(unk.classList.contains('st-unk') && /korrigieren/.test(unk.querySelector('.tsc-cp-b').title) && cp('Jita IV - Moon 5 - Some Corp Weirdplace') === 'Jita IV - Moon 5 - Some Corp Weirdplace', 'Z3: unbekannte Art = englisch + Hinweis');
    const c = T.stCell('Rens VI - Moon 8 - Brutor Tribe Treasury');
    assert(c.querySelector('[data-stdest]') && c.querySelector('[data-stfix]'), 'Z3: Knöpfe Ziel setzen + Namen korrigieren');
    T.ovSatAction('watchlist', { type: 'stFix', n: 'Rens VI - Moon 8 - Brutor Tribe Treasury', v: 'Rens VI - Mond 8 - Eigener Name' });
    assert(cp('Rens VI - Moon 8 - Brutor Tribe Treasury') === 'Rens VI - Mond 8 - Eigener Name', 'Z3: Korrektur (auch aus dem Overlay) hat Vorrang');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-stationnames-v1'))['Rens VI - Moon 8 - Brutor Tribe Treasury'], 'Z3: gespeichert unter eve-zentrale-stationnames-v1');
    T.ovSatAction('watchlist', { type: 'stFix', n: 'Rens VI - Moon 8 - Brutor Tribe Treasury', v: '' });
    assert(cp('Rens VI - Moon 8 - Brutor Tribe Treasury') === 'Rens VI - Moon 8 - Brutor Tribe Vermögensverwaltung*', 'Z3: leer = wieder automatisch');
    const cl = d.getElementById('set-clientlang'); cl.value = 'en'; cl.onchange();
    assert(cp('Jita IV - Moon 4 - Caldari Navy Assembly Plant') === 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', 'Z3: Client Englisch = ESI-Name ohne *');
    cl.value = 'de'; cl.onchange();
    // Namen korrigieren: Eingabefeld, Enter speichert
    const box = d.createElement('div'); d.body.appendChild(box); box.appendChild(T.stCell('Hek VIII - Moon 12 - Boundless Creation Factory'));
    box.querySelector('[data-stfix]').click();
    const inp = box.querySelector('.st-fix-in');
    assert(inp && inp.value === 'Hek VIII - Moon 12 - Boundless Creation Fabrik*', 'Z3: ✎ öffnet Eingabefeld mit dem EVE-Namen');
    inp.value = 'Hek Test'; inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' }));
    assert(box.querySelector('.tsc-cp-b').getAttribute('data-copy') === 'Hek Test', 'Z3: Enter speichert, Zelle neu');
    // Z4: Farben je Status, Nummern der laufenden, Uhrzeiten, erledigt-Minis, Blinken je Zustand, Farben einstellbar
    assert(T.tkStCls('wird verkauft', false) === ' st-sell' && T.tkStCls('verkauft', false) === ' st-done' && T.tkStCls('unterwegs', true) === ' st-bad', 'Z4: wird verkauft türkis, verkauft grün, Problem rot');
    const now = Date.now(), run = (id, cr, extra) => Object.assign({ id, fromName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', toName: 'Amarr VIII (Oris) - Emperor Family Academy', charId: 111, charName: 'Eins', created: cr, status: 'open',
      items: [{ tid: 34, name: 'Tritanium', q: 1000, sp: 5000, p: 1000 }] }, extra || {});
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([run('a', now - 3 * 3600e3), run('b', now - 1 * 3600e3), run('c', now - 2 * 3600e3),
      run('e', now - 86400e3, { status: 'done', doneAt: now - 30e3, res: -500000 })]));
    const all = T.trkAll(), nr = id => all.find(x => x.id === id).nr;
    assert(nr('a') === 1 && nr('c') === 2 && nr('b') === 3 && !nr('e'), 'Z4: laufende Aufträge nummeriert 1, 2, 3 (ältester zuerst), erledigte ohne Nummer');
    assert(all.find(x => x.id === 'e').st === ' st-done', 'Z4: erledigt = grüner Rahmen');
    // Ware vergessen: Einkauf fertig, eine Ware gar nicht gekauft → rot
    const g = { phase: 'unterwegs', forecast: 100, items: { 34: { q: 10, b: 10 }, 35: { q: 5, b: 0 } } };
    assert(T.hrBad({}, g) && !T.hrBad({}, Object.assign({}, g, { items: { 34: { q: 10, b: 10 } } })), 'Z4: Ware vergessen = rot');
    assert(T.hrBad({}, { phase: 'wird verkauft', forecast: -1, items: {} }) && !T.hrBad({}, { phase: 'wird gekauft', forecast: null, items: { 35: { q: 5, b: 0 } } }), 'Z4: Minus-ISK = rot, beim Einkauf noch nicht');
    // SS9: Verlust im Direktverkauf nur gelb (Ebene „Problem“), nicht rot
    const vcR = { vc: { w: [{ red: true }] } };
    assert(T.vcRed(vcR) && !T.hrBad(vcR, { phase: 'unterwegs', forecast: 100, items: {} }), 'SS9: Direktverkauf-Verlust allein = nicht rot');
    const wx = { kind: 'Lauf', state: 'active', warn: true, st: ' st-way' };
    assert(T.trkOb(wx) && T.trkLv(wx) === 'bad' && !T.trkOb(Object.assign({}, wx, { warn: false })), 'SS9: Lauf mit Direktverkauf-Verlust = gelb, Ebene „Problem“');
    let tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert([...tb.querySelectorAll('.trk-nr')].map(e => e.textContent).sort().join(',') === '1,2,3', 'Z4: Nummern im Overlay');
    T.ovSatAction('track', { type: 'trkOv', arg: 'done' }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    const dc = tb.querySelector('.trk-sm');
    assert(dc.classList.contains('st-done') && dc.classList.contains('dn-neg') && dc.classList.contains('st-flash') && dc.querySelector('.ov-bar-mini.dn'), 'Z4: erledigte Mini mit Minus: roter Balken, gerade erledigt = leuchtet kurz');
    assert(/angenommen \d\d\.\d\d\., \d\d:\d\d · abgeschlossen \d\d\.\d\d\., \d\d:\d\d/.test(dc.title), 'Z4: Uhrzeit angenommen + abgeschlossen: ' + dc.title.split('\n')[0]);
    T.ovSatAction('track', { type: 'trkOv', arg: 'active' });
    // Blinken je Zustand: Standard nur überboten/Problem; „unterwegs“ einschalten
    T.ovSatAction('track', { type: 'blinkOpen' }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('[data-ova="blinkSt"]').length === 6 && !tb.querySelector('.trk-sm.blk'), 'Z4: ⚙ zeigt 6 Zustände, Standard: normale Karten blinken nicht');
    const ph = T.trkAll().find(x => x.id === 'a').st.trim().replace('st-', '');
    T.ovSatAction('track', { type: 'blinkSt', arg: 'watch:' + ph }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.trk-sm.blk').length === 3, 'Z4: Zustand „' + ph + '“ eingeschaltet → blinkt');
    T.ovSatAction('track', { type: 'blinkSt', arg: 'watch:' + ph }); T.ovSatAction('track', { type: 'blinkOpen' });
    // Farben einstellbar → CSS-Variablen im Hauptfenster und im Overlay-Inhalt
    const cb = d.getElementById('ovs-col-way'); cb.value = '#123456'; cb.onchange();
    assert(/--st-way:#123456/.test(d.getElementById('st-col').textContent), 'Z4: Farbe im Hauptfenster');
    tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(/--st-way:#123456/.test(tb.querySelector('style').textContent), 'Z4: Farbe auch im Overlay');
    d.getElementById('ovs-col-reset').click();
    assert(T.stColCss() === '', 'Z4: Standard-Farben zurück');
    w.localStorage.removeItem('eve-zentrale-haulruns-v1');
    // Z9: Ebenen nach Status, Läufe + Trades gemischt, Kopf mit Anzahl + netto, zu/auf gemerkt (Hauptfenster und Overlay getrennt)
    w.localStorage.setItem('eve-zentrale-trkgroup-v1', 'status');   // Z9 prüft die Status-Gruppen (Standard seit BB19: nach Art)
    const L = (st, extra) => Object.assign({ kind: 'Lauf', id: st + Math.random(), name: 'x', state: 'active', st: ' st-' + st, t: 1, res: 10 }, extra || {});
    const lv = T.trkLevels([L('sell'), L('bad', { res: -5 }), L('buy', { kind: 'Trade' }), L('buy'), L('done', { state: 'done' }), L('x', { state: 'cancelled', st: '' })]);
    assert(lv.map(l => l.k).join() === 'bad,buy,sell,done,cancel' && lv[1].list.length === 2, 'Z9: Reihenfolge Problem → gekauft → (leeres Unterwegs aus) → verkauft → erledigt, gemischt');
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([run('a', now - 3 * 3600e3), run('b', now - 3600e3)]));
    d.querySelector('[data-trk="active"]').click();
    let hd = d.querySelector('#trk-body .trk-g');
    assert(/Wird gekauft 2/.test(hd.textContent) && /netto/.test(hd.textContent) && d.querySelector('#trk-body [data-sort-sel="track"]'), 'Z9: Kopfzeile „Wird gekauft 2 · netto“, Sortierung im Hauptfenster');
    hd.querySelector('button').click();
    assert(!d.querySelector('#trk-body .trk-sm') && JSON.parse(w.localStorage.getItem('eve-zentrale-trkfold-v1')).buy, 'Z9: Ebene zu, gemerkt');
    tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert(tb.querySelectorAll('.trk-sm').length === 2 && tb.querySelector('.sort-bar[data-sort="track"]'), 'Z9: Overlay merkt getrennt (dort noch offen), mit Sortierung');
    T.ovSatAction('track', { type: 'sort', arg: 'track:t' }); tb = d.createElement('div'); T.ovRenderViewInto('track', tb);
    assert([...tb.querySelectorAll('.trk-nr')].map(e => e.textContent).join() === '2,1', 'Z9: Sortierung umgedreht → 2, 1');
    T.ovSatAction('track', { type: 'sort', arg: 'track:t' });
    d.querySelector('#trk-body .trk-g button').click();
    w.localStorage.removeItem('eve-zentrale-haulruns-v1');
    console.log('\nALL Z TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
