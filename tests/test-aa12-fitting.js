// AA12 (30.09.2026): Fitting-Werte (Näherung aus Dogma + Skills), Stacking-Penalty, EFT lesen, Kernwerte am Schiff in den Assets (Overlay + Seite),
// Vergleich A/B im großen Fenster (Assets › Fittings) mit Farben, Preis Jita und Versicherung
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6) * Math.max(1, Math.abs(b));
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const at = o => Object.keys(o).map(k => ({ attribute_id: +k, value: o[k] }));
const TY = {
  24698: { name: 'Drake', mass: 13500000, capacity: 450, a: { 9: 3750, 11: 830, 12: 4, 13: 6, 14: 7, 37: 150, 48: 500, 70: 0.65, 109: 0.67, 110: 0.67, 111: 0.67, 113: 0.67, 263: 5500, 265: 3250, 267: 0.5, 268: 0.9, 269: 0.75, 270: 0.55, 271: 1, 272: 0.5, 273: 0.6, 274: 0.8, 552: 295, 600: 3.5, 1137: 3, 1281: 1 } },
  3841: { name: 'Large Shield Extender II', a: { 30: 160, 50: 45, 72: 2600, 983: 25 }, e: [13] },
  2048: { name: 'Damage Control II', a: { 30: 1, 50: 30, 267: 0.85, 268: 0.85, 269: 0.85, 270: 0.85, 271: 0.875, 272: 0.875, 273: 0.875, 274: 0.875, 974: 0.6, 975: 0.6, 976: 0.6, 977: 0.6 }, e: [11] },
  2605: { name: 'Nanofiber Internal Structure II', a: { 50: 40, 150: 0.8, 169: -15.75, 1076: 9.5 }, e: [11] },
  1319: { name: 'Expanded Cargohold II', a: { 149: 1.275, 150: 0.77, 306: 0.82 }, e: [11] },
  31790: { name: 'Medium Core Defense Field Extender I', a: { 337: 15 }, e: [2663] }
};
const IDS = { drake: 24698, 'large shield extender ii': 3841, 'damage control ii': 2048, 'nanofiber internal structure ii': 2605, 'expanded cargohold ii': 1319, 'medium core defense field extender i': 31790 };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-insurance-v1', JSON.stringify({ t: Date.now(), p: { 24698: [['Basic', 2e6, 20e6], ['Platinum', 15e6, 50e6]] } }));
    w.fetch = (u, o) => { u = String(u); let m;
      if (/universe\/ids/.test(u)) return json({ inventory_types: JSON.parse(o.body).filter(n => IDS[n.toLowerCase()]).map(n => ({ id: IDS[n.toLowerCase()], name: n })) });
      if ((m = /universe\/types\/(\d+)/.exec(u))){ const t = TY[m[1]]; return t ? json({ type_id: +m[1], name: t.name, mass: t.mass || 100, capacity: t.capacity || 0, volume: 5, packaged_volume: 5, dogma_attributes: at(t.a), dogma_effects: (t.e || []).map(e => ({ effect_id: e, is_default: false })) }) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }); }
      if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))) return json([{ is_buy_order: false, location_id: 60003760, system_id: 30000142, range: 'region', price: +m[1] === 24698 ? 50e6 : 1e6, volume_remain: 100, min_volume: 1 }]);
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    // Stacking-Penalty
    assert(near(T.fitStack([1.1]), 1.1) && near(T.fitStack([1.1, 1.1]), 1.1 * (1 + 0.1 * Math.exp(-Math.pow(1 / 2.67, 2)))) && near(T.fitStack([0.8, 1.1]), 0.8 * 1.1), 'AA12: Stacking-Penalty je Richtung (2. Modul ≈ 87 %)');
    // EFT lesen
    const EFT = '[Drake, Tank]\nDamage Control II\nNanofiber Internal Structure II\nNanofiber Internal Structure II /OFFLINE\n[Empty Low slot]\n\nLarge Shield Extender II\nLarge Shield Extender II\n\nHeavy Missile Launcher II, Scourge Heavy Missile\n\nMedium Core Defense Field Extender I\n\n\nHobgoblin II x5\nScourge Heavy Missile x1000';
    const P = T.fitParseEft(EFT);
    assert(P.ship === 'Drake' && P.name === 'Tank' && P.mods.length === 7 && P.mods.indexOf('Heavy Missile Launcher II') >= 0 && !P.mods.some(m => /Hobgoblin|Empty|OFFLINE/.test(m)), 'AA12: EFT – Schiff, Module ohne Munition/OFFLINE, Drohnen/Fracht zählen nicht');
    assert(T.fitParseEft('Tritanium 100') === null, 'AA12: kein EFT erkannt');
    // Rechenkern, alle Skills V
    const R = await T.fitFromEft(EFT, null);
    const agi = 0.65 * T.fitStack([1 - 0.1575, 1 - 0.1575]) * 0.75 * 0.9;
    assert(near(R.align, 13.5e6 * agi * 1e-6 * Math.log(4)), 'AA12: Ausrichtzeit mit Nanofibern (Penalty) + Evasive/Spaceship Command V');
    assert(near(R.speed, 150 * 1.25 * T.fitStack([1.095, 1.095])) && near(R.warp, 3.5) && near(R.sig, 345), 'AA12: Speed (Navigation V + Nanofiber), Warp, Signatur + 2× 25 m');
    assert(near(R.hp.s, (5500 + 5200) * 1.25 * 1.15) && near(R.hp.h, 3750 * 0.8 * 0.8 * 1.25), 'AA12: Schild-HP (Extender + Rig + Skill), Rumpf-HP (Nanofiber 0,8)');
    const eS = R.hp.s / ((1 + 0.5 + 0.6 + 0.8) / 4 * 0.875), eA = R.hp.a / ((0.5 + 0.9 + 0.75 + 0.55) / 4 * 0.85), eH = R.hp.h / (0.67 * 0.6);
    assert(near(R.ehp, eS + eA + eH), 'AA12: EHP grob mit Damage Control');
    assert(near(R.cpu[0], 30 + 40 + 40 + 45 + 45) && near(R.cpu[1], 625) && R.unk.join() === 'Heavy Missile Launcher II', 'AA12: CPU belegt/frei (CPU Management V), Unbekanntes gemeldet');
    assert(R.slots[2][1] === 3 && R.slots[1][1] === 2 && R.slots[3][1] === 1, 'AA12: Slots aus den Dogma-Effekten (Low 3, Mid 2, Rig 1)');
    const R0 = await T.fitCalc(24698, [], {});
    assert(near(R0.speed, 150) && near(R0.cpu[1], 500) && near(R0.cargo, 450), 'AA12: ohne Skills = Grundwerte');
    const RC = await T.fitCalc(24698, [1319, 1319], {});
    assert(near(RC.cargo, 450 * 1.275 * 1.275), 'AA12: Laderaum ohne Stacking-Penalty (wie O3)');
    // Kernwerte am Schiff in den Assets
    T.asRender({ v: true, v2: 1, n: 1, g: [{ cid: '111', name: 'Eins', locs: [{ id: '60003760', name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', sys: null, st: null,
      rows: [{ tid: 24698, name: 'Drake', qty: 1, estValue: 50e6, vol: 15000, ship: { id: 7, nm: 'Tanky', eft: EFT, fv: 5e6, sl: [['Mid', [[3841, 'Large Shield Extender II', 2]]], ['Low', [[2048, 'Damage Control II', 1]]]] } }] }] }] });
    const box = d.createElement('div');
    T.asAction({ type: 'asShip', arg: 's7' }); T.ovRenderViewInto('assets', box);
    assert(/Fitting-Werte werden berechnet/.test(box.textContent), 'AA12: Kernwerte werden im Hintergrund gerechnet');
    await tick(300);
    const box2 = d.createElement('div'); T.ovRenderViewInto('assets', box2);
    const fc = box2.querySelector('.fit-core');
    assert(fc && /Laderaum/.test(fc.textContent) && /EHP/.test(fc.textContent) && /Ausrichten/.test(fc.textContent) && fc.querySelector('[data-ova="asFitCmp"][data-arg="7"]'), 'AA12: Kernwerte im Assets-Overlay + ⤢ Vergleichen');
    assert(!box2.querySelector('[data-ova="asTab"][data-arg="fit"]'), 'AA12: kein Vergleich im Overlay');
    // Vergleich im großen Fenster
    await T.asAction({ type: 'asFitCmp', arg: '7' }); await tick(400);
    let D = JSON.parse(w.localStorage.getItem('eve-zentrale-fitcmp-v1'));
    assert(D.a === EFT && D.last && D.last.A && !D.last.B && JSON.parse(w.localStorage.getItem('eve-zentrale-assetview-v1')).ft === 'fit', 'AA12/AL9: ⤢ übernimmt das Fitting als A und öffnet Fittings › Meine Fittings');
    const B = '[Drake, Speed]\nNanofiber Internal Structure II\nNanofiber Internal Structure II\nNanofiber Internal Structure II';
    await T.asAction({ type: 'asFcGo', form: { fca: EFT, fcb: B, fcas: '', fcbs: '', fccid: '' } }); await tick(400);
    D = JSON.parse(w.localStorage.getItem('eve-zentrale-fitcmp-v1'));
    assert(D.last.A && D.last.B && D.last.B.speed > D.last.A.speed && D.last.B.ehp < D.last.A.ehp, 'AA12: B schneller, A mehr EHP');
    assert(near(D.last.A.price, 50e6 + 5 * 1e6) && near(D.last.A.ins, 35e6) && near(D.last.A.loss, D.last.A.price - 35e6) && D.last.A.insLv === 'Platin', 'AA12: Kaufpreis Jita (AA2), beste Versicherung (AA10), Verlust netto');
    const pg = $('fits-page'); $('neo-btn-fits').click();   // AL9: eigener Bereich Fittings
    const t = pg.querySelector('.fc-t');
    assert(t && pg.querySelector('textarea[data-ovf="fca"]') && pg.querySelector('[data-ova="fitTab"][data-arg="fit"][aria-selected="true"]'), 'AA12/AL9: Fittings › Meine Fittings mit zwei Feldern im großen Fenster');
    const row = n => [...t.querySelectorAll('tr')].find(r => r.children[0].textContent.indexOf(n) === 0);
    assert(row('Geschwindigkeit').children[3].className === 'pos' && row('EHP').children[3].className === 'neg' && row('Ausrichtzeit').children[3].className === 'pos', 'AA12: B − A farbig (grün besser, rot schlechter, Ausrichtzeit kleiner = besser)');
    assert(pg.querySelector('select[data-ovf="fcas"] option[value="7"]'), 'AA12: Schiffe aus den Assets wählbar');
    await T.asAction({ type: 'asFcSwap' });
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-fitcmp-v1')).a === B, 'AA12: A/B tauschen');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
