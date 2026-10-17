// Gank-Fitting (14.10.2026): Programm schickt Accept-Language de → ESI-Kategorie „Schiff“ statt „Ship“, kein Schiff wurde erkannt.
// (1) Schiff im All (AutoFit) mit Fitting + Ladung wird als Schiff erkannt, (2) Lauf merkt Fitting + EHP des Vorschlags → Route = Vorschlag,
// (3) alter Lauf ohne Felder → „Fitting unbekannt“ statt rot, (4) gkAsShip nimmt asD, wenn die gespeicherte Kopie fehlt
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const at = o => Object.keys(o).map(k => ({ attribute_id: +k, value: o[k] }));
const HULL = { 9: 1000, 263: 1000, 265: 1000, 267: 1, 268: 1, 269: 1, 270: 1, 271: 1, 272: 1, 273: 1, 274: 1, 109: 1, 110: 1, 111: 1, 113: 1, 12: 4, 13: 2, 14: 1 };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const IDS = { charon: 20185, 'prüfschiff y': 777 };
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if (/universe\/ids/.test(u)) return json({ inventory_types: JSON.parse(o.body).map((n, i) => ({ id: IDS[n.toLowerCase()] || 900000 + i, name: n })) });
      if ((m = /universe\/categories\/(\d+)/.exec(u))) return json({ category_id: +m[1], name: +m[1] === 6 ? (/language=en/.test(u) ? 'Ship' : 'Schiff') : 'Module' });   // ohne language=en wie im Programm (Accept-Language de)
      if ((m = /universe\/groups\/(\d+)/.exec(u))) return json({ group_id: +m[1], category_id: +m[1] === 513 ? 6 : 7, name: 'G' });
      if ((m = /universe\/types\/(\d+)/.exec(u))) return json(+m[1] === 1335 ? { name: 'Reinforced Bulkheads II', group_id: 300, volume: 5, packaged_volume: 5, dogma_attributes: [], dogma_effects: [] }
        : +m[1] === 34 ? { name: 'Tritanium', group_id: 301, volume: 0.01, packaged_volume: 0.01 }
        : { name: +m[1] === 20185 ? 'Charon' : 'Rumpf', group_id: 513, volume: 1300000, packaged_volume: 1300000, mass: 1e7, capacity: 5000, dogma_attributes: at(HULL), dogma_effects: [] });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test;
    // (1) echte ESI-Form (14.10.): Charon im All mit location_flag „AutoFit“, Module/Ladung zeigen auf das Schiff
    const A = [
      { is_singleton: true, item_id: 1, location_flag: 'AutoFit', location_id: 30002763, location_type: 'solar_system', quantity: 1, type_id: 20185 },
      { is_singleton: true, item_id: 2, location_flag: 'LoSlot0', location_id: 1, location_type: 'item', quantity: 1, type_id: 1335 },
      { is_singleton: true, item_id: 3, location_flag: 'LoSlot1', location_id: 1, location_type: 'item', quantity: 1, type_id: 1335 },
      { is_singleton: true, item_id: 4, location_flag: 'LoSlot2', location_id: 1, location_type: 'item', quantity: 1, type_id: 1335 },
      { is_singleton: false, item_id: 5, location_flag: 'Cargo', location_id: 1, location_type: 'item', quantity: 6341, type_id: 34 }
    ].map(a => Object.assign({ _charId: 1, _charName: 'Testpilot' }, a));
    const D = await T.asBuild(A, false, () => {});
    const L = D.g[0].locs.find(l => l.id === '30002763'), rows = L ? L.rows : [];
    const ship = rows.find(r => r.tid === 20185);
    assert(L && rows.length === 1 && ship && ship.ship, '(1) Schiff im All wird als Schiff erkannt – Inhalt steht nicht lose beim Ort');
    const sl = Object.fromEntries(ship.ship.sl.map(x => [x[0], x[1]]));
    assert(sl.Low && sl.Low[0][0] === 1335 && sl.Low[0][2] === 3 && sl.Fracht && sl.Fracht[0][2] === 6341, '(1) Fitting (3× Bulkheads) und Ladung stehen beim Schiff');
    assert(/^\[Charon/.test(ship.ship.eft || '') && /Reinforced Bulkheads II/.test(ship.ship.eft), '(1) „Fit kopieren“ (EFT) enthält die Module');
    // (2) Lauf merkt Fitting + EHP des Vorschlags; Route zeigt dieselbe ISK/EHP wie der Vorschlag
    const opt = { name: 'Charon', cap: 900000, fit: '3× Reinforced Bulkheads II', mods: [[1319, 0], [1335, 3]], ehp: 456637, budget: 1e9, safe: 1e9 };
    const items = [{ tid: 34, name: 'Tritanium', q: 1000, p: 1, sp: 913e6 }];
    const run = T.hrAdd(60011866, 'Dodixie', 60003760, 'Jita', items, 'is', opt);
    assert(run.ship === 'Charon' && run.fit === opt.fit && run.ehp === opt.ehp, '(2) Lauf speichert Schiff, Fitting und EHP');
    const stored = T.hrLoad().find(r => r.id === run.id);
    assert(stored.fit === opt.fit && stored.ehp === opt.ehp, '(2) Fitting + EHP stehen im gespeicherten Lauf');
    const num = s => (/(\d[\d.,]*) ISK\/EHP<\/span>/.exec(s) || [])[1];
    const vor = T.gkOptPill(opt, 'Charon', 913e6), route = T.gkRunPill(run.id);
    assert(num(vor) && num(vor) === num(route) && /gk-ok/.test(route) && /3× Reinforced Bulkheads II/.test(route), '(2) Route = Vorschlag: ' + num(vor) + ' / ' + num(route) + ' ISK/EHP');
    // Name statt Objekt (alte Aufrufer) geht weiter
    assert(T.hrAdd(1, 'A', 2, 'B', items, 'is', 'Charon').ship === 'Charon', '(2) hrAdd mit Schiffsnamen geht weiter');
    // (3) alter Lauf ohne fit/ehp, Schiff nicht in den Assets → „Fitting unbekannt“ statt rotem Gank-Ziel
    const old = { id: 'alt-1', from: 1, fromName: 'Dodixie', to: 2, toName: 'Jita', charId: '1', items: [{ tid: 34, name: 'Tritanium', q: 1000, p: 1, sp: 913e6 }], created: Date.now(), status: 'active', ship: 'Prüfschiff X' };
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([old].concat(T.hrLoad())));
    let p = T.gkRunPill('alt-1');
    for (let i = 0; i < 60 && /Gank …/.test(p); i++){ await tick(50); p = T.gkRunPill('alt-1'); }
    assert(/Fitting unbekannt – Assets laden/.test(p) && !/gk-bad|Gank-Ziel/.test(p), '(3) alter Lauf lädt und zeigt „Fitting unbekannt“ statt rot: ' + p.replace(/title="[^"]*"/, ''));
    // (4) gkAsShip: gespeicherte Kopie fehlt → asD aus dem Speicher
    T.lcSave('assets', null); w.localStorage.removeItem('eve-zentrale-listcache-v1');
    T.setAsD({ g: [{ locs: [{ rows: [{ tid: 777, ship: { id: 9, fv: 0, sl: [['Low', [[1335, 'Reinforced Bulkheads II', 2]]]] } }] }] }] });
    assert(T.gkAsShip(777) && T.gkAsShip(777).id === 9, '(4) gkAsShip nimmt asD, wenn die gespeicherte Kopie fehlt');
    // neue Assets löschen den 10-Min.-Zwischenspeicher der EHP (vorher blieb „Rumpf ohne Module“ stehen)
    T.setAsD(null);
    const wait = async nm => { T.gkCalc(nm, 1e6); for (let i = 0; i < 60; i++){ await tick(50); const g = T.gkCalc(nm, 1e6); if (g && !g.busy) return g; } return null; };
    assert((await wait('Prüfschiff Y')).src === 'Rumpf ohne Module', '(4) ohne Assets: Rumpf');
    T.asRender({ v: false, n: 1, g: [{ cid: '1', name: 'Testpilot', locs: [{ id: '60003760', name: 'Jita', rows: [{ tid: 777, name: 'Rumpf', qty: 1, ship: { id: 9, fv: 0, sl: [['Low', [[1335, 'Reinforced Bulkheads II', 2]]]] } }] }] }] });
    assert((await wait('Prüfschiff Y')).src === 'Fitting aus dem Hangar', '(4) nach „Assets laden“ sofort Fitting aus dem Hangar');
    console.log('ALL GANK-FITTING TESTS PASSED');
  }catch(e){ console.error(e); console.log('FAILED: ' + e.message); }
  process.exit(0);
})();
