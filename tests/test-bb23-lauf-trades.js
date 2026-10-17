// BB23 (30.09.2026): Hauling-Lauf als Verkaufsorders – je Ware ein Verkaufs-Trade an der Zielstation (auch außerhalb der 5 Hubs),
// Order wird angehängt (Ware + Station + Charakter), Fortschritt/Geld aus dem Lauf (nichts doppelt), Markierung, Lauf erledigt → Trades mit
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760, TASH = 60001234, TSYS = 30004444, TREG = 10000020;
const now = Date.now();
let orders = [];
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]));
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [now - 1700e3, 34, 1000, 5, 1, JITA], 2: [now - 1700e3, 35, 500, 10, 1, JITA], 3: [now - 300e3, 34, 400, 7, 0, TASH] }, fee: {}, ord: {}, upd: now }));
    w.fetch = (u, o) => { u = String(u); let m;
      if ((m = /universe\/stations\/(\d+)/.exec(u))) return json({ name: 'Tash-Murkon Prime II - Moon 1', system_id: TSYS, type_id: 1531 });
      if (/universe\/systems\//.test(u)) return json({ name: 'Tash-Murkon Prime', security_status: 0.9, constellation_id: 20000300 });
      if (/universe\/constellations\//.test(u)) return json({ region_id: TREG });
      if (/universe\/names/.test(u)) return json([{ id: TREG, name: 'Tash-Murkon' }]);
      if (/\/characters\/111\/orders\//.test(u)) return json(orders);
      if ((m = /markets\/(\d+)\/orders\/.*type_id=(\d+)/.exec(u))) return json(+m[1] === TREG ? [{ order_id: 900, is_buy_order: false, location_id: TASH, system_id: TSYS, range: 'region', price: 8, volume_remain: 5000, min_volume: 1, issued: new Date(now - 864e5).toISOString(), type_id: +m[2] }] : []);
      if (/wallet|journal|transactions/.test(u)) return json([]);
      return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    const run = T.hrAdd(JITA, 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', TASH, 'Tash-Murkon Prime II - Moon 1', [{ tid: 34, name: 'Tritanium', q: 1000, sp: 5000, p: 2000 }, { tid: 35, name: 'Pyerite', q: 500, sp: 5000, p: 1000 }]);
    T.hrUpdate(run.id, { created: now - 1800e3, charId: '111', sm: 'instant' });
    const n = await T.trFromRun(run.id); await tick(50);
    let tl = T.trLoad().filter(t => t.run === String(run.id));
    const tt = tl.find(t => t.tid === 34);
    assert(n === 2 && tl.length === 2 && tt.st === TASH && tt.reg === TREG && tt.hub === 'st' + TASH && tt.buyDone && tt.qty === 1000 && tt.buy === 5, 'BB23: je Ware ein Verkaufs-Trade an der Zielstation (Region nachgeschlagen, Menge + Einkaufspreis aus dem Lauf)');
    assert(T.hrLoad()[0].sm === 'order', 'BB23: Lauf steht jetzt auf „als Verkaufsorder“');
    // Fortschritt aus dem Lauf, Geld nur einmal
    const p = T.trProgress(tt);
    assert(p.bought === 1000 && p.sold === 400, 'BB23: Trade liest gekauft/verkauft aus dem Lauf: ' + p.bought + '/' + p.sold);
    const all = T.trkAll(), xt = all.find(x => x.kind === 'Trade' && x.id === tt.id), xl = all.find(x => x.kind === 'Lauf');
    assert(xt.res === null && typeof xl.res === 'number' && xt.run === String(run.id), 'BB23: Ergebnis zählt nur im Lauf (Trade ohne Betrag)');
    // nochmal drücken legt nichts doppelt an
    assert(await T.trFromRun(run.id) === 0, 'BB23: kein Trade doppelt');
    // Order hängt sich an, Preise der Zielstation
    orders = [{ order_id: 900, type_id: 34, location_id: TASH, is_buy_order: false, price: 8, volume_total: 600, volume_remain: 600, issued: new Date(now - 60e3).toISOString(), region_id: TREG }];
    await T.trRefresh(); await tick(200);
    const t2 = T.trLoad().find(t => t.id === tt.id), ev = T.trEvaluate(t2, T.getTrLive()[t2.id], T.tscFees(T.tscReadCfg()));
    assert(t2.sellOrderId === 900 && ev.sellCheck && ev.bestSell === 8, 'BB23: eigene Verkaufsorder an der Nicht-Hub-Station erkannt, Preise der Zielstation geladen');
    assert(ev.breakEven > 5 && !ev.buyPhase && ev.sellPhase, 'BB23: Mindestpreis aus dem echten Einkauf, nur Verkaufsphase');
    // 11.10.: Lauf-Trade – verkauft auch aus der eigenen Verkaufsorder (Buchungen kommen später): 600 eingestellt, 450 übrig, gebucht erst 0 an der Order
    const ev2 = T.trEvaluate(t2, { own: { sell: { order_id: 900, price: 8, volume_total: 1000, volume_remain: 450 } } }, T.tscFees(T.tscReadCfg()));
    assert(ev2.p.sold === 550 && ev2.stock === 450, 'Lauf-Trade: verkauft/Lager aus der Verkaufsorder (' + ev2.p.sold + '/' + ev2.stock + ')');
    // Markierung überall
    T.trRender(); const mt = d.getElementById('trades-list') || d.body;
    assert(/⇄ aus Lauf Jita IV → Tash-Murkon Prime II/.test(d.body.innerHTML), 'BB23: „Meine Trades“ zeigt „⇄ aus Lauf …“');
    assert(/wartet auf Order/.test(d.body.innerHTML), 'BB23: Pyerite ohne Order „wartet auf Order“');
    const box = d.createElement('div'); T.ovRenderViewInto('track', box);
    assert(/⇄ aus Lauf/.test(box.innerHTML) && /⇄ 2 Verkaufs-Trades/.test(box.innerHTML), 'BB23: Watchlist-Overlay – Trades markiert, Lauf zeigt „⇄ 2 Verkaufs-Trades“');
    // Lauf erledigt → Trades mit erledigt, zählen nicht in „Erledigt“
    T.hrUpdate(run.id, { status: 'done' });
    tl = T.trLoad().filter(t => t.run === String(run.id));
    assert(tl.every(t => t.status === 'done') && !T.doneList().some(x => x.kind === 'Trade'), 'BB23: Lauf erledigt → seine Trades auch, keine doppelte Zeile in „Erledigt“');
    // Lauf mit Verkaufsart Order bekommt Trades von selbst (einmal)
    const run2 = T.hrAdd(JITA, 'Jita', TASH, 'Tash-Murkon Prime II - Moon 1', [{ tid: 34, name: 'Tritanium', q: 1000, sp: 5000, p: 2000 }]);
    T.hrUpdate(run2.id, { created: now - 1800e3, charId: '111', sm: 'order' });
    T.trRunSync(); await tick(200);
    assert(T.trLoad().filter(t => t.run === String(run2.id)).length === 1 && T.hrLoad().find(r => r.id === run2.id).trAuto, 'BB23: Lauf „als Verkaufsorder“ legt seine Trades selbst an');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
