// MI1 (30.09.2026): Erz-Rechner – Erzdaten aus der SDE, Werte roh/komprimiert/raffiniert (Jita, netto), Raffinier-Ausbeute mit Skills + Anlage,
// Abbau je Schiff aus Dogma (Skills, Rollen-/Barge-Bonus, MLU II mit Stacking), ISK/Std., Sortierung, Hauptfenster + Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const at = o => Object.keys(o).map(k => ({ attribute_id: +k, value: o[k] }));
const TY = { 17478: ['Retriever', { 12: 3, 13: 2, 14: 2, 3177: 10, 3178: -12.5, 3181: 3, 3182: -2 }], 17482: ['Strip Miner I', { 73: 45000, 77: 150 }], 28576: ['Mining Laser Upgrade II', { 434: 9 }],
  22229: ['Ice Harvester II', { 73: 200000, 77: 1000 }], 32880: ['Venture', { 12: 1, 14: 3, 102: 2, 1842: 5, 3177: 100 }], 482: ['Miner II', { 73: 15000, 77: 15 }] };
const JITA = 60003760;
const PX = { 1230: [20, 25], 62516: [22, 24], 34: [4, 4.5] };   // Veldspar, Compressed Veldspar, Tritanium: [Kauf, Verkauf]
let orderCalls = 0;
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if ((m = /universe\/types\/(\d+)/.exec(u))){ const t = TY[m[1]]; return t ? json({ name: t[0], mass: 1, capacity: 0, dogma_attributes: at(t[1]), dogma_effects: [] }) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }); }
      if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))){ orderCalls++; const p = PX[m[1]]; return json(p ? [{ is_buy_order: true, location_id: JITA, system_id: 30000142, range: 'station', price: p[0], volume_remain: 1e9, min_volume: 1 }, { is_buy_order: true, location_id: 60000001, system_id: 1, range: 'station', price: p[0] * 3, volume_remain: 1, min_volume: 1 }, { is_buy_order: false, location_id: JITA, system_id: 30000142, range: 'region', price: p[1], volume_remain: 1e9, min_volume: 1 }] : []); }
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const V = T.MI_ORES.find(o => o[1] === 'Veldspar'), A = T.MI_ORES.find(o => o[1] === 'Arkonor'), BI = T.MI_ORES.find(o => o[1] === 'Blue Ice'), G = T.MI_ORES.find(o => o[4] === 'gas');
    assert(T.MI_ORES.length > 150 && V[0] === 1230 && V[5] === 0.1 && V[6] === 100 && V[7] === 62516 && V[9] === '34:400' && V[8] === 60377 && V[10] === 0.001, 'MI1: Erzdaten aus der SDE (Veldspar: 0,1 m³, 100 je Raffination, 400 Tritanium, komprimiert 62516, Simple Ore Processing)');
    assert(A[4] === 'null' && BI[4] === 'ice' && BI[6] === 1 && G && !G[9] && T.MI_ORES.some(o => o[4] === 'moon') && T.MI_ORES.some(o => o[4] === 'low'), 'MI1: Klassen High/Low/Null/Mond/Eis/Gas, Gas ohne Raffination');
    // Raffinier-Ausbeute
    const dd = T.miLoad();
    assert(near(T.miYield(dd, V, null), 0.5 * 1.15 * 1.1 * 1.1), 'MI1: NPC-Station 50 %, Skills alle V (Reprocessing, Efficiency, Erz-Skill)');
    assert(near(T.miYield(Object.assign({}, dd, { fac: 't2', sec: 'null', impl: 4 }), V, null), 53 * 1.12 * 1.055 / 100 * 1.15 * 1.1 * 1.1 * 1.04), 'MI1: Tatara + T2-Rig in Nullsec + 4 % Implantat');
    assert(near(T.miYield(dd, V, {}), 0.5), 'MI1: ohne Skills 50 %');
    // Rechnen (Retriever, alle V, alle Low-Slots MLU II)
    await T.miAction({ type: 'miGo' }); await tick(200);
    const tax = T.tscFees(T.tscReadCfg()).tax, brk = T.tscFees(T.tscReadCfg()).brk;
    const R = T.getMiRate();
    const ore = 2 * 150 * 1.25 * 1.25 * 1.1 * 1.15 * T.fitStack([1.09, 1.09, 1.09]) / 45 * 3600;
    assert(R && near(R.ore, ore) && R.lows === 3 && R.n === 2, 'MI1: Retriever – 2 Strip Miner, Mining/Astrogeology V, Rollen- + Barge-Bonus, 3× MLU II mit Stacking');
    assert(near(R.ice, 2 * 1000 / (200 * 0.875 * 0.9 * 0.75) * 3600), 'MI1: Eis mit Rollen-/Barge-Bonus und Ice Harvesting V');
    const rows = T.miRows(T.miLoad()), rv = rows.find(r => r.o[0] === 1230);
    const ref = 400 * 0.5 * 1.15 * 1.1 * 1.1 * 4 * (1 - tax) * 0.95 / 100;
    assert(near(rv.v.raw, 20 * (1 - tax)) && near(rv.v.cmp, 22 * (1 - tax)) && near(rv.v.ref, ref), 'MI1: je Einheit netto – roh 20, komprimiert 22 (Kauforders an der Jita-Station, nicht anderswo), raffiniert mit Ausbeute + 5 % Steuer');
    assert(rv.v.best === 'cmp' && near(rv.m3, 22 * (1 - tax) / 0.1) && near(rv.iskh, ore / 0.1 * 22 * (1 - tax)), 'MI1: beste Verwertung markiert, ISK/m³ und ISK/Std.');
    assert(rows.filter(r => r.o[0] !== 1230 && !/(^|,)34:/.test(r.o[9])).every(r => r.iskh === null) && rows.some(r => r.o[0] !== 1230 && r.use === 'ref' && r.iskh > 0), 'MI1: ohne Preise kein ISK/Std.; andere Veldspar-Sorten über Tritanium raffiniert');
    // Verkaufsorder statt Kauforder, Modus raffiniert
    await T.miAction({ type: 'miPm', arg: 'sell' }); await T.miAction({ type: 'miMode', arg: 'ref' });
    const rv2 = T.miRows(T.miLoad()).find(r => r.o[0] === 1230);
    assert(near(rv2.v.raw, 25 * (1 - tax - brk)) && rv2.use === 'ref' && near(rv2.m3, rv2.v.ref / 0.1), 'MI1: Verkaufsorder netto nach Steuer + Broker, Modus „Raffiniert“');
    await T.miAction({ type: 'miPm', arg: 'buy' }); await T.miAction({ type: 'miMode', arg: 'best' });
    // Venture: Bergbaufregatte, 2 Türme, 100 % Rollenbonus, 5 %/Stufe
    await T.miAction({ type: 'miGo', form: { mship: '32880' } }); await tick(100);
    assert(near(T.getMiRate().ore, 2 * 15 * 1.25 * 1.25 * 2 * 1.25 * 1.09 / 15 * 3600) && T.getMiRate().ice === null, 'MI1: Venture – Türme, Rollen- und Fregatten-Bonus, 1× MLU II, kein Eis');
    // Klassen, Overlay, Hauptfenster
    const calls = orderCalls;
    await T.miAction({ type: 'miCls', arg: 'ice' }); await tick(100);
    assert(T.miLoad().cls.ice && orderCalls > calls, 'MI1: Klasse Eis dazu lädt deren Preise');
    const box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    assert(box.querySelectorAll('.mi-row').length === 15 && /Veldspar/.test(box.querySelector('.mi-row').textContent) && /ISK\/Std/.test(box.querySelector('.mi-row').textContent), 'MI1: Overlay – Top 15 nach ISK/Std., Veldspar oben');
    assert(box.querySelector('[data-ova="miMode"][data-arg="cmp"]') && box.querySelector('[data-ova="miCls"][data-arg="moon"]') && !box.querySelector('[data-ovf="mfac"]'), 'MI1: Overlay mit Umschalter roh/komprimiert/raffiniert, Anlage nur im Hauptfenster');
    $('neo-btn-mining').click(); await tick(50);
    const pg = $('mi-page');
    assert(pg && pg.querySelector('.mi-t') && pg.querySelector('.mi-t .mi-best') && pg.querySelector('[data-ovf="mfac"]') && pg.querySelector('[data-ova="miImpl"][data-arg="4"]'), 'MI1: Hauptfenster mit Tabelle, Beste markiert, Anlage/Implantat');
    T.sortClick('mining:name');
    const first = pg.querySelector('.mi-t tr:nth-child(2) .mi-n').textContent;
    assert(first < pg.querySelector('.mi-t tr:nth-child(3) .mi-n').textContent, 'MI1: nach Name sortierbar');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
