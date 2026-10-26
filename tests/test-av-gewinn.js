// AV (22.10.2026): Trade-Gewinn – Verkauf zum aktuellen Marktpreis statt Plan (AV1), gerade kopierter neuer Preis zählt sofort (AV2),
// Gesamt = gekauft × Ø + Rest × Orderpreis (AV3), „Bei Abbruch jetzt“ zwei Zeilen nur aufgeklappt (AV4). DE/EN-Texte.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, fees = { brk: 0.015, tax: 0.03375, relist: 0.003 };
    const o = (buy, price, id) => ({ order_id: id || Math.random(), is_buy_order: buy, price, volume_remain: 5, issued: new Date().toISOString() });
    const t = { id: 'x1', tid: 34, hub: 'jita', qty: 10, buy: 100, sell: 120, unit: 10, status: 'active', created: Date.now() };
    const live = { types: { buys: [o(true, 95)], sells: [o(false, 150), o(false, 160)] }, own: {} };
    let ev = T.trEvaluate(t, live, fees);
    const want = T.tscUnitProfit(100, ev.sellMarket, fees, 0);
    assert(ev.sellSrc === 'markt' && Math.abs(ev.unit - want) < 1e-9 && ev.unit > T.tscUnitProfit(100, 120, fees, 0), 'AV1: Kaufphase rechnet mit dem Marktpreis (' + ev.sellMarket + '), nicht mit dem Plan 120');
    assert(Math.abs(ev.total - ev.unit * 10) < 1e-6, 'AV3: nichts gekauft → gesamt = Stück × Planmenge');
    const own = { sell: o(false, 150, 7) };
    const t2 = Object.assign({}, t, { pendsell: { p: 140, t: Date.now() } });
    ev = T.trEvaluate(t2, Object.assign({}, live, { own }), fees);
    assert(ev.sellSrc === 'pend' && ev.pend && Math.abs(ev.unit - T.tscUnitProfit(100, 140, fees, 0)) < 1e-9, 'AV2: kopierter neuer Preis 140 zählt sofort (Order steht noch auf 150)');
    ev = T.trEvaluate(t2, Object.assign({}, live, { own: { sell: o(false, 140, 7) } }), fees);
    assert(ev.sellSrc === 'order', 'AV2: meldet EVE die Order mit 140, gilt wieder die Order');
    ev = T.trEvaluate(Object.assign({}, t, { pendsell: { p: 140, t: Date.now() - 31 * 60000 } }), Object.assign({}, live, { own }), fees);
    assert(ev.sellSrc === 'order', 'AV2: nach 30 Min. ohne Meldung verfällt der gemerkte Preis');
    // AV4 Anzeige
    const h1 = T.trAbortHtml({ abortNow: -1.5e6, abortOrder: 2e6, stock: 4 }), h0 = T.trAbortHtml({ abortNow: -3e5, stock: 0 });
    assert(/Bei Abbruch jetzt, sofort verkauft:/.test(h1) && /zum Marktpreis eingestellt:/.test(h1) && /neg bad/.test(h1) && /pos ok/.test(h1), 'AV4: zwei Zeilen (sofort / Marktpreis), Verlust rot, Gewinn grün');
    assert(/Bei Abbruch jetzt:/.test(h0) && !/Marktpreis eingestellt/.test(h0) && /Maklergebühr/.test(h0), 'AV4: ohne Ware nur Kasse + Hinweis Maklergebühr');
    assert(T.trAbortHtml({ stock: 3 }) === '', 'AV4: fertiger Trade / ohne Kasse → keine Zeile');
    assert(T.trEvaluate(t, live, fees).abortNow === 0 && /Bei Abbruch jetzt:/.test(T.trAbortHtml(T.trEvaluate(t, live, fees))), 'AV4: immer – auch laufender Trade ohne Käufe (Nutzer 22.10.)');
    assert(T.trEvaluate(Object.assign({}, t, { status: 'done' }), live, fees).abortNow === undefined, 'AV4: erledigter Trade ohne Zeile');
    // nur aufgeklappt: Hauptfenster tr-abort, Overlay ohne ov-keep (CSS tr-fold blendet aus)
    assert(/card\.appendChild\(el\("div", "tr-abort item-sub", ab\)\)/.test(html) && /<span>Abbruch<\/span> ' \+ ab\(ev\.abortNow\)/.test(html) && /\.tr-card\.tr-fold>:not\(\.tr-head\):not\(\.tr-upd\):not\(\.tr-res\)/.test(html), 'AV4: nur aufgeklappt (Hauptfenster + Overlay)');
    assert(/"Bei Abbruch jetzt, sofort verkauft:": "If cancelled now, sold right away:"/.test(html) && /"Zum Marktpreis": "At market price"/.test(html) && /current market price/.test(html), 'Texte auch englisch');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
