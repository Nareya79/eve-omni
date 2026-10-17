// Abschnitt K (Wuensche vom 24.09.2026, 4. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(ls){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); Object.keys(ls || {}).forEach(k => w.localStorage.setItem(k, ls[k])); } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // K2: Stationsname kopierbar (Platzhalter -> Kopier-Zelle)
    const box = d.createElement('div'); box.innerHTML = 'Verkauf: ' + T.stCp('Amarr VIII <Oris>'); T.stCpFix(box);
    assert(box.querySelector('.tsc-cp-b').getAttribute('data-copy') === 'Amarr VIII <Oris>', 'K2: Stationsname als Kopier-Knopf, Sonderzeichen bleiben');
    // K4: Schiff waehlen setzt Laderaum und wird mit allen Feldern gemerkt
    assert($('is-ship').value === 'auto', 'K5: Standard-Schiff = Automatisch');
    const bus = Array.from($('is-ship').options).find(o => /^Bustard/.test(o.textContent));
    bus.selected = true; $('is-ship').dispatchEvent(new w.Event('change', { bubbles: true })); await tick(200);
    assert(w.__sbCargoEff('is') === 55000 && /55\.000 m³/.test($('is-calc').textContent), 'K4: Bustard gewählt → gerechnet mit Laderaum 55.000 m³ (ohne Login Grundwert; 5.0 #3: Feld bleibt der getippte Wert)');
    $('is-budget').value = '777000000'; $('is-budget').dispatchEvent(new w.Event('change', { bubbles: true }));
    const saved = w.localStorage.getItem('eve-zentrale-hubhandel-v1');
    const sv = JSON.parse(saved);
    const typed = $('is-cargo').value;
    assert(/^Bustard/.test(sv.ship) && sv.cargo === typed && sv.budget === '777.000.000', 'K4: Schiff, eingetippter Laderaum und Budget gespeichert (5.0 #3: nicht der Schiffs-Laderaum)');
    w.close();
    w = makeWindow({ 'eve-zentrale-hubhandel-v1': saved }); await tick(600);
    d = w.document; $ = id => d.getElementById(id); T = w.__test;
    assert(/^Bustard/.test(T.isShipVal()) && w.__sbCargoEff('is') === 55000 && $('is-cargo').value === typed && $('is-budget').value === '777.000.000', 'K4: nach Neustart alles wieder da (gerechnet mit 55.000 m³)');
    // K5: kleinstes Schiff, in das die Ladung passt (R9: sonst Kaufvorschlag, sonst keins)
    const ships = [{ name: 'Tayra', cap: 30000 }, { name: 'Bustard', cap: 62000 }, { name: 'Charon', cap: 480000 }];
    assert(T.isSuggestShip(ships, [], 48000).name === 'Bustard', 'K5: 48.000 m³ → Bustard statt Charon');
    assert(T.isSuggestShip(ships, [], 900000) === null, 'K5/R9: passt in kein Schiff → kein Vorschlag');
    const buy = [{ name: 'Badger', cap: 4000, buy: true }, { name: 'Bustard', cap: 60000, buy: true }, { name: 'Obelisk', cap: 500000, buy: true }];
    assert(T.isSuggestShip(ships, buy, 48000).name === 'Bustard' && !T.isSuggestShip(ships, buy, 48000).buy, 'R9: eigenes Schiff im Hangar zuerst');
    assert(T.isSuggestShip([], buy, 3000).name === 'Badger' && T.isSuggestShip([], buy, 3000).buy, 'R9: ohne eigenes passendes → kleinstes Kaufschiff');
    assert(T.isSuggestShip(ships.slice(0, 1), buy, 480000).name === 'Obelisk', 'R9: Kaufvorschlag wenn eigene zu klein');
    // K6: Overlay zeigt alle Optionen mit Gewinn + Spruengen, Klick klappt eine auf
    const mk = (n, st, j) => ({ dst: { label: n + ' (X)', station: st, stationName: n + ' Station' }, profit: st * 1e6, spend: 1, volUsed: 1, strategy: 's', jumps: j,
      rows: [{ tid: 34, name: 'Ware' + st, q: 1, sp: 1, p: 1, totalVol: 1, avgBuy: 1, avgSell: 2 }] });
    const opts = [mk('Amarr', 3, 9), mk('Hek', 2, 19)];
    T.setOvData({ hub: Object.assign({ t: 5, src: { label: 'Jita (The Forge)', station: 1, stationName: 'Jita IV' }, cargo: 10, opts: opts, sel: -1 }, opts[0]) });
    let ob = d.createElement('div'); T.ovRenderViewInto('hubhandel', ob);
    assert(!/Ware3/.test(ob.textContent) && ob.querySelectorAll('.ov-opt.good').length === 1 && ob.querySelector('.ov-opt.good .pill'), 'R10: alle Optionen zu, Option 1 grün + „empfohlen“');
    T.ovSatAction('hubhandel', { type: 'hubSel', arg: '0' });
    ob = d.createElement('div'); T.ovRenderViewInto('hubhandel', ob);
    const hs = ob.querySelectorAll('.ov-opt-h');
    assert(hs.length === 2 && /Option 2:.*Sprünge: 19/.test(hs[1].textContent) && /Ware3/.test(ob.textContent) && !/Ware2/.test(ob.textContent), 'K6: zwei Optionen mit Sprüngen, nur die erste aufgeklappt');
    assert([].some.call(ob.querySelectorAll('.tsc-cp-b'), b => b.getAttribute('data-copy') === 'Amarr Station'), 'K2: Verkaufsstation im Overlay kopierbar');
    T.ovSatAction('hubhandel', { type: 'hubSel', arg: '1' });
    ob = d.createElement('div'); T.ovRenderViewInto('hubhandel', ob);
    assert(/Ware2/.test(ob.textContent) && !/Ware3/.test(ob.textContent) && T.getOvHub().dst.stationName === 'Hek Station', 'K6: Klick auf Option 2 klappt sie auf');
    assert(ob.querySelector('.ov-opt.good .ov-opt-h').getAttribute('aria-expanded') === 'false', 'R10: Option 1 bleibt grün, auch wenn Option 2 offen ist');
    T.ovSatAction('hubhandel', { type: 'hrAdd', arg: 'hub' });
    const runs = JSON.parse(w.localStorage.getItem('eve-zentrale-haulruns-v1'));
    assert(runs[0].toName === 'Hek Station', 'K6: „Lauf merken“ nimmt die aufgeklappte Option');
    // K7/S8: Trades-Overlay zeigt nur Trades; Lauf in „Verfolgt“, Klick klappt Details auf, „Erledigt“ nimmt ihn raus
    ob = d.createElement('div'); T.ovRenderViewInto('trades', ob);
    assert(!/Hek Station/.test(ob.textContent), 'S8: kein Lauf im Trades-Overlay');
    T.ovSatAction('track', { type: 'trkDet', arg: runs[0].id });
    ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
    const lv = ob.querySelector('[data-ova="trkFold"]').getAttribute('data-arg');
    assert(/Wird gekauft|Unterwegs|Problem|Läufe/.test(ob.textContent) && /Hek Station/.test(ob.textContent) && ob.querySelector('[data-ova="tk"][data-arg="done|Lauf:' + runs[0].id + '"]'), 'S8: Lauf-Details in „Verfolgt“ aufgeklappt');
    T.ovSatAction('track', { type: 'trkFold', arg: lv });
    ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
    assert(!/Hek Station/.test(ob.textContent), 'S8/Z9: Ebene zugeklappt');
    T.ovSatAction('track', { type: 'trkFold', arg: lv });
    T.ovSatAction('track', { type: 'tk', arg: 'done|Lauf:' + runs[0].id });
    ob = d.createElement('div'); T.ovRenderViewInto('track', ob);
    assert(!ob.querySelector('[data-ova="tk"][data-arg="done|Lauf:' + runs[0].id + '"]'), 'K7: erledigter Lauf ist nicht mehr aktiv');
    // K8: „Route“ im Overlay zeigt die Route im Navigations-Overlay (Modus Gates)
    let o = T.ovLoad(); o.navMode = 'jump'; o.views.forEach(v => { if (v.id === 'route') v.on = true; }); T.ovSave(o);
    T.ovShowRoute();
    assert(T.ovLoad().navMode === 'route' && T.ovLoad().view === 'route', 'K8: Navigations-Overlay mit Route vorne');
    // K9: Systemnamen-Vorschlaege
    w.localStorage.setItem('eve-zentrale-systemnames-v1', JSON.stringify({ names: ['Jita', 'Amarr'] }));
    const inp = d.createElement('input'); inp.setAttribute('list', 'ov-sysnames'); d.body.appendChild(inp);
    inp.dispatchEvent(new w.FocusEvent('focusin', { bubbles: true }));
    assert(d.querySelectorAll('#ov-sysnames option').length === 2, 'K9: Vorschlagsliste mit Systemnamen');
    w.close();
    // K11: Orders, Vertraege, Skills vom letzten Laden sofort nach dem Start sichtbar, mit „Stand“
    const lc = { orders: { t: Date.now() - 3600000, d: { a: [{ _charName: 'Taron', is_buy_order: true, _typeName: 'Tritanium', _locName: 'Jita', volume_remain: 5, volume_total: 10, price: 4, issued: '2026-09-20T10:00:00Z', duration: 90 }], h: [] } },
      contracts: { t: Date.now(), d: { a: [], h: [] } }, skills: { t: Date.now(), d: [{ id: '1', name: 'Selia', skills: { skills: [], total_sp: 5e6 }, queue: [] }] } };
    w = makeWindow({ 'eve-zentrale-listcache-v1': JSON.stringify(lc) }); await tick(900);
    d = w.document; $ = id => d.getElementById(id);
    assert(/Tritanium/.test($('or-active-body').textContent) && /^Stand .*zuletzt geladen/.test($('or-status').textContent), 'K11: Orders sofort da mit Stand: ' + $('or-status').textContent);
    assert(/Stand/.test($('ct-status').textContent), 'K11: Verträge mit Stand');
    assert(w.__test.lcAll().skills && /Stand/.test($('sq-status').textContent), 'K11: Skills mit Stand');
    // K14: eigene Sprungroute – A→C sind 12 LJ, Rhea mit JDC 5 = 10 LJ → 2 Spruenge, mit „Stationen“ ueber B statt D
    const S = { 1: ['Aa', 0, 0, 0, 0.3, 1], 2: ['Bb', 6, 0, 0, -0.2, 1], 3: ['Cc', 12, 0, 0, -0.5, 1], 4: ['Dd', 7, 0, 0, -0.1, 0] };
    const rhea = { range: 5, fuel: 10000, fuelType: 'Nitrogen Isotopes', jf: true };
    const jr = w.__test.jcPlan(S, ['Aa', 'Cc'], rhea, 5, 4, 4, [], true);
    assert(jr.hops.map(h => h.name).join() === 'Aa,Bb,Cc' && jr.range === 10 && jr.hops[1].fuel === 21600 && Math.abs(jr.totalLy - 12) < 1e-9, 'K14: 2 Sprünge über Station, Fuel 6 LJ × 3.600 = 21.600');
    assert(w.__test.jcPlan(S, ['Aa', 'Cc'], rhea, 5, 4, 4, ['Bb'], true).hops[1].name === 'Dd', 'K14: gemiedenes System wird umgangen');
    assert(/nicht Low- oder Nullsec/.test(w.__test.jcPlan(S, ['Jita', 'Cc'], rhea, 5, 4, 4, [], false).err), 'K14: Highsec-Start wird erklärt');
    assert(/Keine Sprungroute/.test(w.__test.jcPlan(S, ['Aa', 'Cc'], rhea, 0, 4, 4, [], false).err), 'K14: zu wenig Reichweite wird erklärt');
    console.log('ALL K TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); console.log('K TESTS FAILED'); process.exit(1); }
})();
