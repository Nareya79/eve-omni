// 08.10.2026: Alter Order-Lauf (nach „Prüfen“ bis heute verlängert) zählte die Sofortverkäufe späterer Läufe derselben Ware als „verkauft“
// (Large F-S9: gekauft 105 · verkauft 105, obwohl 98 noch in der Order standen)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const now = Date.now(), H = 36e5, JITA = 60003760, DODI = 60011866;
const it = q => [{ tid: 8529, name: 'Large F-S9 Regolith Compact Shield Extender', q: q, sp: q * 50000, p: q * 2000 }];
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + H, character_id: '111', character_name: 'Norren' }]));
  x.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: {
    1: [now - 100 * H, 8529, 105, 50000, 1, JITA],   // alter Lauf kauft
    2: [now - 90 * H, 8529, 7, 95000, 0, DODI],      // alter Lauf: 7 aus der Order verkauft
    3: [now - 20 * H, 8529, 300, 50000, 1, JITA],    // neuer Lauf kauft
    4: [now - 19 * H, 8529, 300, 60000, 0, DODI],    // neuer Lauf verkauft sofort
    5: [now - 5 * H, 8529, 2, 94000, 0, DODI] }, fee: {}, ord: {}, upd: now }));   // nach dem neuen Lauf: wieder aus der alten Order
  x.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify([
    { id: 'alt', from: JITA, to: DODI, charId: '111', sm: 'order', created: now - 101 * H, status: 'done', doneAt: now - 30 * H, wide: true, chkEnd: now, items: it(105) },
    { id: 'neu', from: JITA, to: DODI, charId: '111', sm: 'instant', created: now - 21 * H, status: 'done', doneAt: now - 18 * H, wide: true, chkEnd: now, items: it(300) }]));
  x.fetch = () => Promise.reject(new Error('offline')); } }).window;
setTimeout(() => {
  try{
    const T = w.__test, R = T.hrLoad(), a = T.hrProgress(R[0]).items[8529], n = T.hrProgress(R[1]).items[8529];
    assert(a.b === 105 && a.s === 9, 'alter Lauf: gekauft 105 · verkauft 9 (7 + 2 aus der Order, nicht die 300 Sofortverkäufe) – ist ' + a.s);
    assert(n.b === 300 && n.s === 300, 'neuer Lauf behält seine 300 Sofortverkäufe');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
}, 800);
