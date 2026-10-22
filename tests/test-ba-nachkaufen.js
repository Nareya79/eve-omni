// BA (22.10.2026): Trade 8/8 gekauft, 4 versehentlich sofort an eine Kauforder verkauft (bevor eine eigene Verkaufsorder stand) →
// Karte zeigt „4 sofort verkauft – nachkaufen?“; Klick hebt das Ziel auf 12, Einkauf wieder offen, neue Kauforder wird zugeordnet (überwacht).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), JITA = 60003760;
const tx = {}; let n = 1; const add = (min, q, price, buy) => { tx[n++] = [now - min * 60000, 34, q, price, buy, JITA]; };
add(50, 8, 100, true); add(30, 4, 90, false);   // 8 gekauft, 4 sofort an eine Kauforder (90) verkauft
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', charName: 'Eins', qty: 8, buy: 100, sell: 120, unit: 15, created: now - 3600e3, status: 'active', buyDone: true, buyOrderId: 555 }];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx, fee: {}, ord: {}, upd: now }));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }])); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, fees = { brk: 0.015, tax: 0.03375, relist: 0 };
    let t = T.trLoad()[0], ev = T.trEvaluate(t, null, fees);
    assert(ev.p.bought === 8 && ev.p.sold === 4 && ev.p.instant === 4, '8 gekauft, 4 verkauft, davon 4 sofort (keine Verkaufsorder)');
    const h = T.trRebuyHtml(t, ev);
    assert(/4 sofort verkauft/.test(h) && /nachkaufen\?/.test(h), 'Karte bietet „4 sofort verkauft – nachkaufen?“');
    T.trRebuy('t1'); t = T.trLoad()[0];
    assert(t.qty === 12 && t.rebuy === 4 && !t.buyDone && !t.buyOrderId, 'Klick: Ziel 12, Einkauf wieder offen, Kauforder frei');
    ev = T.trEvaluate(t, null, fees);
    assert(ev.buyPhase && ev.toBuy === 4 && !T.trRebuyHtml(t, ev), 'noch 4 zu kaufen, Hinweis verschwindet');
    T.trSyncBA({ ok: { '111': true }, list: [{ charId: '111', charName: 'Eins', hub: 'jita', order: { order_id: 777, type_id: 34, is_buy_order: true, price: 101, volume_total: 4, volume_remain: 4, location_id: JITA, issued: new Date().toISOString() } }] });
    t = T.trLoad()[0];
    assert(t.buyOrderId === 777 && T.trLoad().length === 1, 'neue Kauforder gehört zum Trade (wird überwacht), kein zweiter Trade');
    // Verkauf NACH eigener Verkaufsorder zählt nicht als sofort
    const t2 = Object.assign({}, TR[0], { sellAt: now - 40 * 60000 });
    assert(!(T.trEvaluate(t2, null, fees).p.instant), 'Verkauf nach eigener Verkaufsorder ist kein Sofort-Verkauf');
    assert(/"nachkaufen\?": "buy again\?"/.test(html) && /sofort verkauft\$\/, "\$1 sold right away"/.test(html), 'Texte auch englisch');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
