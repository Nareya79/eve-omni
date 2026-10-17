// 5.0.6 (17.10.2026): „Als Ziel setzen“ im Hauling-Overlay – Rückmeldung mit Charakter im Overlay, Station-ID gemerkt, Zeitüberschreitung gemeldet
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), calls = [];
let hang = false;
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.AbortSignal.timeout = ms => { const c = new w.AbortController(); setTimeout(() => { const e = new Error('timeout'); e.name = 'TimeoutError'; c.abort(e); }, hang ? 50 : ms); return c.signal; };
    w.fetch = (u, o) => { u = String(u); calls.push(u);
      if (hang) return new Promise((res, rej) => o && o.signal && o.signal.addEventListener('abort', () => rej(o.signal.reason)));
      if (/universe\/ids/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ stations: [{ id: 60003760 }] }) });
      if (/autopilot\/waypoint/.test(u)) return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) });
      return Promise.reject(new Error('offline')); };
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }])); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, st = 'Jita IV - Moon 4 - Caldari Navy Assembly Plant';
    const p = T.stDest(st, w.document.createElement('button'), true);
    assert(/^Setze Ziel Jita IV/.test(T.getHaulRouteMsg()), 'Overlay zeigt sofort „Setze Ziel …“');
    const msg = await p;
    assert(msg === 'Eins: Ziel ' + st + ' im Spiel gesetzt.' && T.getHaulRouteMsg() === msg, 'Ergebnis mit Charakter im Overlay: ' + msg);
    assert(calls.some(u => /waypoint\/\?add_to_beginning=false&clear_other_waypoints=true&destination_id=60003760/.test(u)), 'Ziel = Station 60003760');
    const n = calls.filter(u => /universe\/ids/.test(u)).length;
    await T.stDest(st, w.document.createElement('button'), true);
    assert(calls.filter(u => /universe\/ids/.test(u)).length === n, '2. Klick ohne neue Namensabfrage (ID gemerkt)');
    const b = w.document.createElement('button'); await T.stDest(st, b, false);
    assert(b.classList.contains('ok'), 'große Seite: Knopf zeigt ✓ (Meldung mit Charaktername)');
    hang = true;
    const m2 = await T.stDest(st, w.document.createElement('button'), true);
    assert(/^Eins: Nicht gesetzt: EVE antwortet nicht \(Zeitüberschreitung\)$/.test(m2), 'hängende Anfrage → Meldung statt ewig warten');
    console.log('\nALL STDEST TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
