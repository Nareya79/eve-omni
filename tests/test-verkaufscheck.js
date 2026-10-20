// T28 (27.09.2026): Verkaufs-Check fuer Laeufe mit Direktverkauf – Massenverkauf an die Kauforders am Ziel nachrechnen,
// Teilmenge, Verkaufsorder-Vorschlag (auch Verlust), Alarm einmal je Lage, Anzeige im Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), H = 3600000, JITA = 60003760, RENS = 60004588, ST1 = 60000001, ST2 = 60000002;
function jwt(scopes, id){ const b = s => Buffer.from(JSON.stringify(s)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b({ alg: 'none' }) + '.' + b({ scp: scopes, sub: 'CHARACTER:EVE:' + id }) + '.x'; }
const CHARS = [{ access_token: jwt([], 111), refresh_token: 'r', expires_at: NOW + H, character_id: '111', character_name: 'Orvan' }];
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const buy = (loc, sys, range, price, vr, minv) => ({ is_buy_order: true, location_id: loc, system_id: sys, range, price, volume_remain: vr, min_volume: minv || 1 });
const sell = (loc, price, vr) => ({ is_buy_order: false, location_id: loc, system_id: 0, range: 'region', price, volume_remain: vr, min_volume: 1 });
const ORD = {
  '10000002:34': [buy(JITA, 30000142, 'station', 6, 600), buy(60003761, 30000142, 'solarsystem', 5, 1000),
    buy(60003761, 30000142, 'station', 10, 1000), buy(JITA, 30000142, 'station', 9, 5000, 5000)],   // falsche Station / min_volume zu hoch
  '10000002:35': [buy(JITA, 30000142, 'station', 12, 3), buy(60000500, 30000144, 'region', 8, 1000), sell(JITA, 15, 50)],
  '10000001:36': [buy(ST1, 30000001, 'station', 50, 100), sell(ST1, 90, 20), buy(ST2, 30000001, 'station', 200, 100)],
  '10000001:37': [buy(ST2, 30000001, 'station', 80, 100), buy(ST1, 30000001, 'station', 300, 100)]
};
const day = i => new Date(NOW - i * 86400000).toISOString().slice(0, 10);
const HIST = Array.from({ length: 30 }, (_, i) => ({ date: day(i + 1), average: 14, highest: 15, lowest: 13, order_count: 10, volume: 70 }));
let tx = {};
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
    w.fetch = u => { u = String(u); let m;
      if ((m = /markets\/(\d+)\/orders\/.*type_id=(\d+)/.exec(u))) return json(ORD[m[1] + ':' + m[2]] || []);
      if (/markets\/\d+\/history/.test(u)) return json(HIST);
      if ((m = /universe\/stations\/(\d+)/.exec(u))) return json({ name: 'Station ' + m[1], system_id: 30000001 });
      if (/universe\/systems\/30000001/.test(u)) return json({ name: 'Tanoo', constellation_id: 20000001 });
      if (/universe\/constellations\/20000001/.test(u)) return json({ region_id: 10000001 });
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    const t0 = Date.now() - 1000;
    tx = { 1: [t0, 34, 1000, 4, 1, RENS], 2: [t0, 36, 10, 100, 1, JITA], 3: [t0, 37, 10, 50, 1, JITA] };
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx, fee: {}, ord: {}, upd: 0 }));
    const add = async (pre, mode, from, to, toName, rows) => { $(pre + '-sellmode').value = mode; await tick(5); return T.hrAdd(from, 'Rens', to, toName, rows, pre); };
    const A = await add('is', 'instant', RENS, JITA, 'Jita IV - Moon 4', [{ tid: 34, name: 'Tritanium', q: 1000, sp: 4000, p: 1000 }, { tid: 35, name: 'Pyerite', q: 10, sp: 100, p: 20 }]);
    const D = await add('is', 'order', RENS, JITA, 'Jita IV - Moon 4', [{ tid: 38, name: 'Nocxium', q: 5, sp: 50, p: 5 }]);
    const B = await add('hl', 'instant', JITA, ST1, 'Tanoo I - Station', [{ tid: 36, name: 'Mexallon', q: 10, sp: 1000, p: 100 }]);
    const C = await add('hl', 'instant', JITA, ST2, 'Tanoo II - Station', [{ tid: 37, name: 'Isogen', q: 10, sp: 500, p: 100 }]);
    const E = await add('hl', 'instant', JITA, ST2, 'Tanoo II - Station', [{ tid: 39, name: 'Zydrine', q: 1, sp: 1, p: 1 }]);
    T.hrUpdate(E.id, { sm: undefined });   // alter Lauf ohne gemerkte Verkaufsart
    assert(A.sm === 'instant' && D.sm === 'order' && B.sm === 'instant', 'T28: Verkaufsart wird am Lauf gemerkt (Hub-Handel und Hauling)');
    assert(/Verkauf prüfen/.test(T.vcCard(A.id)) && /Verkauf prüfen/.test(T.vcCard(B.id)) && T.vcCard(D.id) === '', 'T28: Direktverkauf bekommt den Knopf, Verkaufsorder-Lauf nicht');
    assert(/Verkauf prüfen/.test(T.vcCard(E.id)) && /Verkaufsart unbekannt/.test(T.vcCard(E.id)), 'T28: alter Lauf bekommt den Knopf mit „Verkaufsart unbekannt“');

    const tax = T.tscFees(T.tscReadCfg()).tax, brk = T.tscFees(T.tscReadCfg()).brk;
    // reine Rechnung
    const f = T.vcFill(ORD['10000002:34'].filter(o => o.is_buy_order).sort((a, b) => b.price - a.price), 1000, JITA, 30000142, tax, 4);
    assert(f.fill === 1000 && f.low === 5 && Math.abs(f.net - (600 * 6 + 400 * 5) * (1 - tax)) < 1e-6, 'T28: Menge über mehrere Kauforders, Steuer; andere Station (range station) und min_volume ausgelassen');

    // automatische Prüfung im Aktualisier-Takt: nur Direktverkauf, unterwegs
    await T.hrRefresh(); await tick(400);
    let runs = T.hrLoad(); const R = id => runs.find(r => r.id === id);
    assert(R(A.id).vc && R(B.id).vc && R(C.id).vc && !R(D.id).vc && !R(E.id).vc, 'T28: automatisch geprüft nur Läufe mit Direktverkauf (nicht Verkaufsorder, nicht unbekannt)');
    const va = R(A.id).vc, tri = va.w.find(x => x.tid === 34), pye = va.w.find(x => x.tid === 35);
    assert(!tri.red && !tri.est && Math.abs(tri.cost - 4) < 1e-9 && tri.plan === 5 && tri.low === 5, 'T28: Tritanium grün, echter Einkaufspreis aus der Wallet, geplant 5');
    assert(pye.red && pye.est && pye.okQ === 3 && pye.q === 10, 'T28: Pyerite rot, Teilmenge 3 direkt, Einkauf geschätzt');
    const p = 14.99;   // ein Schritt unter 15
    assert(pye.so && Math.abs(pye.so.p - p) < 0.011 && pye.so.n === 7 && pye.so.pu > 0 && Math.abs(pye.so.net - pye.so.p * (1 - tax - brk)) < 1e-6 && pye.so.daily === 10, 'T28: Verkaufsorder-Vorschlag mit Steuer + Broker, 7 Stück, 10/Tag: ' + pye.so.p);
    const vb = R(B.id).vc.w[0], vcc = R(C.id).vc.w[0];
    assert(vb.red && vb.okQ === 0 && vb.so.pu < 0 && !vcc.red && vcc.low === 80, 'T28: Hauling mit zwei Zielstationen – je Station nur deren Orders');
    assert(!/vc-w/.test(T.vcCard(A.id)) && /class="btn ghost vc-fold" data-vcf="[^"]+" data-ova="vcFold"[^>]*>▸</.test(T.vcCard(A.id)), 'PR1: nach der Prüfung zu, auch mit Rot; Klappknopf ▸ neben „Verkauf prüfen“');
    T.vcTog(A.id, 'open');
    let html1 = T.vcCard(A.id);
    assert(/3 Stück direkt verkaufen, Rest \(7\) als Verkaufsorder/.test(html1) && /geplant/.test(html1) && /jetzt/.test(html1) && /Geprüft \d\d:\d\d · <span class="pos">1 grün<\/span> · <span class="neg">1 rot<\/span> · vermiedener Verlust/.test(html1) && /Tage bis verkauft/.test(html1), 'T28/Z2: Anzeige Teilmenge, geplant/jetzt, Kopfzeile Geprüft · grün · rot · vermiedener Verlust, Tage');
    // Z2/PR1: aufgeklappt nur rote Waren; je rote Ware Name kopieren + Markt; „alle zeigen“
    assert(!/<b>Tritanium<\/b>/.test(html1) && /data-mk="35"/.test(html1) && /alle zeigen \(2\)/.test(html1), 'Z2: nur rote Ware, mit Markt-Knopf, „alle zeigen (2)“');
    T.vcTog(A.id, 'all');
    assert(/<b>Tritanium<\/b>/.test(T.vcCard(A.id)) && /nur rote zeigen/.test(T.vcCard(A.id)) && !/data-mk="34"/.test(T.vcCard(A.id)), 'Z2: alle zeigen, grüne ohne Knöpfe');
    T.vcTog(A.id, 'all'); T.vcTog(A.id, 'open');
    assert(!/vc-w/.test(T.vcCard(A.id)) && /▸ Geprüft/.test(T.vcCard(A.id)) && /vc-fold[^>]*>▸</.test(T.vcCard(A.id)), 'Z2: Klick klappt zu');
    T.vcTog(A.id, 'open');
    html1 = T.vcCard(A.id);
    assert(/herausnehmen \(Jita IV\): <b>Pyerite<\/b>/.test(html1) && /data-copy="Pyerite"/.test(html1) && /data-copy="14[.,]99"/.test(html1) && /vermiedener Verlust/.test(html1), 'T28: Zusammenfassung herausnehmen + Kopieren + vermiedener Verlust');
    T.vcTog(B.id, 'open');
    assert(/Auch als Verkaufsorder Verlust: −[\d.,]+ ISK pro Stück \/ −[\d.,]+ ISK gesamt/.test(T.vcCard(B.id)), 'T28: „Auch als Verkaufsorder Verlust“');
    assert(/0 rot/.test(T.vcCard(C.id)) && !/Alles im Gewinn/.test(T.vcCard(C.id)), 'Z2: ohne Rot zugeklappt');
    T.vcTog(C.id, 'open');
    assert(/Alles im Gewinn/.test(T.vcCard(C.id)), 'T28: grüner Lauf');
    // Alarm einmal je Lage
    const al1 = T.vcAlarmLast();
    assert(al1 && /Pyerite|Mexallon/.test(al1.body), 'T28: Alarm bei neu roter Ware: ' + (al1 && al1.body));
    await T.vcCheck(A.id, true);
    assert(T.vcAlarmLast() === al1, 'T28: gleiche Lage → kein zweiter Alarm');
    T.hrUpdate(A.id, { vcAl: {} });   // war zwischendurch grün
    await T.vcCheck(A.id, true);
    assert(T.vcAlarmLast() !== al1 && /Pyerite/.test(T.vcAlarmLast().body), 'T28: nach Grün wieder rot → neuer Alarm');
    // Watchlist: rot blinkend
    const xa = T.trkAll().find(x => x.id === A.id), xc = T.trkAll().find(x => x.id === C.id);
    assert(/st-bad/.test(xa.st) && !/st-bad/.test(xc.st), 'T28: Lauf mit roter Ware blinkt rot');
    // Overlay
    const box = d.createElement('div'); T.ovRenderViewInto('track', box);
    assert(box.querySelector('[data-ova="vcRun"][data-arg="all"]'), 'T28: Overlay „Verkauf prüfen“ für alle');
    const cardA = [...box.querySelectorAll('.trk-run')].find(c => c.getAttribute('data-arg') === A.id);
    assert(!cardA.querySelector('.vc-dot') && !/herausnehmen/.test(cardA.textContent) && /st-bad/.test(cardA.className), 'II2: zugeklappt ohne Punkte und ohne „herausnehmen“ – der rote Rahmen zeigt den Verlust');
    const o = T.ovLoad(); o.trkDet = [A.id]; T.ovSave(o);
    T.vcTog(A.id, 'open');   // PR1: neue Prüfung = zu
    const box2 = d.createElement('div'); T.ovRenderViewInto('track', box2);
    const full = [...box2.querySelectorAll('.trk-run')].find(c => c.getAttribute('data-arg') === A.id);
    const vb2 = full.querySelector('.vc-btn');
    assert(full.querySelector('.vc-dot.bad') && /Pyerite/.test(full.textContent) && full.querySelector('.tsc-cp-b[data-copy="Pyerite"]'), 'II2: aufgeklappt mit Punkten, roter Ware und Kopier-Knopf');
    assert(vb2 && vb2.getAttribute('data-ova') === 'vcRun' && full.querySelector('.tsc-cp-b[data-copy="14,99"], .tsc-cp-b[data-copy="14.99"]'), 'T28: aufgeklappte Karte mit Prüfen-Knopf und Preis zum Kopieren');
    const fh = full.querySelector('[data-ova="vcFold"]');
    assert(fh && fh.closest('[data-ova]') === fh && full.querySelector('[data-mk="35"]'), 'Z2: Overlay mit Kopfzeile zum Klappen und Markt-Knopf');
    T.ovSatAction('track', { type: 'vcFold', arg: A.id });
    assert(!/vc-w/.test(T.vcCard(A.id)), 'Z2: Overlay-Klick klappt zu (gleicher Zustand wie Hauptfenster)');
    T.ovSatAction('track', { type: 'vcFold', arg: A.id });
    assert(vb2.closest('[data-ova]') === vb2, 'T28: Klick auf den Knopf trifft die Knopf-Aktion, nicht das Aufklappen (U2)');
    // Knopf per Aktion
    T.hrUpdate(D.id, {}); const before = T.hrLoad().find(r => r.id === E.id).vc;
    T.ovAction({ type: 'vcRun', arg: E.id }); await tick(300);
    assert(!before && T.hrLoad().find(r => r.id === E.id).vc, 'T28: „Verkauf prüfen“ per Overlay-Aktion prüft den Lauf');
    // Hauptfenster
    T.switchTab('track'); await tick(50);
    assert($('trk-vc') && /Verkauf prüfen/.test($('trk-vc').textContent), 'T28: Hauptfenster „Verkauf prüfen“ für alle');
    T.switchTab('haul'); await tick(50);   // AM7: Läufe stehen in „Laufend“ bei Hauling
    const tro = $('tro-body');
    assert(tro && tro.querySelector('.trk-sm.st-bad') && !tro.querySelector('.trk-sm .vc-dot'), 'II2: zugeklappte Zeile im Hauptfenster rot umrandet, ohne Punkte');
    console.log('\nALL T28 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
