// II6 (05.10.2026): Automatische Vorschläge gank-sicher zum Jita-Preis – die Ladung zählt für die Gank-Grenze mit dem höheren von Einkauf
// und Jita-Preis (so bewerten Ganker den gescannten Frachtraum), das ISK-Budget weiter mit dem Einkauf. Erst Durchschnittspreis, dann echter Jita-Verkaufspreis.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const JITA = 60003760;
let calls = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
  x.fetch = u => { u = String(u); calls.push(u); let m;
    if (/markets\/prices/.test(u)) return json([{ type_id: 1, average_price: 120 }, { type_id: 2, average_price: 50 }]);   // Durchschnitt: Ware 1 teurer als Einkauf
    if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))) return json({ 1: [{ order_id: 1, is_buy_order: false, location_id: JITA, system_id: 30000142, price: 200, volume_remain: 1e6, min_volume: 1, range: 'region' }],
      2: [{ order_id: 2, is_buy_order: false, location_id: JITA, system_id: 30000142, price: 40, volume_remain: 1e6, min_volume: 1, range: 'region' }] }[m[1]] || []);
    return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(500);
    const T = w.__test;
    // Ware 1: Einkauf 100, Gewinn 10/Stück; Ware 2: Einkauf 50, Gewinn 4/Stück; je 1000 Stück, Volumen 1
    const mk = () => [{ tid: 1, price: 100, margin: 10, vol: 1, qty: 1000, bPrice: 110 }, { tid: 2, price: 50, margin: 4, vol: 1, qty: 1000, bPrice: 54 }];
    const key = l => l.margin / l.price;
    // ohne Jita-Preis: Gank-Grenze 60.000 = ISK-Budget – Ware 1 ganz (100.000 > 60.000 → 600 Stück)
    let r = T.greedyAllocate2(mk(), key, 1e9, 1e9, 60000);
    assert(r.perItem[1].q === 600 && r.gv === 60000 && r.spend === 60000, 'ohne Jita-Preis: Gank-Wert = Einkauf (600 × 100)');
    // mit Jita-Preis 200 für Ware 1: nur noch 300 Stück passen unter die Gank-Grenze, das Budget wäre da
    let lots = mk(); lots[0].gp = 200;
    r = T.greedyAllocate2(lots, key, 1e9, 1e9, 60000);
    assert(r.perItem[1].q === 300 && r.gv === 60000 && r.spend === 30000, 'Jita-Preis höher → Gank-Grenze greift nach Jita-Wert (300 × 200), bezahlt nur 30.000');
    r = T.greedyAllocate2(mk(), key, 40000, 1e9, Infinity);
    assert(r.perItem[1].q === 400 && r.spend === 40000, 'ohne Gank-Grenze bleibt nur das ISK-Budget');
    r = T.greedyAllocate2(mk(), key, 1e9, 1e9, null);
    assert(r.perItem[1].q === 1000 && r.perItem[2].q === 1000, 'Grenze null (aus JSON) = keine Grenze, nicht 0');
    // Schleife: Durchschnittspreis (120) → echter Jita-Verkaufspreis (200) für die gewählten Waren → neu gerechnet
    lots = mk(); calls = [];
    let rounds = 0, res = null;
    await T.gkJitaLoop(lots, false, () => { rounds++; res = T.greedyAllocate2(lots, key, 1e9, 1e9, 60000); return { tids: Object.keys(res.perItem) }; }, true);
    assert(lots[0].gp === 200 && lots[1].gp === 50, 'Jita-Verkaufspreis 200 ersetzt Durchschnitt 120; Ware 2 bleibt beim höheren Einkauf (50 > Jita 40)');
    assert(rounds === 2 && res.perItem[1].q === 300, 'zweite Runde mit echtem Jita-Preis: 300 Stück statt 500 (mit Durchschnitt)');
    assert(calls.filter(u => /markets\/prices/.test(u)).length === 1 && calls.filter(u => /type_id=/.test(u)).length <= 2, 'eine Abfrage für alle Durchschnittspreise, Jita-Orderbuch nur für gewählte Waren');
    // Start in Jita: Einkauf = Jita-Preis, keine zusätzlichen Abfragen
    lots = mk(); calls = [];
    await T.gkJitaLoop(lots, true, () => ({ tids: ['1', '2'] }), true);
    assert(lots[0].gp === 100 && !calls.length, 'Start in Jita: Gank-Wert = Einkauf, keine Abfragen');
    // Gank-Sicherheit aus: keine Abfragen, kein gp
    lots = mk(); lots[0].gp = 999; calls = [];
    await T.gkJitaLoop(lots, false, () => ({ tids: ['1'] }), false);
    assert(lots[0].gp === undefined && !calls.length, 'ohne Gank-Grenze: keine Abfragen, Einkauf zählt');
    // Ampel-Tooltip: Einkauf und Jita-Wert
    const pill = T.gkOptPill({ name: 'Prüfschiff', fit: 'wie im Hangar', ehp: 100 }, '', 60000, null, 30000);
    assert(/bezahlt 30/.test(pill) && /Jita jetzt 60/.test(pill) && /600 ISK\/EHP/.test(pill), 'Ampel rechnet mit Jita-Wert, Tooltip zeigt Einkauf und Jita: ' + pill.replace(/<[^>]+>/g, '').slice(0, 80));
    console.log('\nALL II6 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
})();
