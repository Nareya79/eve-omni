// MI4 (30.09.2026): Mining › Verkaufen – Hub-Vergleich je Erz roh/komprimiert/raffiniert (sofort an Kauforders mit Leiter, Verkaufsorder),
// Komprimieren-Hinweis mit Flügen, „→ Verkaufen“ aus dem Erz-Rechner, Route zum Hub, Overlay; keine Gank-Symbole
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const HUB = { 10000002: [60003760, 30000142], 10000043: [60008494, 30002187], 10000032: [60011866, 30002659], 10000030: [60004588, 30002510], 10000042: [60005686, 30002053] };
// je Region + Ware: [Kaufpreis, Menge Kauforders, Verkaufspreis]
const PX = { '10000002:1230': [20, 1e9, 25], '10000043:1230': [22, 50000, 26], '10000002:62516': [23, 1e9, 24], '10000043:62516': [21, 1e9, 30], '10000002:34': [4, 1e9, 5], '10000043:34': [4.2, 1e9, 4.8] };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if ((m = /markets\/(\d+)\/orders\/.*type_id=(\d+)/.exec(u))){ const p = PX[m[1] + ':' + m[2]], h = HUB[m[1]];
        return json(p ? [{ is_buy_order: true, location_id: h[0], system_id: h[1], range: 'station', price: p[0], volume_remain: p[1], min_volume: 1 }, { is_buy_order: false, location_id: h[0], system_id: h[1], range: 'region', price: p[2], volume_remain: 1e9, min_volume: 1 }] : []); }
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const tax = T.tscFees(T.tscReadCfg()).tax, brk = T.tscFees(T.tscReadCfg()).brk;
    await T.miAction({ type: 'miGo' }); await tick(200);
    // aus dem Erz-Rechner: → Verkaufen (Beste = komprimiert, weil 23 > 20)
    await T.miAction({ type: 'miSell', arg: '1230', form: { msq: '100.000', mscargo: '60.000' } }); await tick(200);
    let D = T.miLoad(), L = T.getMiSell();
    assert(D.view === 'sell' && D.stid === 1230 && D.svar === 'cmp' && D.sq === 100000, 'MI4: „→ Verkaufen“ öffnet Verkaufen mit dem Erz und seiner besten Verwertung');
    const j = L.hubs.find(h => h.k === 'jita'), a = L.hubs.find(h => h.k === 'amarr');
    assert(near(j.net, 23 * 100000 * (1 - tax)) && near(a.net, 21 * 100000 * (1 - tax)) && L.best === 'jita', 'MI4: komprimiert sofort netto je Hub, Jita am besten');
    assert(near(a.order, 30 * 100000 * (1 - tax - brk)) && L.bestO === 'amarr' && L.hubs.find(h => h.k === 'hek').noSell, 'MI4: Verkaufsorder netto (Steuer + Broker), bester Order-Hub, Hub ohne Angebot');
    // roh: dünner Markt in Amarr
    await T.miAction({ type: 'miSvar', arg: 'raw' }); await tick(200);
    L = T.getMiSell(); const a2 = L.hubs.find(h => h.k === 'amarr');
    assert(!a2.all && near(a2.net, 22 * 50000 * (1 - tax)) && L.hubs.find(h => h.k === 'jita').all, 'MI4: roh – Amarr nimmt nur 50.000 sofort („nicht alles“)');
    // raffiniert: ganze Portionen × 400 Tritanium × Ausbeute, minus Raffiniersteuer
    await T.miAction({ type: 'miSvar', arg: 'ref' }); await tick(200);
    L = T.getMiSell();
    const q = Math.floor(1000 * 400 * 0.5 * 1.15 * 1.1 * 1.1 * 0.95);
    assert(near(L.hubs.find(h => h.k === 'amarr').net, q * 4.2 * (1 - tax)) && L.best === 'amarr', 'MI4: raffiniert – Mineralien je Hub, Amarr am besten');
    // Ansicht (Overlay) + Flüge
    const box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    const txt = box.textContent;
    assert(/Roh 10\.000 m³ = 1 Flug/.test(txt) && /komprimiert 100 m³ = 1 Flug \(100× kleiner\)/.test(txt), 'MI4: Komprimieren-Hinweis mit m³ und Flügen');
    assert(box.querySelectorAll('.mi-hub').length === 5 && box.querySelector('.mi-hub.mi-top') && box.querySelector('[data-ova="miRoute"][data-arg="jita"]') && box.querySelector('[data-ova="miEve"][data-arg="amarr"]') && box.querySelector('.mi-hub .tsc-cp-b[data-copy]'), 'MI4: 5 Hubs, bester markiert, Route/→ EVE, Station kopierbar');
    assert(!/Gank/.test(txt), 'MI4: keine Gank-Symbole im Handel');
    await T.miAction({ type: 'miSvar', arg: 'raw', form: { mscargo: '5.000' } }); await tick(200);
    const box2 = d.createElement('div'); T.ovRenderViewInto('mining', box2);
    assert(/Roh 10\.000 m³ = 2 Flüge/.test(box2.textContent), 'MI4: Flüge nach Laderaum');
    await T.miAction({ type: 'miView', arg: 'calc' });
    const box3 = d.createElement('div'); T.ovRenderViewInto('mining', box3);
    assert(box3.querySelector('[data-ova="miView"][data-arg="sell"]') && !box3.querySelector('.mi-hub'), 'MI4: zurück zum Erz-Rechner');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
