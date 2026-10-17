// Trade-Warnungen (14.10.2026): Höchstkaufpreis „Nicht über“, Plan-Vergleich ±5 %, einstellbare Mindestmarge, „Markt leer“
// (a) maxBuy am Beispiel (3 % / 0 %), (b) buyTooHigh ⇔ buyNow > maxBuy, (c) Plan-Abweichung mit Gewinn netto,
// (d) Marge 0 % = altes Verhalten, (e) Markt leer → Hinweis (Hauptfenster + Overlay), (f) alter Speicherstand lädt
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const errs = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify([   // (f) alter Stand: ohne neue Felder, ohne eve-zentrale-tradewarn-v1
      { id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', qty: 100, buy: 90, sell: 110, unit: 5, created: Date.now() - 3600e3, status: 'active' }]));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }]));   // Trades-Overlay braucht einen Login
    w.fetch = () => Promise.reject(new Error('offline'));
    w.addEventListener('error', e => errs.push(e.message));
  } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, F = { brk: 0.02, tax: 0.03, relist: 0 };
    const L = (buy, sell) => ({ types: { buys: buy === null ? [] : [{ order_id: 1, price: buy }], sells: sell === null ? [] : [{ order_id: 2, price: sell }] }, own: {} });
    const T0 = (o) => Object.assign({ id: 'x', tid: 34, name: 'Tritanium', hub: 'jita', qty: 100, buy: 90, sell: 0, created: Date.now(), status: 'active' }, o);
    const setM = m => w.localStorage.setItem('eve-zentrale-tradewarn-v1', JSON.stringify({ margin: m }));
    // (f) ohne Schlüssel: Standard 3 %
    let ev = T.trEvaluate(T0({}), L(80, 100), F);
    assert(Math.abs(ev.minMargin - 3) < 1e-9, '(f) ohne eve-zentrale-tradewarn-v1 gilt 3 %');
    // (a) Markt 100 → eigener Verkauf 99,99; Netto 99,99 × 0,95 = 94,9905; 3 %: ÷ (1,02 × 1,03) = 90,415… → 90,41; 0 %: ÷ 1,02 = 93,128… → 93,12
    assert(ev.sellMarket === 99.99 && ev.maxBuy === 90.41, '(a) maxBuy bei 3 % = 90,41: ' + ev.maxBuy);
    setM(0); ev = T.trEvaluate(T0({}), L(80, 100), F);
    assert(ev.maxBuy === 93.12, '(a) maxBuy bei 0 % = 93,12: ' + ev.maxBuy);
    // Referenz: eigener Verkaufspreis vor Markt, Plan wenn kein Markt
    const own = L(80, 100); own.own = { sell: { order_id: 9, price: 120, volume_remain: 5, issued: new Date(0).toISOString() } };
    assert(T.trEvaluate(T0({}), own, F).maxBuy === 111.7, '(a) eigener Verkaufspreis 120 zählt vor dem Markt: ' + T.trEvaluate(T0({}), own, F).maxBuy);
    assert(T.trEvaluate(T0({ sell: 110 }), L(80, null), F).maxBuy === 102.4, '(a) ohne Markt: geplanter Preis 110');
    // (b) widerspruchsfrei: buyTooHigh genau dann, wenn buyNow > maxBuy; an der Grenze noch ≥ Mindestmarge
    setM(3);
    ev = T.trEvaluate(T0({}), L(90.40, 100), F);
    assert(ev.buyNow === 90.41 && !ev.buyTooHigh, '(b) Kauf zu 90,41 = maxBuy → keine Warnung');
    assert(T.tscUnitProfit(90.41, 99.99, F, 0) / (90.41 * 1.02) >= 0.03, '(b) an der Grenze bleibt die Mindestmarge');
    ev = T.trEvaluate(T0({}), L(90.41, 100), F);
    assert(ev.buyNow === 90.42 && ev.buyTooHigh && !ev.buyLoss && ev.buyMargin < 3 && ev.buyMargin > 0, '(b) 90,42 > maxBuy → gelb (Marge ' + ev.buyMargin.toFixed(2) + ' %), nicht rot');
    for (let b = 85; b < 100; b += 0.37){ const e = T.trEvaluate(T0({}), L(b, 100), F); if (e.buyTooHigh !== (e.buyNow > e.maxBuy)) throw new Error('(b) Widerspruch bei ' + b); }
    console.log('OK: (b) Schleife 85–100: buyTooHigh ⇔ buyNow > maxBuy');
    // (d) Marge 0 % = altes Verhalten (Warnung/rot genau bei Gewinn ≤ 0 gegen den Markt)
    setM(0);
    for (let b = 85; b < 100; b += 0.13){
      const e = T.trEvaluate(T0({}), L(b, 100), F), old = T.tscUnitProfit(e.buyNow, e.sellMarket, F, 0) <= 0;
      if (e.buyTooHigh !== old || e.buyLoss !== old || e.belowMargin) throw new Error('(d) anders als vorher bei ' + b);
    }
    console.log('OK: (d) 0 %: buyTooHigh = buyLoss = alte Regel, keine Margen-Warnung');
    // Verkaufsseite: Markt über Mindestpreis, aber unter der Marge → gelb; unter Mindestpreis bleibt rot
    setM(5);
    ev = T.trEvaluate(T0({ buy: 90 }), L(80, 99), F);   // Markt 98,99: Marge (98,99×0,95 − 91,8) ÷ 91,8 ≈ 2,4 %
    assert(!ev.belowBreakEven && ev.belowMargin && ev.mktMargin > 0 && ev.mktMargin < 5, '(3) Gewinn > 0, unter 5 % → gelb: ' + ev.mktMargin.toFixed(2) + ' %');
    assert(ev.breakEven === T.trEvaluate(T0({ buy: 90 }), L(80, 99), F).breakEven && ev.breakEven < ev.sellMarket, '(3) „Nicht unter“ bleibt der Verlust-Nullpunkt');
    ev = T.trEvaluate(T0({ buy: 90 }), L(80, 95), F);
    assert(ev.belowBreakEven && !ev.belowMargin, '(3) unter Mindestpreis → rot wie bisher');
    // (c) Plan-Abweichung ±5 % mit Gewinn netto je Stück und gesamt
    ev = T.trEvaluate(T0({ sell: 110 }), L(80, 100), F);
    const u = T.tscUnitProfit(90, 99.99, F, 0);
    assert(Math.abs(ev.planDev - (99.99 - 110) / 110 * 100) < 1e-9 && Math.abs(ev.planUnit - u) < 1e-9, '(c) −9,1 % unter Plan, Gewinn netto ' + u.toFixed(2) + '/Stk');
    assert(T.trEvaluate(T0({ sell: 102 }), L(80, 100), F).planDev === undefined, '(c) 2 % Abweichung → keine Zeile');
    assert(T.trEvaluate(T0({ sell: 90 }), L(80, 100), F).planDev > 5, '(c) über dem Plan');
    assert(T.trEvaluate(T0({ sell: 110, auto: true }), L(80, 100), F).planDev === undefined, '(c) automatisch erkannt ohne Plan → keine Zeile');
    // (e) Markt leer → Hinweis statt nichts (Hauptfenster + Overlay)
    ev = T.trEvaluate(T0({}), L(null, null), F);
    assert(ev.sellEmpty && ev.buyEmpty && !ev.belowBreakEven && !ev.buyTooHigh, '(e) leerer Markt: Hinweis-Flags, keine rote Warnung');
    setM(3);
    T.trLiveSet('t1', L(null, null)); T.trRender();
    const card = w.document.querySelector('.tr-card[data-bk="Trade:t1"]');
    assert(card && (card.textContent.match(/Markt leer – kein Vergleich möglich/g) || []).length === 2, '(e) Hauptfenster: Hinweis bei Kauf und Verkauf');
    const RF = T.tscFees(T.tscReadCfg()), mx = T.trEvaluate(T0({}), L(80, 100), RF).maxBuy, mxS = String(mx), mxD = mx.toFixed(2).replace('.', ',');   // Hauptfenster rechnet mit den echten Gebühren
    T.trLiveSet('t1', L(mx, 100)); T.trRender();
    const c2 = w.document.querySelector('.tr-card[data-bk="Trade:t1"]'), nu = [...c2.querySelectorAll('.tr-line')].find(r => /Nicht über/.test(r.textContent));
    assert(nu && nu.textContent.indexOf(mxD) >= 0 && nu.querySelector('[data-copy="' + mxS + '"]'), '(1) „Nicht über ' + mxD + '“ mit Kopier-Knopf');
    assert(/Unter deiner Mindestmarge/.test(c2.textContent) && /Markt liegt/.test(c2.textContent) && /unter deinem Plan/.test(c2.textContent), '(2)/(3) Hauptfenster: Margen- und Plan-Zeile');
    T.ovSetMode('compact'); await tick(900); const s = T.ovLoad(); s.view = 'trades'; T.ovSave(s); T.trLiveSet('t1', L(mx, 100)); T.ovRender(); await tick(300);   // Start lädt offline neu → Preise danach setzen
    const oc = w.document.querySelector('.ov-card[data-bk="Trade:t1"]');
    assert(oc && /nicht über/.test(oc.textContent) && oc.querySelector('[data-copy="' + mxS + '"]') && /Markt liegt/.test(oc.textContent), '(1)/(2) Overlay: „nicht über“ + Plan-Zeile');
    T.trLiveSet('t1', L(null, null)); T.ovRender(); await tick(200);
    assert(/Markt leer – kein Vergleich möglich/.test(w.document.querySelector('.ov-card[data-bk="Trade:t1"]').textContent), '(e) Overlay: Markt leer');
    // Einstellung speichert in eve-zentrale-tradewarn-v1
    const sel = w.document.getElementById('ovs-twmargin');
    assert(sel && sel.options.length >= 5, 'Einstellung „Mindestmarge für Trade-Warnungen“ vorhanden');
    sel.value = '8'; sel.dispatchEvent(new w.Event('change'));
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-tradewarn-v1')).margin === 8 && w.localStorage.getItem('eve-zentrale-trades-v1'), 'Einstellung gespeichert, alte Schlüssel unverändert');
    assert(!errs.length, '(f) keine Skriptfehler: ' + errs.join(' | '));
    console.log('ALL TRADE-WARNUNGEN TESTS PASSED');
  }catch(e){ console.error(e); console.log('FAILED: ' + e.message); }
  process.exit(0);
})();
