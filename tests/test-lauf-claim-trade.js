// 14.10.2026: Ein Hauling-Lauf ohne Einkauf nahm einem Trade einen ganzen Verkauf weg (Signal-5 'Needlejack': Lauf mit Plan 74 nahm
// 1.030 Stück → Trade im Minus) und zählte ihn bei sich als Gewinn. Jetzt: Lauf nimmt nur Gekauftes, und nur den gebrauchten Teil einer Buchung.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const now = Date.now(), H = 36e5, JITA = 60003760, AMARR = 60008494, DODI = 60011866, TID = 53984;
const it = q => [{ tid: TID, name: "Signal-5 'Needlejack' Filament", q: q, sp: q * 300000, p: q * 1000 }];
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + H, character_id: '111', character_name: 'Norren' }]));
  x.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: {
    1: [now - 50 * H, TID, 100, 300000, 1, JITA],    // Trade kauft in Jita
    2: [now - 9 * H, TID, 10, 250000, 1, AMARR],     // Lauf B kauft 10 in Amarr
    3: [now - 4 * H, TID, 110, 330000, 0, JITA] }, fee: {}, ord: {}, upd: now }));   // ein großer Verkauf: 100 vom Trade + 10 von Lauf B
  x.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([
    { id: 'ohneKauf', from: DODI, to: JITA, charId: '111', sm: 'order', created: now - 5 * H, status: 'done', doneAt: now - 3 * H, items: it(74) },
    { id: 'mitKauf', from: AMARR, to: JITA, charId: '111', sm: 'order', created: now - 8 * H, status: 'done', doneAt: now - 3 * H, wide: true, chkEnd: now - 3 * H, items: it(10) }]));
  x.fetch = () => Promise.reject(new Error('offline')); } }).window;
setTimeout(() => {
  try{
    const T = w.__test, R = T.hrLoad();
    const t = { id: 'tr', tid: TID, name: 'Needlejack', hub: 'jita', charId: '111', qty: 100, buy: 300000, sell: 330000, created: now - 51 * H, status: 'active' };
    const p = T.trProgress(t, null);
    assert(p.bought === 100 && p.sold === 100, 'Trade behält seine 100 aus dem großen Verkauf – gekauft ' + p.bought + ' · verkauft ' + p.sold);
    assert(p.cash > 0, 'Trade im Plus (' + Math.round(p.cash) + ')');
    const a = T.hrProgress(R.find(r => r.id === 'ohneKauf')), b = T.hrProgress(R.find(r => r.id === 'mitKauf'));
    assert(a.items[TID].s === 0 && a.profit === 0, 'Lauf ohne Einkauf: nichts verkauft, kein Gewinn – verkauft ' + a.items[TID].s + ', Gewinn ' + Math.round(a.profit));
    assert(b.items[TID].b === 10 && b.items[TID].s === 10 && b.profit > 0, 'Lauf mit Einkauf: 10 gekauft, 10 verkauft, Gewinn ' + Math.round(b.profit));
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
}, 800);
