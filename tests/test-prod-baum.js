// 16.10.2026 PROD P2: Bauteile selbst bauen oder kaufen – Stückliste, Rekursion, Zyklenschutz, Tiefe, Einkaufsliste nur Gekauftes,
// Gesamtkosten = Summe der Ebenen, Auto-Wahl nach Preis, Wahl von Hand, echtes Beispielschiff (Revelation), Oberfläche
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true }).window;
(async () => {
  try{
    await tick(800);
    const P = w.__test.pd, d = w.document, D = P.data();
    P.busy(true);   // keine Netzabfragen
    // Testrezepte: A ← 10 B + 100 Trit; B ← 5 Trit + 1 C (2 Stück je Lauf); C ← 1 A (Zyklus) + 2 Pyerite
    const A = 900001, B = 900002, C = 900003, TRIT = 34, PYE = 35;
    const add = (bp, prod, per, mats, name) => { const r = [bp, prod, per, 600].concat(mats); D.r.push(r); D.byBp[bp] = r; D.byProd[prod] = r; D.t[prod] = [name, 0, 0]; };
    add(900101, A, 1, [B, 10, TRIT, 100], 'Test A'); add(900102, B, 2, [TRIT, 5, C, 1], 'Test B'); add(900103, C, 1, [A, 1, PYE, 2], 'Test C');
    Object.assign(P.adj, { [A]: 1000, [B]: 50, [C]: 20, [TRIT]: 4, [PYE]: 8 });
    P.sci().m[30000142] = 0.05; P.sci().t = Date.now();
    const px = P.px(), set = (t, s) => { px[t] = { t: Date.now(), s: s, b: s * 0.9 }; };
    set(A, 5000); set(B, 500); set(C, 100); set(TRIT, 4); set(PYE, 8);
    await P.action({ type: 'pdSrc', arg: 'item' }); await P.action({ type: 'pdPick', arg: 't:900101' });
    let st = P.load(), z = P.plan(st, P.picked(st));
    // Stückliste + Rekursion + Zyklus
    const mB = z.mats.find(m => m.tid === B), mC = mB.sub.mats.find(m => m.tid === C), mA = mC.sub.mats.find(m => m.tid === A);
    assert(mB.sub && mB.q === 10 && mB.sub.runs === 5 && mB.sub.units === 10, 'B: 10 Stück nötig → 5 Läufe zu je 2');
    assert(mC.sub && mC.q === 5 && mC.sub.runs === 5, 'C: 5 Stück für 5 Läufe B');
    assert(!mA.sub, 'Zyklus: A unter C wird nicht noch einmal aufgelöst');
    // Gesamtkosten = Summe der Ebenen
    const sum = t => t.mats.reduce((a, m) => a + (m.build ? m.sub.total : m.sum), t.job);
    assert(near(z.total, sum(z)) && near(mB.sub.total, sum(mB.sub)) && near(mC.sub.total, sum(mC.sub)), 'Gesamtkosten jeder Ebene = Job + Kosten der Materialien (gekauft oder gebaut)');
    // Auto: B kaufen kostet 10 × 500 = 5.000, bauen deutlich weniger → bauen
    assert(mB.build && mB.sub.total < mB.sum && z.anyBuild, 'Auto: B selbst bauen ist günstiger (' + Math.round(mB.sub.total) + ' < ' + mB.sum + ')');
    assert(near(z.cost, z.total) && near(z.allBuy, z.job + 10 * 500 + 100 * 4), 'Ergebnis rechnet mit Bauen; „alles kaufen“ = Job + Material gekauft');
    // Einkaufsliste nur Gekauftes, über alle Ebenen zusammengezählt
    let bl = P.buyList(z);
    assert(!bl[B] && bl[TRIT] === 100 + 25 && (mC.build ? !bl[C] && bl[PYE] === 10 : bl[C] === 5), 'Einkaufsliste: kein B, Tritanium 100 + 25 aus B');
    // Wahl von Hand
    await P.action({ type: 'pdBuild', arg: B + ':0' }); st = P.load(); z = P.plan(st, P.picked(st)); bl = P.buyList(z);
    assert(!z.mats.find(m => m.tid === B).build && bl[B] === 10 && bl[TRIT] === 100 && !z.anyBuild, 'B kaufen (von Hand): Einkaufsliste 10 × B, kein Bauen');
    assert(near(z.cost, z.allBuy), 'Ohne gebaute Bauteile: Kosten = alles kaufen');
    await P.action({ type: 'pdAllBuild', arg: '1' }); st = P.load(); z = P.plan(st, P.picked(st));
    assert(st.build[B] === 1 && st.build[C] === 1 && z.mats.find(m => m.tid === B).sub.mats.find(m => m.tid === C).build, 'Alle bauen: B und C gebaut');
    await P.action({ type: 'pdAllBuild', arg: 'auto' }); assert(!Object.keys(P.load().build).length, 'Alle auto: Wahl gelöscht');
    // Auto kippt, wenn Kaufen billiger ist
    set(B, 1); st = P.load(); z = P.plan(st, P.picked(st));
    assert(!z.mats.find(m => m.tid === B).build, 'Auto: B kaufen, wenn das billiger ist');
    set(B, 500);
    // ME je Bauteil überschreibbar
    await P.action({ type: 'pdSet:sme:' + B, arg: '10' }); st = P.load(); z = P.plan(st, P.picked(st));
    assert(z.mats.find(m => m.tid === B).sub.me === 10 && st.sub[B].me === 10, 'ME 10 für Bauteil B gemerkt und gerechnet');
    // Gesamtzeit = Summe der gebauten Jobs
    const mB2 = z.mats.find(m => m.tid === B);
    assert(mB2.build && near(z.tTime, z.time + mB2.sub.tTime), 'Gesamtzeit = eigener Job + gebaute Bauteile');
    // Tiefe begrenzt: Kette T0 ← T1 ← … ← T9
    for (let i = 0; i < 10; i++) add(910100 + i, 910000 + i, 1, [910000 + i + 1, 1], 'Kette ' + i);
    for (let i = 0; i <= 10; i++){ P.adj[910000 + i] = 1; set(910000 + i, 1); }
    await P.action({ type: 'pdPick', arg: 't:910100' }); st = P.load(); z = P.plan(st, P.picked(st));
    let lv = 0; for (let t = z; t; t = (t.mats.find(m => m.sub) || {}).sub) lv = t.lvl;
    assert(lv === P.DEPTH, 'Tiefe höchstens ' + P.DEPTH + ' Ebenen');
    // echtes Schiff: Revelation (Kapital-Bauteile)
    const rev = D.r.find(r => D.t[r[1]] && D.t[r[1]][0] === 'Revelation');
    const t0 = Date.now(); await P.action({ type: 'pdPick', arg: 't:' + rev[0] }); st = P.load(); z = P.plan(st, P.picked(st));
    let nodes = 0; (function walk(t){ t.mats.forEach(m => { if (m.sub){ nodes++; walk(m.sub); } }); })(z);
    assert(nodes > 10 && nodes <= P.NODES && Date.now() - t0 < 1500, 'Revelation: ' + nodes + ' Bauteile, gerechnet in ' + (Date.now() - t0) + ' ms');
    // Oberfläche
    await P.action({ type: 'pdPick', arg: 't:900101' });
    const b = d.createElement('div'); P.view(b, false);
    assert(b.querySelectorAll('details.pd-node').length >= 2 && /Bauteile: kaufen oder selbst bauen/.test(b.textContent) && /Ersparnis/.test(b.textContent), 'Ansicht: Baum + Vergleich + Ersparnis');
    const mbx = [...b.querySelectorAll('[data-copy]')].find(x => /Multibuy/.test(x.title + x.parentNode.textContent));
    assert(mbx && !/Test B/.test(mbx.getAttribute('data-copy')) && /Tritanium/.test(mbx.getAttribute('data-copy')), 'Multibuy enthält nur Gekauftes');
    assert(/Gesamtzeit mit Bauteilen/.test(b.textContent), 'Gesamtzeit mit Bauteilen gezeigt');
    const miss = [...b.querySelectorAll('.pd-node button')].filter(x => !x.title);
    assert(!miss.length, 'Knöpfe im Baum haben ein title');
    console.log('ALL PASSED');
  }catch(e){ console.error(e.stack || e); console.log('FAILED'); }
  w.close(); process.exit(0);
})();
