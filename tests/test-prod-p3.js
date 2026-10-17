// 17.10.2026 PROD P3: Reaktionen, Kopieren, Forschen, Erfindung + Nachrechnen an echten Jobs (ESI „cost“).
// Erfindung gegen den echten Job des Nutzers (16.10., 75mm Gatling Rail II: EIV 189.900, Index 0,14 %, Steuer 0,25 %, SCC 4 % → 5 + 9 + 152 = 166 ISK).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(800);
    const P = w.__test.pd, D = P.data(), byName = {};
    Object.keys(D.t).forEach(k => { byName[D.t[k][0]] = +k; });
    const recOf = n => D.r.filter(r => r[1] === byName[n])[0];
    // Daten
    assert(D.x.length >= 100 && D.i.length >= 500 && D.c.length === D.r.length && Object.keys(D.d).length === 8, 'Daten: ' + D.x.length + ' Reaktionen, ' + D.i.length + ' Erfindungen, Kopier-/Forschungszeiten, 8 Decryptoren');
    const g1 = recOf('75mm Gatling Rail I'), g2 = recOf('75mm Gatling Rail II'), iv = D.ivBy[g1[0]][0];
    assert(iv[1] === g2[0] && iv[2] === 10 && iv[4] === 34 && D.t[iv[5]][0] === 'Gallente Encryption Methods', 'Erfindung Gatling Rail: Grundchance 34 %, Kopie mit 10 Läufen, Gallente Encryption Methods');
    assert(D.d[34201].join() === '1.2,2,10,1' && D.d[34208].join() === '0.9,2,0,7', 'Decryptoren aus den Spieldaten (Accelerant ×1,2 ME+2 TE+10 +1; Optimized Augmentation ×0,9 ME+2 +7)');
    assert(D.rx[recOf('Fullerides') ? 0 : D.x.filter(r => r[1] === byName['Fullerides'])[0][0]], 'Fullerides ist eine Reaktion');
    // Kostenindex, Preise
    const sid = 30000142, S = P.sci(); S.t = Date.now(); S.m[sid] = 0.02; S.a = { invention: { [sid]: 0.0014 }, copying: { [sid]: 0.01 }, researching_material_efficiency: { [sid]: 0.01 }, researching_time_efficiency: { [sid]: 0.01 }, reaction: { [sid]: 0.03 } };
    const scale = (rec, eiv) => { let b = 0; for (let i = 4; i < rec.length; i += 2) b += rec[i + 1]; for (let i = 4; i < rec.length; i += 2) P.adj[rec[i]] = eiv / b; };
    scale(g2, 189900); scale(g1, 10000);
    const prof = { n: 'NPC', f: 'npc', sys: 'Jita', sid, sec: 'high', tax: 0.25, rig: [0, 0, 0] };
    const d = Object.assign(P.load(), { prof: [prof], cur: 0, invN: 1, dec: '', ivT: 0, invChar: '', cRuns: 10, cN: 1, me: 0, meTo: 10, te: 0, teTo: 20 });
    // Erfindung = echter Nutzer-Job
    let z = P.act(d, { rec: g1 }, 'inv', prof);
    assert(Math.round(z.base) === 3798 && Math.round(z.gross) === 5 && Math.round(z.facTax) === 9 && Math.round(z.scc) === 152 && Math.floor(z.job) === 166, 'Erfindung wie im Spiel: Grundwert 3.798, Index 5, Steuer 9, SCC 152, gesamt 166 ISK (' + z.job.toFixed(2) + ')');
    assert(Math.abs(z.chance - 0.34) < 1e-9 && z.out.runs === 10 && z.out.me === 2 && z.out.te === 4, 'ohne Skills/Decryptor: 34 %, Kopie 10 Läufe, ME 2, TE 4');
    assert(Math.abs(P.chance(iv, [4, 4, 4], D.d[34201]) - 0.34 * (1 + 8 / 30 + 4 / 40) * 1.2) < 1e-9, 'Chance mit Skills 4/4/4 und Accelerant');
    P.px()[iv[8]] = { t: Date.now(), s: 1000, b: 900 }; P.px()[iv[10]] = { t: Date.now(), s: 2000, b: 1900 }; P.px()[34201] = { t: Date.now(), s: 500000, b: 1 };
    z = P.act(Object.assign({}, d, { dec: '34201', invN: 10 }), { rec: g1 }, 'inv', prof);
    assert(z.mat === 10 * 1000 + 10 * 2000 + 10 * 500000 && z.mats.length === 3, 'Material: Datenkerne + Decryptor je Versuch');
    assert(z.out.runs === 11 && z.out.me === 4 && z.out.te === 14 && Math.abs(z.chance - 0.408) < 1e-9, 'Accelerant: 11 Läufe, ME 4, TE 14, Chance 40,8 %');
    assert(z.copy > 0 && Math.abs(z.perBpc - z.total / (10 * 0.408)) < 1e-6 && Math.abs(z.perRun - z.perBpc / 11) < 1e-9, 'Kosten je Kopie und je T2-Lauf (inkl. T1-Kopien)');
    // Kopieren / Forschen
    z = P.act(d, { rec: g1 }, 'copy', prof);
    assert(Math.abs(z.base - 0.02 * 10000 * 10) < 1e-6 && Math.abs(z.job - z.base * (0.01 + 0.0025 + 0.04)) < 1e-6, 'Kopieren: 2 % × EIV × Läufe × Kopien, × (Index + Steuer + SCC)');
    assert(Math.abs(P.rf(0, 10) - 441679 / 105) < 1e-9 && Math.abs(P.rf(0, 1) - 1) < 1e-9, 'Forschung Stufenfaktor 1 … 4.206,5 (Stufe 0 → 10)');
    z = P.act(Object.assign({}, d, { me: 5, meTo: 10 }), { rec: g1 }, 'me', prof);
    assert(z.from === 5 && z.to === 10 && Math.abs(z.base - 0.02 * 10000 * P.rf(5, 10)) < 1e-6, 'ME 5 → 10');
    z = P.act(Object.assign({}, d, { te: 4, teTo: 10 }), { rec: g1 }, 'te', prof);
    assert(z.from === 4 && z.to === 10 && Math.abs(z.base - 0.02 * 10000 * P.rf(2, 5)) < 1e-6, 'TE 4 → 10 (Stufen 3–5)');
    // Reaktion: Index „reaction“, kein ME, Tatara −25 % Zeit
    const rxr = D.x.filter(r => r[1] === byName['Fullerides'])[0];
    const tat = { n: 'T', f: 'tatara', sys: 'X', sid, sec: 'null', tax: 0, rig: [2, 20, 0] };
    const inr = P.inputs(Object.assign({}, d, { me: 10 }), { rec: rxr }, 5, undefined, undefined, tat);
    assert(inr.rx && inr.me === 0 && inr.sci === 0.03 && inr.fac[2] === 25 && inr.secF === 1.1, 'Reaktion: eigener Index, kein ME, Tatara Zeit −25 %, Rig-Faktor Nullsec 1,1');
    z = P.calc(inr);
    assert(z.mats[0].q === Math.max(5, Math.ceil(Math.round(rxr[5] * 5 * (1 - 2 * 1.1 / 100) * 100) / 100)), 'Reaktion: Material nur mit Rig-Bonus');
    // Nachrechnen an echten Jobs
    const loc = 60003760; P.loc()[loc] = sid;
    const calcCopy = 0.02 * 10000 * 10 * 2 * (0.01 + 0.0025 + 0.04);
    const job = (q, extra) => Object.assign({ a: 5, bp: g1[0], bi: 1, p: g1[0], r: 2, lr: 10, c: calcCopy * q, loc, ch: '1', s: Date.now() - 864e5, st: 'delivered' }, extra);
    P.setInD({ jh: [job(1.02), job(0.99)], bps: [] }); P.calibReset();
    let c = P.check('copy');
    assert(c.n === 2 && c.k === 1 && Math.abs(c.med - 1.005) < 1e-9, 'Abgleich: 2 Jobs passen (±2 %) → geprüft, kein Ausgleich');
    P.setInD({ jh: [job(1.2), job(1.2), job(1.25), job(1, { s: Date.now() - 40 * 864e5 }), job(1, { loc: 1030000000000 })], bps: [] }); P.calibReset();
    c = P.check('copy');
    assert(c.n === 3 && c.skip === 1 && Math.abs(c.k - 1.2) < 1e-9, 'Abgleich: 20 % teurer → Ausgleich ×1,2; alte Jobs zählen nicht, Upwell ohne Profil wird übersprungen');
    z = P.act(d, { rec: g1 }, 'copy', prof);
    assert(Math.abs(z.job - 0.02 * 10000 * 10 * 0.0525 * 1.2) < 1e-6 && Math.abs(z.k - 1.2) < 1e-9, 'Rechnung „Kopieren“ an den Jobs ausgerichtet');
    P.setInD({ jh: [{ a: 4, bp: g1[0], bi: 77, r: 3, c: 0.02 * 10000 * P.rf(2, 5) * 0.0525, loc, ch: '1', s: Date.now(), st: 'delivered' }], bps: [{ i: '77', t: g1[0], me: 5, te: 0 }] }); P.calibReset();
    c = P.check('me');
    assert(c.n === 1 && Math.abs(c.med - 1) < 1e-9, 'Forschung ME: fertiger Job 2 → 5 aus der Blaupause (jetzt ME 5) nachgerechnet');
    // Oberfläche: Tätigkeit, Erfindung, T2-Kasten, Reaktion
    const box = w.document.createElement('div'); w.document.body.appendChild(box);
    const show = dd => { P.save(dd); box.innerHTML = ''; P.view(box, true); return box.textContent; };
    let t = show(Object.assign({}, d, { pick: { b: g1[0] }, act: 'inv' }));
    assert(/Herstellung/.test(t) && /Kopieren/.test(t) && /Forschen ME/.test(t) && /Kosten je T2-Lauf/.test(t) && /Chance je Versuch/.test(t) && /Decryptor/.test(t), 'Ansicht Erfindung mit Tätigkeiten, Chance, Kosten je T2-Lauf');
    assert(/Geprüft|Geschätzt|nachrechenbar|Abgleich/.test(t), 'Ansicht zeigt den Abgleich mit echten Jobs');
    t = show(Object.assign({}, d, { pick: { b: g2[0] }, act: 'mfg', invAdd: true }));
    assert(/Blaupause aus Erfindung/.test(t) && /Erfindung je T2-Lauf/.test(t) && /Material, Job und Erfindung/.test(t), 'T2-Herstellung: Kasten „Blaupause aus Erfindung“, Kosten einrechenbar');
    t = show(Object.assign({}, d, { pick: { b: rxr[0] }, act: 'mfg' }));
    assert(/Reaktion/.test(t) && /nur in Athanor oder Tatara/.test(t) && !/ME/.test(box.querySelector('.pd-in').textContent), 'Reaktion: Hinweis Athanor/Tatara, kein ME-Feld');
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e); console.log('P3 FAILED'); process.exit(1); }
})();
