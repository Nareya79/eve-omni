// BB24 (30.09.2026): Overlay-Klick fühlte sich träge an (~0,5 s) – Trades/Watchlist lasen je Trade/Lauf alle Wallet-Buchungen neu.
// Jetzt: gespeicherter Stand wird gemerkt (gleicher Text = gleiches Objekt), Gebühren und Lauf-Zuordnung je Stand einmal. Neue Daten = neu rechnen.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), JITA = 60003760, AMARR = 60008494;
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(w){
  w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]));
  w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, K = 'eve-zentrale-pnl-v1-111';
    const tr = { id: 'tx1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '111', qty: 100, buy: 5, sell: 6, created: now - 3600e3, status: 'active' };
    w.localStorage.setItem(K, JSON.stringify({ tx: { 1: [now - 3000e3, 34, 100, 5, 1, JITA], 3: [now - 600e3, 34, 30, 6, 0, JITA] }, fee: {}, ord: {}, upd: now }));
    const a = T.pnlLoadStore('111'), b = T.pnlLoadStore('111');
    assert(a === b, 'BB24: gleicher gespeicherter Stand → derselbe Zwischenspeicher (kein neues Entpacken)');
    let p = T.trProgress(tr);
    assert(p.bought === 100 && p.sold === 30, 'BB24: Trade vorher 100/30');
    // neue Buchung kommt dazu → neu rechnen
    w.localStorage.setItem(K, JSON.stringify({ tx: { 1: [now - 3000e3, 34, 100, 5, 1, JITA], 3: [now - 600e3, 34, 30, 6, 0, JITA], 5: [now - 60e3, 34, 20, 6, 0, JITA] }, fee: {}, ord: {}, upd: now }));
    assert(T.pnlLoadStore('111') !== a && T.trProgress(tr).sold === 50, 'BB24: neue Buchung → neuer Stand, Trade zählt 50 verkauft');
    // neuer Lauf nimmt Buchungen → Zuordnung neu
    const run = T.hrAdd(JITA, 'Jita', AMARR, 'Amarr', [{ tid: 34, name: 'Tritanium', q: 20, sp: 100, p: 20 }]);
    T.hrUpdate(run.id, { created: now - 3100e3, charId: '111' });
    p = T.trProgress(tr);
    assert(p.bought === 80, 'BB24: neuer Lauf → Zuordnung neu gerechnet (Lauf nimmt seine 20 aus der Kauf-Buchung, 14.10.: Rest bleibt dem Trade): ' + p.bought);
    // Speichern über pnlSaveStore leert den Zwischenspeicher
    const s = T.pnlLoadStore('111'); s.tx[9] = [now - 30e3, 34, 5, 6, 0, JITA]; T.pnlSaveStore('111', s);
    assert(T.pnlLoadStore('111') !== s && T.pnlLoadStore('111').tx[9], 'BB24: gespeicherter neuer Stand wird gelesen');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
