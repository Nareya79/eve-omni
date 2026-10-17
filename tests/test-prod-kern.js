// 15.10.2026 PROD P1: Rechenkern Produktions-Planer gegen die Discord-Beispiele (Caldari Shuttle 764,47 / Inertial Stabilizers I 841,22),
// Material-Rundung ME 0/10, Strukturbonus, mehrere Läufe, Rig-Faktor, Break-even-Probe, Vergleich „Material verkaufen“, Datencheck
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const r2 = x => Math.round(x * 100) / 100;
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true }).window;
(async () => {
  try{
    await tick(800);
    const P = w.__test.pd, D = P.data(), byName = {};
    Object.keys(D.t).forEach(k => { byName[D.t[k][0]] = +k; });
    const recOf = n => D.r.filter(r => r[1] === byName[n])[0];
    // Datencheck
    assert(D.r.length >= 3500 && /SDE \d+/.test(D.v), 'Rezeptdaten: ' + D.r.length + ' Rezepte, Stand ' + D.v);
    const sh = recOf('Caldari Shuttle'), st = recOf('Inertial Stabilizers I');
    assert(sh && sh.length === 6 && sh[4] === 34 && sh[5] === 2778, 'Caldari Shuttle: 2.778 Tritanium (Grundmenge)');
    assert(st && st.slice(4).join() === '34,1786,35,304,36,1', 'Inertial Stabilizers I: 1.786 Tritanium, 304 Pyerite, 1 Mexallon');
    const azbel = P.FAC.azbel;
    assert(azbel.slice(1).join() === '1,20,4', 'Azbel: 1 % Material, 20 % Zeit, 4 % ISK');
    const base = { runs: 1, me: 0, te: 0, fac: azbel, rig: [0, 0, 0], secF: 1, sci: 0.0247, tax: 0.019 };
    // Testfall 1
    let z = P.calc(Object.assign({ rec: sh, adj: { 34: 9242.58 / 2778 } }, base));
    assert(r2(z.eiv) === 9242.58 && r2(z.gross) === 228.29 && r2(z.bonus) === 9.13 && r2(z.jobBase) === 219.16, 'Shuttle: EIV 9.242,58, Grundkosten 228,29, Bonus 9,13, gesamt 219,16');
    assert(r2(z.facTax) === 175.61 && r2(z.scc) === 369.70 && r2(z.taxes) === 545.31, 'Shuttle: Anlagensteuer 175,61, SCC 369,70, Steuern 545,31');
    assert(r2(z.job) === 764.47, 'Shuttle: Gesamtkosten Job 764,47');
    assert(z.mats[0].q === 2751, 'Shuttle: Einkauf 2.751 Tritanium (nach 1 % Azbel-Bonus)');
    // Testfall 2
    z = P.calc(Object.assign({ rec: st, adj: { 34: 5942.13 / 1786, 35: 4186.26 / 304, 36: 42.12 } }, base));
    assert(r2(z.eiv) === 10170.51 && r2(z.gross) === 251.21 && r2(z.bonus) === 10.05 && r2(z.jobBase) === 241.16, 'Stabilizers: EIV 10.170,51, Grundkosten 251,21, Bonus 10,05, gesamt 241,16');
    assert(r2(z.facTax) === 193.24 && r2(z.scc) === 406.82 && r2(z.taxes) === 600.06 && r2(z.job) === 841.22, 'Stabilizers: Steuer 193,24, SCC 406,82, Steuern 600,06, Gesamt 841,22');
    assert(z.mats.map(m => m.q).join() === '1769,301,1', 'Stabilizers: Einkauf 1.769 / 301 / 1');
    // Rundung + Läufe
    const npc = P.FAC.npc;
    z = P.calc({ rec: sh, runs: 10, me: 10, fac: npc, adj: {}, sci: 0.01 });
    assert(z.mats[0].q === 25002, 'ME 10, 10 Läufe, NPC: 2778 × 10 × 0,9 = 25.002');
    z = P.calc({ rec: sh, runs: 10, me: 10, fac: azbel, adj: {}, sci: 0.01 });
    assert(z.mats[0].q === 24752, 'ME 10, 10 Läufe, Azbel: 24.751,98 → 24.752');
    z = P.calc({ rec: st, runs: 10, me: 10, fac: azbel, adj: {}, sci: 0.01 });
    assert(z.mats[2].q === 10, 'Mindestens 1 je Lauf: Mexallon 8,91 → 10 bei 10 Läufen');
    const fake = [1, 2, 1, 100, 34, 1000];
    assert(211 * 0.9 * 0.99 > 188, '211 × 0,9 × 0,99 = 188,001 …');
    assert(P.calc({ rec: [1, 2, 1, 100, 34, 211], me: 10, fac: azbel, adj: {} }).mats[0].q === 188, '… erst auf 2 Stellen gerundet (188,00), dann aufgerundet → 188 (nicht 189)');
    z = P.calc({ rec: sh, runs: 3, fac: azbel, adj: { 34: 9242.58 / 2778 }, sci: 0.0247, tax: 0.019 });
    assert(r2(z.eiv) === r2(3 * 9242.58) && z.units === 3, '3 Läufe: EIV dreifach, 3 Stück');
    // Rig-Faktor nach Sicherheit
    z = P.calc({ rec: fake, fac: npc, rig: [2, 0, 0], secF: P.SEC.low[1], adj: {} });
    assert(z.mats[0].q === 962 && P.SEC.low[1] === 1.9 && P.SEC.null[1] === 2.1 && P.SEC.wh[1] === 2.1, 'Rig 2 % im Lowsec = 3,8 % → 962');
    z = P.calc({ rec: fake, fac: azbel, te: 20, rig: [0, 10, 0], secF: 1, adj: {} });
    assert(Math.abs(z.time - 100 * 0.8 * 0.8 * 0.9) < 1e-9, 'Zeit: Basis × (1 − TE) × Strukturbonus × Rig');
    // Gewinn, Break-even, Vergleich
    const fee = { tax: 0.03375, brk: 0.015 };
    const o = Object.assign({ rec: sh, adj: { 34: 3.327 }, buy: { 34: 4 }, matSell: { 34: 3.5 }, fee: fee, sellOrder: true, prodPx: 20000 }, base);
    z = P.calc(o);
    const net = 1 - fee.tax - fee.brk;
    assert(Math.abs(z.rev - 20000 * net) < 1e-6 && Math.abs(z.mat - 2751 * 4) < 1e-9, 'Erlös netto nach Steuer + Makler, Material 2.751 × 4');
    assert(Math.abs(z.profit - (z.rev - z.mat - z.job)) < 1e-9 && Math.abs(z.unit - z.profit) < 1e-9 && Math.abs(z.roi - z.profit / (z.mat + z.job)) < 1e-12, 'Gewinn, je Stück, ROI');
    const be = P.calc(Object.assign({}, o, { prodPx: z.be }));
    assert(Math.abs(be.profit) < 1e-6, 'Break-even-Preis ' + z.be.toFixed(2) + ' → Gewinn 0');
    assert(P.calc(Object.assign({}, o, { prodPx: P.priceUp(z.be) })).profit >= 0 && P.priceUp(z.be) >= z.be && P.priceUp(12345.67) === 12350, 'Break-even auf gültigen EVE-Preis aufgerundet (4 Stellen)');
    assert(Math.abs(z.vsSell - (z.rev - z.job - 2751 * 3.5)) < 1e-9, 'Vergleich: Herstellen − Material direkt verkaufen');
    z = P.calc(Object.assign({}, o, { sellOrder: false }));
    assert(Math.abs(z.rev - 20000 * (1 - fee.tax)) < 1e-6, 'Sofort verkaufen: nur Steuer, kein Makler');
    // habe ich schon → Wert zum Jita-Kaufpreis
    z = P.calc(Object.assign({}, o, { have: { 34: 1 }, haveVal: { 34: 3 } }));
    assert(Math.abs(z.mat - 2751 * 3) < 1e-9 && z.mats[0].have, '„habe ich schon“: Material zum Jita-Kaufpreis bewertet');
    // fehlende Preise nicht als 0
    z = P.calc(Object.assign({}, o, { buy: {} }));
    assert(z.mat === null && z.profit === null && z.mats[0].px === null && z.missBuy === 1, 'Fehlender Materialpreis → kein Gewinn statt 0');
    z = P.calc(Object.assign({}, o, { adj: {} }));
    assert(z.job === null && z.eiv === null, 'Fehlender adjusted price → Job-Kosten unbekannt');
    z = P.calc(Object.assign({}, o, { prodPx: null }));
    assert(z.rev === null && z.profit === null && z.be !== null, 'Fehlender Produktpreis → Gewinn unbekannt, Break-even bleibt');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
