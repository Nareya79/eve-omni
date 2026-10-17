// BB30 (30.09.2026): Verkaufs-Trades aus Läufen fanden ihre Orders nicht, wenn ein anderer Hauler (Taron statt Norren) sie eingestellt hat,
// und bei Ziel an einer Hub-Station (Dodixie) verloren normale Hub-Trades dort ihre Order-Zuordnung
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), JITA = 60003760, DODI = 60011866;
const ORD = { 111: [], 222: [
  { order_id: 7433192209, type_id: 25608, location_id: DODI, is_buy_order: false, price: 900, volume_total: 50, volume_remain: 50, issued: new Date(now - 6e5).toISOString(), region_id: 10000032 },
  { order_id: 7433192759, type_id: 16273, location_id: DODI, is_buy_order: false, price: 200, volume_total: 900, volume_remain: 900, issued: new Date(now - 6e5).toISOString(), region_id: 10000032 },
  { order_id: 555, type_id: 34, location_id: DODI, is_buy_order: false, price: 6, volume_total: 100, volume_remain: 100, issued: new Date(now - 6e5).toISOString(), region_id: 10000032 }] };
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(x) });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Norren' }, { access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '222', character_name: 'Taron' }]));
  x.localStorage.setItem('eve-zentrale-pnl-v1-222', JSON.stringify({ tx: { 1: [now - 3e6, 25608, 50, 500, 1, JITA], 2: [now - 3e6, 16273, 900, 150, 1, JITA] }, fee: {}, ord: {}, upd: now }));
  x.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify([{ id: 'hub1', tid: 34, name: 'Tritanium', hub: 'dodixie', charId: '222', charName: 'Taron', qty: 100, buy: 5, sell: 6, created: now - 36e5, status: 'active', buyDone: true }]));
  x.fetch = (u) => { u = String(u); let m;
    if ((m = /characters\/(\d+)\/orders\//.exec(u))) return json(ORD[m[1]] || []);
    if (/markets\/\d+\/orders\//.test(u)) return json([]);
    if (/wallet|journal|transactions/.test(u)) return json([]);
    if (/universe\/stations\//.test(u)) return json({ name: 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant', system_id: 30002659, type_id: 1531 });
    if (/universe\/systems\//.test(u)) return json({ name: 'Dodixie', security_status: 0.87, constellation_id: 20000389 });
    if (/universe\/constellations\//.test(u)) return json({ region_id: 10000032 });
    if (/universe\/names/.test(u)) return json([{ id: 10000032, name: 'Sinq Laison' }]);
    return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test;
    const run = T.hrAdd(JITA, 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', DODI, 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant',
      [{ tid: 25608, name: 'Intact Shield Emitter', q: 50, sp: 25000, p: 5000 }, { tid: 16273, name: 'Liquid Ozone', q: 900, sp: 135000, p: 20000 }]);
    T.hrUpdate(run.id, { created: now - 36e5, charId: '111', charName: 'Norren, Taron' });
    await T.trFromRun(run.id);
    assert(T.trLoad().filter(t => t.run === String(run.id)).every(t => t.charId === '111' || (t.charId === '222' && t.sellOrderId)), 'BB30: Lauf-Trades stehen auf dem ersten Hauler (Norren) – oder haben die schon erkannte Order von Taron übernommen (II4)');
    await T.trRefresh(); await tick(200);
    const L = T.trLoad(), ise = L.find(t => t.tid === 25608), lo = L.find(t => t.tid === 16273), hub = L.find(t => t.id === 'hub1');
    assert(ise.sellOrderId === 7433192209 && ise.charId === '222' && ise.charName === 'Taron', 'BB30: Intact Shield Emitter – Order von Taron angehängt, Trade gehört jetzt Taron');
    assert(lo.sellOrderId === 7433192759 && lo.charId === '222', 'BB30: Liquid Ozone ebenso');
    assert(!L.some(t => t.sellOnly && (t.tid === 25608 || t.tid === 16273)) && L.filter(t => t.tid === 25608).length === 1, 'II4: kein doppelter „nur Verkauf“-Trade neben dem Lauf-Trade');
    assert(hub.sellOrderId === 555, 'BB30: normaler Dodixie-Trade findet seine Order weiter, obwohl ein Lauf nach Dodixie geht');
    const ev = T.trEvaluate(ise, T.getTrLive()[ise.id], T.tscFees(T.tscReadCfg()));
    assert(ev.sellCheck, 'BB30: eigene Verkaufsorder wird geprüft (Überboten-Alarm, Preis-Vorschlag)');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
