// II4 (05.10.2026): Orders aus EVE – Verkaufsorders an den 5 Hubs ohne Trade werden Verkaufs-Trades (Einkauf aus der Wallet, sonst
// „ohne Einkauf“ = Ergebnis ist der Erlös), Löschen ignoriert die Order dauerhaft, Erkennung im EVE-Takt auch im Hintergrund.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now(), H = 3600000, JITA = 60003760;
(async () => {
  try{
    const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } });
    const w = dom.window; await tick(300);
    const T = w.__test;
    // Wallet von Charakter 111: Tritanium (34) zweimal gekauft, Pyerite (35) nie
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [NOW - 5 * H, 34, 600, 4, true, JITA], 2: [NOW - 3 * H, 34, 400, 5, true, JITA], 3: [NOW - 1 * H, 34, 100, 9, true, 60008494] }, fee: {}, ord: {}, upd: NOW }));
    const pb = T.trPreBuy('111', 34, 1000, NOW - 2 * H);
    assert(pb.q === 1000 && pb.v === 600 * 4 + 400 * 5, 'Einkauf aus der Wallet: jüngste Käufe vor der Order bis zur Ordermenge (Kauf nach der Order zählt nicht)');
    const ord = (id, tid, buy, price, vol, issued) => ({ charId: '111', charName: 'Orvan', hub: 'jita', order: { order_id: id, type_id: tid, is_buy_order: buy, price, volume_total: vol, volume_remain: vol, location_id: JITA, issued: new Date(issued).toISOString() } });
    let added = T.trSync({ list: [ord(901, 34, false, 6, 1000, NOW - 2 * H), ord(902, 35, false, 15, 50, NOW - H), ord(903, 36, true, 20, 10, NOW - H)], ok: { 111: true } });
    assert(added.length === 3, 'drei neue Trades: zwei Verkaufsorders + eine Kauforder');
    const tl = T.trLoad(), a = tl.find(t => t.sellOrderId === 901), b = tl.find(t => t.sellOrderId === 902), c = tl.find(t => t.buyOrderId === 903);
    assert(a.sellOnly && a.buyDone && a.qty === 1000 && Math.abs(a.buy - 4.4) < 1e-9 && a.sell === 6 && !a.pre.none, 'Verkaufs-Trade mit Ø-Einkauf 4,40 aus der Wallet');
    assert(b.sellOnly && b.buy === null && b.pre.none && b.pre.v === 0, 'Verkaufs-Trade ohne Einkauf in der Wallet');
    assert(c && !c.sellOnly && c.buy === 20, 'Kauforder wie bisher');
    const pa = T.trProgressII(a, null), pbb = T.trProgressII(b, null);
    assert(pa.bought === 1000 && Math.abs(pa.boughtVal - 4400) < 1e-6 && !pa.noBuy && pbb.noBuy && pbb.bought === 50, 'Fortschritt: vorhandene Ware zählt als gekauft');
    assert(/nur Verkauf/.test(T.trRunTagII(a)) && /ohne Einkauf/.test(T.trRunTagII(b)) && !/ohne Einkauf/.test(T.trRunTagII(a)), 'Kennzeichnung „nur Verkauf“ / „ohne Einkauf“');
    added = T.trSync({ list: [ord(901, 34, false, 6, 1000, NOW - 2 * H)], ok: { 111: true } });
    assert(added.length === 0, 'bekannte Order wird nicht doppelt angelegt');
    T.tkAct('Trade', b.id, 'del');
    assert(T.trIgnoredII()[902], 'Löschen ignoriert die Verkaufsorder');
    added = T.trSync({ list: [ord(902, 35, false, 15, 50, NOW - H)], ok: { 111: true } });
    assert(added.length === 0 && !T.trLoad().some(t => t.sellOrderId === 902), 'gelöschter Verkaufs-Trade kommt nicht wieder');
    const src = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
    assert(/function esiTaktTick\(\)\{\s*if \(!loadAllTokens\(\)\.length\) return;\s*if \(Date\.now\(\) - trAutoLast > 20 \* 60000 \|\| esiDue\(\["\/characters\/orders"\], trAutoLast, 120000\)\) trAutoSync\(true\)\.then\(trAutoNotify\);/.test(src), 'Hintergrund: Abgleich im EVE-Takt der Orders (höchstens alle 20 Min.) mit Meldung');
    console.log('\nALL II4 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e.message); process.exit(1); }
})();
