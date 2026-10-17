// AA2 (27.09.2026): Wertschätzer – Liste einfügen (Inventar, Vertrag, Multibuy, EFT, Frachtraum), deutsche Namen, Werte an der Hub-Station,
// dünner Markt, Unbekanntes, Verlauf ≤ 10, Hauptfenster + Overlay, Zwischenablage nur bei offenem Wertschätzer
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760, AMARR = 60008494;
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const buy = (loc, sys, price, vr) => ({ is_buy_order: true, location_id: loc, system_id: sys, range: 'station', price, volume_remain: vr, min_volume: 1 });
const sell = (loc, price, vr) => ({ is_buy_order: false, location_id: loc, system_id: 0, range: 'region', price, volume_remain: vr, min_volume: 1 });
const ORD = {
  '10000002:34': [buy(JITA, 30000142, 5, 100000), sell(JITA, 6, 100000)],
  '10000002:40520': [buy(JITA, 30000142, 1000, 1), sell(JITA, 1500, 5)],   // dünn: nur 1 Stück sofort
  '10000002:587': [buy(JITA, 30000142, 100, 10), sell(JITA, 200, 10)],
  '10000043:34': [buy(AMARR, 30002187, 4, 100000), sell(AMARR, 7, 100000)]
};
const IDS = { tritanium: 34, rifter: 587 };
let idCalls = 0;
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = (u, o) => { u = String(u); let m;
      if (/universe\/ids/.test(u)){ idCalls++; const names = JSON.parse(o.body); if (names.includes('Kaputt')) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }); return json({ inventory_types: names.filter(n => IDS[n.toLowerCase()]).map(n => ({ id: IDS[n.toLowerCase()], name: n[0].toUpperCase() + n.slice(1).toLowerCase() })) }); }
      if ((m = /markets\/(\d+)\/orders\/.*type_id=(\d+)/.exec(u))) return json(ORD[m[1] + ':' + m[2]] || []);
      if ((m = /universe\/types\/(\d+)/.exec(u))) return json({ type_id: +m[1], name: 'T' + m[1], volume: 0.01, packaged_volume: 0.01 });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    // Parser
    const P = t => T.apParse(t).map(x => x.name + '=' + x.q).join('|');
    assert(P('Tritanium\t1.000\tMineral\nPyerite\t\tMineral') === 'Tritanium=1000|Pyerite=1', 'AA2: Inventar/Vertrag mit Tab, Tausenderpunkt, leer = 1');
    assert(P('Tritanium x3\n5 Pyerite\n2x Mexallon\nIsogen 1000\nIsogen 500') === 'Tritanium=3|Pyerite=5|Mexallon=2|Isogen=1500', 'AA2: „x3“, Frachtraum „5 Name“/„2x Name“, Multibuy „Name 1000“, gleiche Ware zusammengezählt');
    assert(P('[Rifter, Mein Fit]\n200mm AutoCannon I, EMP S\n200mm AutoCannon I, EMP S\n[Empty High slot]\n\nEMP S x100') === 'Rifter=1|200mm AutoCannon I=2|EMP S=100', 'AA2: EFT – Schiff, Module ohne Munition dahinter, leere Slots weg, Fracht „x100“');
    assert(P('Tritanium\t1,234,567') === 'Tritanium=1234567', 'AA2: englische Tausender-Kommas');

    // Schätzen: deutscher Name ohne ESI, englisch über ESI, Unbekanntes unten
    const tax = T.tscFees(T.tscReadCfg()).tax, brk = T.tscFees(T.tscReadCfg()).brk;
    await T.apAction({ type: 'apGo', form: { aptext: 'Tritanium\t1.000\nGroßer Skill-Injektor\t3\nRifter\t1\nQuatschding\t7' } }); await tick(300);
    let D = T.apLoad(), L = D.last;
    assert(L && L.rows.length === 3 && L.unk.length === 1 && /Quatschding × 7/.test(L.unk[0]), 'AA2: 3 Waren erkannt, „Quatschding × 7“ unter „nicht erkannt“');
    const inj = L.rows.find(r => r.tid === 40520), tri = L.rows.find(r => r.tid === 34);
    assert(inj && inj.name === 'Großer Skill-Injektor' && inj.fill === 1, 'AA2: deutscher Name aus der Liste (Client deutsch), dünner Markt: nur 1 sofort');
    assert(Math.abs(tri.buy - 5000 * (1 - tax)) < 1e-6 && Math.abs(tri.sell - 6000 * (1 - tax - brk)) < 1e-6 && Math.abs(tri.vol - 10) < 1e-9, 'AA2: Kauf netto nach Steuer, Verkauf netto nach Steuer + Broker, Volumen');
    assert(Math.abs(L.buy - L.rows.reduce((a, r) => a + r.buy, 0)) < 1e-6 && L.q === 1004, 'AA2: Summen');
    // Hauptfenster
    $('neo-btn-appraisal').click(); await tick(50);
    const pg = $('ap-page');
    assert(pg && pg.querySelector('textarea[data-ovf="aptext"]') && /Split/.test(pg.textContent) && pg.querySelector('.ap-sum .tsc-cp-b[data-copy="' + Math.round((L.buy + L.sell) / 2) + '"]'), 'AA2: Hauptseite mit Feld, Summen und Split zum Kopieren');
    assert(pg.querySelectorAll('.ap-row').length === 3 && pg.querySelector('.ap-row [data-mk="40520"]') && /nur 1 sofort/.test(pg.textContent) && /Nicht erkannt: Quatschding/.test(pg.textContent), 'AA2: Liste mit Markt-Knopf, dünner Markt, Unbekanntes');
    assert(pg.querySelector('.ap-row img.ap-i[src*="/types/40520/icon"]'), 'AA2: EVE-Symbol je Ware');
    // Overlay (gleiche Daten), Liste zuklappen
    const box = d.createElement('div'); T.ovRenderViewInto('appraisal', box);
    assert(box.querySelectorAll('.ap-row').length === 3 && box.querySelector('.ap-row img.ap-i[src*="/types/587/icon"]') && box.querySelector('[data-ova="apList"]') && box.querySelector('[data-ova="apHub"][data-arg="amarr"]'), 'AA2: Overlay-Ansicht mit Liste und Hub-Knöpfen');
    await T.apAction({ type: 'apList' });
    const box2 = d.createElement('div'); T.ovRenderViewInto('appraisal', box2);
    assert(box2.querySelectorAll('.ap-row').length === 0 && /▸ Liste/.test(box2.textContent), 'AA2: Liste zugeklappt');
    await T.apAction({ type: 'apList' });
    // Hub wechseln rechnet neu
    await T.apAction({ type: 'apHub', arg: 'amarr', form: { aptext: 'Tritanium 1000' } }); await tick(300);
    D = T.apLoad();
    assert(D.hub === 'amarr' && Math.abs(D.last.buy - 4000 * (1 - tax)) < 1e-6, 'AA2: Hub Amarr rechnet neu');
    // englischer Name wird gemerkt (kein zweiter ESI-Aufruf)
    const c0 = idCalls; await T.apAction({ type: 'apGo', form: { aptext: 'Rifter\t2' } }); await tick(200);
    assert(idCalls === c0 && T.apLoad().last.rows[0].q === 2, 'AA2: Namen werden gemerkt');
    // Verlauf ≤ 10, gleicher Text nur einmal
    for (let i = 0; i < 12; i++) await T.apAction({ type: 'apGo', form: { aptext: 'Tritanium ' + (i + 1) } });
    await T.apAction({ type: 'apGo', form: { aptext: 'Tritanium 12' } });
    D = T.apLoad();
    assert(D.hist.length === 10 && D.hist[0].text === 'Tritanium 12' && D.hist.filter(h => h.text === 'Tritanium 12').length === 1, 'AA2: Verlauf höchstens 10, doppelt nur einmal');
    await T.apAction({ type: 'apHist', arg: '3' });
    assert(T.apLoad().text === 'Tritanium 9', 'AA2: Verlauf-Knopf lädt die Liste wieder');
    // Zwischenablage vom Programm: nur bei offenem Wertschätzer
    T.switchTab('intel'); await tick(30);
    T.onHostCommand({ type: 'apPaste', text: 'Rifter\t5' }); await tick(200);
    assert(T.apLoad().text === 'Tritanium 9', 'AA2: Zwischenablage ignoriert, wenn Wertschätzer zu');
    $('neo-btn-appraisal').click(); await tick(30);
    T.onHostCommand({ type: 'apPaste', text: 'Rifter\t5' }); await tick(300);
    assert(T.apLoad().last.rows[0].q === 5, 'AA2: Zwischenablage übernommen, wenn Wertschätzer offen');
    await T.apAction({ type: 'apClear' });
    assert(!T.apLoad().last && !T.apLoad().text && T.apLoad().hist.length === 10, 'AA2: Leeren behält den Verlauf');
    assert(!/"apGo"/.test(w.localStorage.getItem('eve-zentrale-appraisal-v1')) && w.localStorage.getItem('eve-zentrale-appraisal-v1'), 'AA2: gespeichert unter eve-zentrale-appraisal-v1');
    // BB12: Asset-Zeilen aus EVE (Name, Volumen, EVE-Schätzpreis), eigener Schiffsname, „*“, ESI-Fehler einzeln
    const U = '[NM]Roadrunner Shuttle*\t5.000 m3\t4.100.721,50 ISK\n[TM]Buschfunk Deep Space Transport*\t390.000 m3\t151.466.918,87 ISK\n[TM]Waltraud Frachter*\t16.250.000 m3\t1.603.455.569,46 ISK';
    assert(P(U) === '[NM]Roadrunner Shuttle=1|[TM]Buschfunk Deep Space Transport=1|[TM]Waltraud Frachter=1', 'BB12: m³-Spalte ist keine Menge, „*“ weg');
    assert(T.apIsk('4.100.721,50 ISK') === 4100721.5 && T.apIsk('4,100,721.50 ISK') === 4100721.5 && T.apIsk('1.603.455.569 ISK') === 1603455569, 'BB12: ISK deutsch/englisch');
    T.apShipsRemember([{ name: '[TM]Waltraud Frachter', tid: 587 }]);
    await T.apAction({ type: 'apGo', form: { aptext: U + '\nKaputt\t2\nTritanium\t10' } }); await tick(300);
    L = T.apLoad().last;
    const wf = L.rows.find(r => r.tid === 587), rr = L.rows.find(r => r.est && /Roadrunner/.test(r.name));
    assert(wf && wf.nick === '[TM]Waltraud Frachter' && wf.q === 1, 'BB12: eigener Schiffsname über die Assets -> Schiffstyp');
    assert(rr && rr.buy === 4100721.5 && L.rows.filter(r => r.est).length === 2, 'BB12: nicht erkannt -> EVE-Schätzpreis aus der Zeile');
    assert(L.rows.find(r => r.tid === 34 && r.q === 10) && /Kaputt/.test(L.unk.join()), 'BB12: ESI-Fehler bei einem Namen reißt die anderen nicht mit');
    const box3 = d.createElement('div'); T.ovRenderViewInto('appraisal', box3);
    assert(/EVE-Schätzung/.test(box3.textContent) && /„\[TM\]Waltraud Frachter“/.test(box3.textContent), 'BB12: Overlay zeigt EVE-Schätzung und Schiffsnamen');
    console.log('\nALL AA2 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
