// Abschnitt W (2.0 Update, 26.09.2026) – W2 Ergebnis erledigter Läufe/Trades aus der Wallet, W3 Prüfen + Übernehmen, W4 Rest als verloren
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CH = [{ character_id: 111, character_name: 'Eins', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 },
            { character_id: 222, character_name: 'Zwei', access_token: 'x', refresh_token: 'y', expires_at: Date.now() + 1e6 }];
const now = Date.now(), M = 60e3, JITA = 60003760, AMARR = 60008494, C0 = now - 180 * M;
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CH)); } }).window;
const $ = id => w.document.getElementById(id);
(async () => {
  try{
    await tick(700);
    const T = w.__test, ls = w.localStorage;
    const store = (cid, tx) => ls.setItem('eve-zentrale-pnl-v1-' + cid, JSON.stringify({ tx, fee: {}, ord: {}, upd: now }));
    // Lauf Jita → Amarr: um C0+80 Min. auf „Erledigt“ geklickt, bevor die Verkäufe aus EVE da waren → Ergebnis eingefroren
    ls.setItem('eve-zentrale-haulruns-v1', JSON.stringify([{ id: 'r1', from: JITA, fromName: 'Jita IV', to: AMARR, toName: 'Amarr VIII', charId: '111', charName: 'Eins',
      items: [{ tid: 34, name: 'Tritanium', q: 100, sp: 1000, p: 200 }, { tid: 35, name: 'Pyerite', q: 10, sp: 100, p: 50 }], created: C0, status: 'active' }]));
    store('111', { a: [C0 + M, 34, 100, 10, 1, JITA], b: [C0 + M, 35, 10, 10, 1, JITA] });
    const r0 = T.hrLoad()[0];
    T.hrUpdate('r1', { status: 'done' });
    const frozen = T.hrLoad()[0].res;
    assert(frozen < -1000, 'W2: Ausgangslage – beim Erledigen nur Einkäufe da, gespeichert ' + frozen);
    // Verkäufe kommen später aus EVE (Buchungszeit vor „erledigt“), 40 Stück für 1 ISK, dazu Nachkauf für den nächsten Lauf
    T.hrUpdate('r1', { doneAt: C0 + 80 * M }); const doneAt = C0 + 80 * M;
    store('111', { a: [C0 + M, 34, 100, 10, 1, JITA], b: [C0 + M, 35, 10, 10, 1, JITA], c: [C0 + 60 * M, 34, 60, 12, 0, AMARR], d: [C0 + 60 * M, 34, 40, 1, 0, AMARR],
                   e: [C0 + 61 * M, 35, 5, 20, 0, AMARR], f: [doneAt + 5 * M, 34, 20, 10, 1, JITA] });
    store('222', { g: [doneAt + 6 * M, 35, 3, 20, 0, 60011866] });   // anderer Charakter, andere Station, nach „erledigt“
    const run = T.hrLoad()[0], g = T.hrProgress(run);
    assert(g.bought === 110 && g.items[34].b === 100, 'W2: Nachkauf nach dem ersten Verkauf gehört zum nächsten Lauf: ' + g.bought);
    assert(g.items[35].s === 5 && g.items[34].low === 40 && g.low === 40, 'W2: nur Verkäufe bis „erledigt“; 40 Stück weit unter Einkauf erkannt');
    const live = T.tkRes('Lauf', run);
    assert(live === g.profit && live > frozen, 'W2: Ergebnis kommt aus der Wallet statt eingefroren: ' + Math.round(live));
    const dl = T.doneList().find(x => x.kind === 'Lauf'), ta = T.trkAll().find(x => x.id === 'r1');
    assert(dl.res === live && ta.res === live, 'W2/W10: Wallet › Erledigt und Watchlist zeigen denselben Wert');
    // W3: Prüfen – alle Charaktere, jeder Ort, bis jetzt
    const c = T.tkChkCalc('Lauf', run), py = c.rows.find(r => r.tid === '35');
    assert(py.s === 8 && c.before === live && c.res > live, 'W3: Prüfung findet den späteren Verkauf von „Zwei“ woanders: ' + py.s);
    T.tkChkOpen['Lauf:r1'] = 1;
    w.document.querySelector('[data-trk="all"]').click(); await tick();
    const pan = $('trk-body').querySelector('.tk-chk');
    assert(pan && /Tritanium/.test(pan.textContent) && /40 unter halbem Einkaufspreis/.test(pan.textContent) && pan.querySelector('[data-chk="lost"]'), 'W3: Übersicht in der Watchlist mit Warnung und „Rest als verloren“');
    assert($('trk-check') && $('trk-body').querySelector('[data-tk="chk|Lauf:r1"]'), 'W3: Knöpfe „Alle prüfen“ und „Prüfen“ je Auftrag');
    assert(!pan.querySelector('[data-chk="undo"],[data-chk="done"]') && /Wallet-Werte übernehmen/.test(pan.textContent), 'BB10: Prüfen nur Übernehmen / Rest verloren / Schließen');
    pan.querySelector('[data-chk="ok"]').click(); await tick();
    T.tkChkOpen['Lauf:r1'] = 1; w.document.querySelector('[data-trk="all"]').click(); await tick();
    let r = T.hrLoad()[0];
    assert(r.wide && r.chk && r.chk.old.res === frozen && r.status === 'done' && Math.abs(T.tkRes('Lauf', r) - c.res) < 1e-6, 'W3: übernommen, alte Werte gemerkt');
    // W4: Rest (2 Pyerite) als verloren buchen
    $('trk-body').querySelector('[data-chk="lost"]').click(); await tick();
    r = T.hrLoad()[0];
    const g2 = T.hrProgress(r);
    assert(r.lost[35] === 2 && g2.lost === 2 && g2.sold === g2.bought, 'W4: Rest als verloren gebucht, Lauf damit vollständig');
    const ub = $('tk-undo').querySelectorAll('[data-tk-undo]');   // BB10: Rückgängig über den Streifen – ältester Eintrag = Stand vor „übernehmen“
    assert(!$('tk-undo').hidden && ub.length === 2, 'BB10: Streifen zeigt beide Schritte');
    ub[1].click(); await tick();
    r = T.hrLoad()[0];
    assert(!r.wide && !r.lost && !r.chk && r.res === frozen && r.doneAt === doneAt, 'W3: Rückgängig stellt den alten Stand her');
    // Trade: beim Erledigen fehlten die Verkäufe → Ergebnis aus der Wallet
    ls.setItem('eve-zentrale-trades-v1', JSON.stringify([{ id: 't1', tid: 36, name: 'Mexallon', hub: 'jita', charId: '111', qty: 10, buy: 50, sell: 80, created: C0, status: 'done', done: now - 10 * M, finalResult: -500 }]));
    store('111', { h: [C0 + M, 36, 10, 50, 1, JITA], i: [C0 + 90 * M, 36, 10, 80, 0, JITA], j: [now - M, 36, 10, 50, 1, JITA] });
    const tr = T.trLoad()[0], tres = T.tkRes('Trade', tr);
    assert(tres > 0 && T.doneList().find(x => x.kind === 'Trade').res === tres, 'W2: Trade-Ergebnis aus der Wallet (' + Math.round(tres) + '), Kauf nach „erledigt“ zählt nicht');
    console.log('\nALL WUENSCHE-W TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
