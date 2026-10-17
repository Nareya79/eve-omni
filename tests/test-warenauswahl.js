// B2: Warenauswahl nach moeglichem Gewinn, der in Budget + Laderaum passt; ganze Orderbuecher statt Einzelabfragen;
// verpacktes Volumen, dauerhaft gespeichert (eve-zentrale-typevol-v1). B4: max. m³ je Stueck. B5: Kopier-Knoepfe.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const AMARR = 60008494, JITA = 60003760;
const ok = d => Promise.resolve({ ok: true, headers: { get: () => '1' }, json: () => Promise.resolve(d) });
// 1 = gross (1000 m³ verpackt, 5000 aufgebaut), viel Gewinn je Stueck; 2 = klein und dicht; 3 = ohne Gewinn
const TYPES = { 1: { name: 'Grosses Ding', volume: 5000, packaged_volume: 1000 }, 2: { name: 'Kleinkram', volume: 1 }, 3: { name: 'Ladenhueter', volume: 1 } };
const BOOK = {
  10000043: [{ type_id: 1, location_id: AMARR, price: 1000, volume_remain: 2000, is_buy_order: false },
             { type_id: 2, location_id: AMARR, price: 100, volume_remain: 5000, is_buy_order: false },
             { type_id: 3, location_id: AMARR, price: 100, volume_remain: 5000, is_buy_order: false }],
  10000002: [{ type_id: 1, location_id: JITA, price: 1500, volume_remain: 5000, is_buy_order: true },
             { type_id: 2, location_id: JITA, price: 200, volume_remain: 5000, is_buy_order: true },
             { type_id: 3, location_id: JITA, price: 90, volume_remain: 5000, is_buy_order: true }],
};
let calls = [];
function makeWindow(store){
  return new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){
      Object.keys(store || {}).forEach(k => w.localStorage.setItem(k, store[k]));
      w.fetch = u => { u = String(u); calls.push(u); let m;
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok(TYPES[m[1]] || {});
        if ((m = u.match(/\/markets\/(\d+)\/orders\/.*order_type=all/))) return ok(BOOK[m[1]] || []);
        return Promise.reject(new Error('offline')); };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(500);
    const T = w.__test, $ = id => w.document.getElementById(id);

    // Leiter-Gewinn: 3 % Gebuehr, Budget und Stueckzahl deckeln
    const src = [{ price: 100, volume_remain: 10 }, { price: 110, volume_remain: 10 }], dst = [{ price: 200, volume_remain: 15 }];
    assert(Math.abs(T.potentialProfit(src, dst, 3, 1e9, Infinity) - (10 * 94 + 5 * 84)) < 1e-6, 'Leiter: 10 × 94 + 5 × 84');
    assert(Math.abs(T.potentialProfit(src, dst, 3, 1e9, 4) - 4 * 94) < 1e-6, 'Stueckzahl gedeckelt (Laderaum)');
    assert(Math.abs(T.potentialProfit(src, dst, 3, 550, Infinity) - 5 * 94) < 1e-6, 'Budget gedeckelt');

    // Vorauswahl: ohne Laderaum waere "Grosses Ding" vorn, mit 1000 m³ gewinnt der Kleinkram
    const cands = [1, 2].map(tid => ({ tid, f: cap => T.potentialProfit(BOOK[10000043].filter(o => o.type_id === tid), BOOK[10000002].filter(o => o.type_id === tid), 3.375, 1e9, cap) }));
    const pick = await T.pickByCargo(cands, 1, 1000);
    assert(pick.length === 1 && pick[0].tid === 2, 'mit Laderaum 1000 m³ wird der dichte Kleinkram gewaehlt');
    // B4: kleine Fracht – hoechstens 10 m³ je Stueck, auch bei riesigem Laderaum nur der Kleinkram
    const all = await T.pickByCargo(cands, 2, 1e9);
    const small = await T.pickByCargo(cands, 2, 1e9, null, 10);
    assert(all.length === 2 && small.length === 1 && small[0].tid === 2, 'max. 10 m³ je Stueck: Grosses Ding faellt raus');

    // ganzer Lauf im Hub-Handel
    calls = [];
    $('is-ship').value = '';   // 5.0 (#3): „Nur Laderaum“ – nur dort begrenzt der eingetippte Wert
    $('is-cargo').value = String(Math.ceil(1000 / 0.985 + 1000));   // BB4: Feld nimmt nur ganze m³   // 1,5 % Luft + 1000 m³ Reserve (27.09.2026) $('is-budget').value = '1000000000'; $('is-tax').value = '3.375';
    $('is-status').textContent = ''; $('is-start').click();
    for (let i = 0; i < 100 && !/^Fertig|^Fehler/.test($('is-status').textContent); i++) await tick(50);
    const st = $('is-status').textContent;
    assert(/3 Waren verglichen, 2 davon bringen Gewinn/.test(st), 'Status nennt die Zahl der Waren mit Gewinn (' + st + ')');
    assert(calls.filter(u => /\/markets\//.test(u)).length === 2 && calls.every(u => !/type_id=/.test(u)), 'nur 2 Orderbuecher geladen, keine Einzelabfragen je Ware');
    assert(!calls.some(u => /\/universe\/types\/3\//.test(u)), 'Ware ohne Gewinn: kein Volumen abgefragt');
    const best = w.__test.getOvHubLast();
    assert(best.rows[0].name === 'Kleinkram' && best.rows[0].q === 1000, 'beste Ladung: 1000 × Kleinkram');
    // B5: je Ware Menge, Name, hoechster Einkaufspreis kopierbar + Multibuy
    const first = $('is-options').querySelector('.shopping-list li');
    const cps = [].map.call(first.querySelectorAll('.tsc-cp-b[data-copy]'), b => b.getAttribute('data-copy'));
    assert(first.querySelector('.mk-btn'), 'H10: Markt-in-EVE-Knopf in der Einkaufsliste');
    assert(cps.join('|') === '1000|100', 'PQ1: Kopier-Knoepfe Menge, Einkaufspreis – keiner hinter dem Namen (' + cps.join('|') + ')');
    assert([].some.call($('is-options').querySelectorAll('.hl-cp-all button'), b => /Multibuy/.test(b.textContent)), 'Knopf „Einkaufsliste kopieren (für Multibuy)“ im Hub-Handel');
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-typevol-v1'));
    assert(saved[1] === 1000 && saved[2] === 1 && !(3 in saved), 'Volumen gespeichert, verpackt (1000 statt 5000)');
    w.close();

    // Neustart: Volumen kommen aus dem Speicher
    calls = [];
    w = makeWindow({ 'eve-zentrale-typevol-v1': JSON.stringify(saved) }); await tick(500);
    assert(await w.__test.getVolume(1) === 1000 && !calls.some(u => /\/universe\/types\//.test(u)), 'Neustart: Volumen ohne Abfrage');
    w.document.getElementById('is-maxunit').value = '10'; w.document.getElementById('is-maxunit').dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-hubhandel-v1')).maxunit === '10' && w.document.getElementById('hl-maxunit'), 'max. m³ je Stueck: Feld in beiden Bereichen, im Hub-Handel gemerkt');
    assert(w.document.getElementById('is-depth').value === '300' && w.document.getElementById('hl-depth').max === '2000', 'Suchtiefe 300, bis 2000');
    w.close();
    console.log('\nALL WARENAUSWAHL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.log(e.stack || e.message); console.log('WARENAUSWAHL TESTS FAILED'); process.exit(1); }
})();
