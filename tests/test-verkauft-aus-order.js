// 11.10.2026: „gekauft 105/105 · verkauft 7 · Lager 98“, obwohl die Verkaufsorder schon 88 übrig zeigt – verkauft zählt jetzt auch
// aus der offenen Verkaufsorder (die Wallet-Buchungen kommen bis 1 Std. später)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const tick = ms => new Promise(r => setTimeout(r, ms || 100));
const NOW = Date.now(), H = 3600000, JITA = 60003760;
(async () => {
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
  await tick(300);
  const T = w.__test;
  // Wallet: 105 gekauft zu 10, 7 verkauft zu 15 (die übrigen 10 Verkäufe sind noch nicht gebucht)
  w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [NOW - 3 * H, 34, 105, 10, true, JITA], 2: [NOW - H, 34, 7, 15, false, JITA] }, fee: {}, ord: {}, upd: NOW }));
  const t = { id: 'x1', tid: 34, name: 'Tritanium', hub: 'jita', qty: 105, buy: 10, sell: 15, charId: '111', created: NOW - 4 * H, status: 'active', sellOrderId: 77 };
  const fees = T.tscFees(T.tscReadCfg());
  const ohne = T.trEvaluate(t, null, fees);
  assert(ohne.p.sold === 7 && ohne.stock === 98, 'ohne Order nur die Buchungen (' + ohne.p.sold + '/' + ohne.stock + ')');
  const live = { own: { sell: { order_id: 77, is_buy_order: false, price: 15, volume_total: 105, volume_remain: 88, location_id: JITA, type_id: 34 } } };
  const mit = T.trEvaluate(t, live, fees);
  assert(mit.p.sold === 17 && mit.stock === 88 && Math.abs(mit.p.soldVal - 17 * 15) < 1e-6 && mit.p.est, 'mit Order: verkauft 17, Lager 88 wie in EVE (' + mit.p.sold + '/' + mit.stock + ')');
  const fremd = T.trEvaluate(t, { own: { sell: Object.assign({}, live.own.sell, { order_id: 99 }) } }, fees);
  assert(fremd.p.sold === 7, 'andere Order desselben Charakters zählt nicht');
  const spaeter = T.trEvaluate(t, { own: { sell: Object.assign({}, live.own.sell, { volume_remain: 100 }) } }, fees);
  assert(spaeter.p.sold === 7, 'sind die Buchungen schon weiter als die Order, gelten die Buchungen');
  console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
})();
