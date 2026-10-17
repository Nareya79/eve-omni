// EF1/EF2/EF6 (03.10.2026): Gank-Check – (Ladung + Module) ÷ EHP, Grenze 3000 ISK/EHP, Ampel, sichere Ladung,
// EHP aus Hangar-Fitting (letzte Assets-Liste) bzw. „n× Expanded Cargohold II“ bzw. nacktem Rumpf; Lauf merkt sich das Schiff
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const at = o => Object.keys(o).map(k => ({ attribute_id: +k, value: o[k] }));
// Rumpf: je 1000 Schild/Panzer/Struktur, keine Resistenzen → mit allen Skills V je 1250 = 3750 EHP
const HULL = { 9: 1000, 263: 1000, 265: 1000, 267: 1, 268: 1, 269: 1, 270: 1, 271: 1, 272: 1, 273: 1, 274: 1, 109: 1, 110: 1, 111: 1, 113: 1, 12: 4, 13: 2, 14: 1 };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if (/universe\/ids/.test(u)) return json({ inventory_types: JSON.parse(o.body).map((n, i) => ({ id: /cargohold/i.test(n) ? 1319 : 900000 + i, name: n })) });
      if ((m = /universe\/types\/(\d+)/.exec(u))) return json(+m[1] === 1319 ? { name: 'Expanded Cargohold II', mass: 0, capacity: 0, dogma_attributes: at({ 149: 1.275, 150: 0.77 }), dogma_effects: [{ effect_id: 11 }] }
        : { name: 'Rumpf', mass: 10000000, capacity: 5000, dogma_attributes: at(HULL), dogma_effects: [] });
      if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))) return json({ 34: [{ order_id: 1, is_buy_order: false, location_id: 60003760, system_id: 30000142, price: 9, volume_remain: 1e6, min_volume: 1, range: 'region' }],
        35: [{ order_id: 2, is_buy_order: false, location_id: 60003760, system_id: 30000142, price: 200, volume_remain: 1e6, min_volume: 1, range: 'region' }] }[m[1]] || []);   // II5: Jita-Verkaufspreise
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test;
    const wait = async (nm, v) => { T.gkCalc(nm, v); for (let i = 0; i < 40; i++){ await tick(50); const g = T.gkCalc(nm, v); if (g && !g.busy) return g; } return null; };
    // nackter Rumpf (kein eigenes Schiff in den Assets)
    let g = await wait('Prüfschiff A', 3e6);
    assert(g && near(g.ehp, 3750) && g.src === 'Rumpf ohne Module' && g.mv === 0, 'EF1: ohne Hangar-Schiff – EHP des Rumpfs mit Skills V (3750)');
    assert(g.lvl === 'ok' && near(g.q, 800), 'EF1: 3 Mio ÷ 3750 EHP = 800 ISK/EHP → grün');
    assert(T.gkCalc('Prüfschiff A', 6e6).lvl === 'ok' && T.gkCalc('Prüfschiff A', 9e6).lvl === 'warn' && T.gkCalc('Prüfschiff A', 12e6).lvl === 'bad', 'EF1: 1600 → grün, 2400 → gelb, 3200 → rot (grün bis 2000, Grenze 3000)');
    g = T.gkCalc('Prüfschiff A', 12e6);
    assert(near(g.safe, 3000 * 3750) && g.cat[0][0] === 0.5 && g.cat[0][1] === 1 && g.cat[1][1] === 1, 'EF1: sichere Ladung = 3000 × EHP, Catalysts je Sicherheit');
    assert(/Gank-Ziel/.test(T.gkPill(g)) && /Fahrten teilen/.test(T.gkLine(g)) && T.gkLine(T.gkCalc('Prüfschiff A', 3e6)) === '', 'EF1: rote Ampel + Tipp, grün ohne Tipp');
    // Fitting „1× Expanded Cargohold II“: Struktur × 0,77
    T.shipFitSet('Prüfschiff B', { mode: '1' });
    g = await wait('Prüfschiff B', 3e6);
    assert(g && near(g.ehp, 1250 + 1250 + 1250 * 0.77) && /1× Expanded Cargohold II/.test(g.src), 'EF1: Cargo-Module senken die EHP (Struktur × 0,77)');
    // eigenes Schiff im Hangar: echtes Fitting + Modulwert zählt mit
    T.lcSave('assets', { g: [{ cid: '1', locs: [{ rows: [{ tid: 900000, ship: { id: 5, fv: 2e6, sl: [['Low', [[1319, 'Expanded Cargohold II', 2]]], ['Fracht', [[34, 'Tritanium', 100]]]] } }] }] }] });
    g = await wait('Prüfschiff C', 3e6);
    assert(g && near(g.ehp, 2500 + 1250 * 0.77 * 0.77) && g.mv === 2e6 && near(g.v, 5e6) && g.src === 'Fitting aus dem Hangar', 'EF1: Hangar-Fitting (2× Cargo, Fracht zählt nicht) + Modulwert 2 Mio');
    // Lauf merkt sich das Schiff, Ladungswert = Menge × Einkaufspreis
    T.shipFitSet('Prüfschiff D', { mode: '1' });   // Lauf mit bekanntem Fitting (ohne Fitting zeigt die Route „Fitting unbekannt“)
    await wait('Prüfschiff D', 6000);
    const run = T.hrAdd(60003760, 'Jita', 60008494, 'Amarr', [{ tid: 34, name: 'Tritanium', q: 1000, p: 500, sp: 5000 }, { tid: 35, name: 'Pyerite', q: 10, p: 100, sp: 1000 }], 'is', 'Prüfschiff D');
    assert(run.ship === 'Prüfschiff D' && T.gkRun(run) === 6000, 'EF2: Lauf speichert Schiff, Wert = Σ bezahlter Einkauf (sp), nicht Menge × Gewinn');
    assert(/pill gk gk-ok/.test(T.gkRunPill(run.id)), 'EF2: Ampel am laufenden Lauf');
    // II5: Ganker bewerten den gescannten Frachtraum zum Jita-Preis → der höhere Wert zählt (bezahlt 6000, Jita jetzt 1000×9 + 10×200 = 11000)
    for (let i = 0; i < 40 && T.gkRun(run) === 6000; i++) await tick(50);
    assert(T.gkRun(run) === 11000, 'II5: Ladungswert = höherer von bezahlt (6000) und Jita jetzt (11000): ' + T.gkRun(run));
    const tip = T.gkRunPill(run.id);
    assert(/bezahlt 6[.,]?0*\s*(k|Tsd)?/.test(tip) && /Jita jetzt 11/.test(tip) && /höhere Wert/.test(tip), 'II5: Tooltip zeigt beide Werte');
    const cheap = T.hrAdd(60003760, 'Jita', 60008494, 'Amarr', [{ tid: 34, name: 'Tritanium', q: 10, p: 1, sp: 5000 }], 'is', 'Prüfschiff D');
    for (let i = 0; i < 40 && !/Jita jetzt/.test(T.gkRunPill(cheap.id)); i++) await tick(50);
    assert(T.gkRun(cheap) === 5000, 'II5: teurer bezahlt als Jita (5000 > 90) → bezahlter Wert bleibt');
    const d = T.gkWarnEl('Prüfschiff A', 12e6);
    assert(/gk-line gk-bad/.test(d.className) && /Gank-Ziel/.test(d.innerHTML), 'EF6: Zeile unter Handel-/Hauling-Vorschlag');
    // FF3: Haken „nur gank-sichere Ladung“ kappt das Budget auf 3000 × EHP − Modulwert
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 0 }));   // KK9: Standard ist jetzt „normal“ – hier ausdrücklich aus
    let c = await T.gkCap('is', 50e6, 'Prüfschiff A');
    assert(c.budget === 50e6 && !c.cut, 'FF3: ohne Haken bleibt das Budget');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: true }));
    c = await T.gkCap('is', 50e6, 'Prüfschiff A');
    assert(c.budget === 7500000 && c.cut === 50e6 && /2\.000 ISK\/EHP|2,000 ISK\/EHP/.test(T.gkCapTxt(c)), 'Stufe: alter Haken = normal → 2000 × 3750 EHP = 7,5 Mio statt 50 Mio');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 1500 }));
    assert((await T.gkCap('is', 50e6, 'Prüfschiff A')).budget === 5625000, 'Stufe vorsichtig: 1500 × 3750 = 5,625 Mio');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 3000 }));
    c = await T.gkCap('is', 50e6, 'Prüfschiff A');
    assert(c.budget === 11250000 && c.cut === 50e6, 'Stufe an der Grenze: 3000 × 3750 EHP = 11,25 Mio');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 0 }));
    assert((await T.gkCap('is', 50e6, 'Prüfschiff A')).budget === 50e6, 'Stufe aus: Budget bleibt');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 3000 }));
    assert((await T.gkCap('is', 5e6, 'Prüfschiff A')).budget === 5e6, 'FF3: kleineres Budget bleibt');
    // FF6: je Option das Schiff/Fitting mit dem besten Ergebnis, Budget je Variante gank-sicher gekappt
    assert(T.gkFitTxt(1, 2) === '1× Expanded Cargohold II + 2× Reinforced Bulkheads II' && T.gkFitTxt(0, 0) === 'Low-Slots leer', 'FF6: Fitting-Text');
    const lots = [{ tid: 1, price: 1000, qty: 100000, margin: 100, vol: 10 }];
    const fleet = [{ ship: 'Klein', fit: 'A', cap: 5000, ehp: 1000, budget: 3e6 }, { ship: 'Gross', fit: 'B', cap: 1e6, ehp: 1e5, budget: 50e6 }, { ship: 'Gross', fit: 'C', cap: 2e5, ehp: 2e5, budget: 50e6 }];
    const opt = { lots, key: l => l.margin, jumps: null };
    await T.gkFleetPick(opt, fleet);
    assert(opt.ship.name === 'Gross' && opt.ship.fit === 'B' && opt.cmp.length === 2 && opt.res.spend <= 50e6, 'FF6: bestes Schiff + Fitting, Vergleich je Schiff einmal');
    assert(T.gkMk(1e5, 0, 4e8, 'X', 'Y').lvl === 'bad' && T.gkMk(1e5, 0, 2.5e8, 'X', 'Y').lvl === 'warn' && T.gkMk(1e5, 0, 2e8, 'X', 'Y').lvl === 'ok', 'FF6: Ampel aus EHP + Ladung');
    // EF3: Kurier – Collateral als Ladungswert, Ampel + Filter „nur gank-sicher“, Ampel in der Watchlist
    const rows = [{ id: 1, col: 3e6, rew: 1e6, j: 5, sec: 0.9, vol: 10 }, { id: 2, col: 12e6, rew: 1e6, j: 5, sec: 0.9, vol: 10 }];
    const all = T.coShown({ ship: 'Prüfschiff A', gk: false, last: { rows }, reg: [] }).length, safe = T.coShown({ ship: 'Prüfschiff A', gk: true, last: { rows }, reg: [] }).map(r => r.id);
    assert(all === 2 && safe.join() === '1', 'EF3: „nur gank-sicher“ blendet 12 Mio Collateral (3200 ISK/EHP) aus, 3 Mio bleibt');
    w.localStorage.setItem('eve-zentrale-courier-v1', JSON.stringify({ ship: 'Prüfschiff A', reg: [10000002] }));
    const ck = T.ckRowHtml2({ id: 9, src: 'merk', st: 'gemerkt', from: 'A', to: 'B', col: 12e6, rew: 1e6, vol: 5 }, true);
    assert(/pill gk gk-bad/.test(ck), 'EF3: Watchlist-Kurier zeigt die Ampel für das Kurier-Schiff');
    // EF4: Route – gefährlichste Systeme (Gank-Liste vor Sicherheit) + Ampel der laufenden Ladung
    const rc = { sys: { 1: { n: 'Jita', s: 0.95 }, 2: { n: 'Uedama', s: 0.5 }, 3: { n: 'Tama', s: 0.3 }, 4: { n: 'Hek', s: 0.5 } } };
    const dz = T.rtDanger([1, 2, 3, 4], rc);
    assert(dz[0].n === 'Uedama' && dz[1].n === 'Tama' && dz.length === 2, 'EF4: Uedama (Gank-Liste) vor Tama (0,3), sichere Systeme nicht');
    assert(/Uedama \(0\.5, Gank-System\)/.test(T.rtDangerTxt(dz)), 'EF4: Text mit Sicherheit und Grund');
    assert(/^Ladung /.test(T.rtCargoHtml()) && /pill gk/.test(T.rtCargoHtml()), 'EF4: Ampel der laufenden Ladung');
    // X3: Schiffsbonus aus Dogma-Effekt (wie Bustard: −4 % Schild-Resistenz je Stufe des 2. Schiffs-Skills)
    const of = w.fetch;
    w.fetch = (u) => /dogma\/effects\/5881/.test(String(u)) ? json({ effect_id: 5881, name: 'eliteIndustrialShieldResists2', modifiers: [271, 272, 273, 274].map(id => ({ func: 'ItemModifier', modified_attribute_id: id, modifying_attribute_id: 808 })) }) : of(u);
    const SA = await T.fitShipA({ a: { 271: 1, 272: 0.5, 273: 0.3, 274: 0.2, 808: -4, 182: 3342, 183: 19719 }, eff: [5881] }, null);
    const SB = await T.fitShipA({ a: { 271: 1, 272: 0.5, 273: 0.3, 274: 0.2, 808: -4, 182: 3342, 183: 19719 }, eff: [5881] }, { 19719: 2 });
    w.fetch = of;
    assert(near(SA[271], 0.8) && near(SA[274], 0.16) && near(SB[271], 0.92), 'X3: Schild-Resistenz-Bonus – Stufe V −20 %, Stufe 2 −8 %');
    // HZ1: Grund statt leerer Ampel, Haken meldet nicht berechenbar, Overlay-Ampel, Text an der Grenze
    assert(/kein Schiff erkannt/.test(T.gkWhy('')) && /Gank: \?/.test(T.gkOptPill(null, '', 5e6)), 'HZ1: ohne Schiff – Grund statt nichts');
    assert(/Gank: \?/.test(T.gkWarnEl('', 5e6).innerHTML), 'HZ1: Zeile unter dem Vorschlag zeigt den Grund');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 2000 }));
    const cw = await T.gkCap('is', 50e6, '');
    assert(cw.budget === 50e6 && cw.why && /nicht möglich/.test(T.gkCapTxt2(cw)), 'HZ1: Haken an, kein Schiff → volles Budget + Meldung');
    assert(/pill gk gk-ok/.test(T.gkOptPill({ name: 'Charon (Caldari)', fit: '3× Bulkheads', ehp: 1e6 }, '', 1e9)), 'HZ1: Overlay-Ampel für automatisch gewähltes Schiff');
    assert(T.gkOptPill(null, '', 0) === '', 'HZ1: ohne Ladung keine Ampel');
    assert(/riskant/.test(T.gkPill2(T.gkMk2(1000, 0, 3e6, 'X', 'y'))) && /Gank: sicher/.test(T.gkPill2(T.gkMk2(1000, 0, 2e6, 'X', 'y'))), 'Ampel: 3000 = riskant, 2000 = sicher');
    w.localStorage.setItem('eve-zentrale-gksafe-v1', JSON.stringify({ is: 2000 }));
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
