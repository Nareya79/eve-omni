// ESI-Modernisierung: X-Compatibility-Date statt /latest, Rueckfall auf /latest bei Netzwerk-/CORS-Fehler, 429-Wartezeit.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 60));

let CALLS = [], MODE = 'ok';
const w = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(win){
    win.fetch = function(url, opts){
      CALLS.push({ url: String(url), opts: opts || {} });
      const u = String(url);
      if (MODE === 'cors' && u.indexOf('https://esi.evetech.net/latest/') !== 0 && u.indexOf('https://esi.evetech.net/') === 0) return Promise.reject(new TypeError('Failed to fetch'));
      if (MODE === '429' && CALLS.filter(c => c.url === u).length === 1) return Promise.resolve({ ok:false, status:429, headers:{ get:k => (k === 'retry-after' ? '1' : null) }, json:() => Promise.resolve({}) });
      return Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve([]) });
    };
  }
}).window;

(async () => {
  try{
    await tick(500);
    const T = w.__test;
    assert(T.ESI_COMPAT_DATE === '2026-08-18', 'Kompatibilitaetsdatum gesetzt (live gepruefter Stand)');
    CALLS = [];
    await T.esiFetch('https://esi.evetech.net/markets/10000002/orders/?type_id=34', { headers: { Authorization: 'Bearer x' } });
    assert(CALLS.length === 1 && CALLS[0].url === 'https://esi.evetech.net/markets/10000002/orders/?type_id=34', 'Neue Adresse ohne /latest');
    assert(CALLS[0].opts.headers['X-Compatibility-Date'] === '2026-08-18', 'Header X-Compatibility-Date mitgeschickt');
    assert(CALLS[0].opts.headers.Authorization === 'Bearer x', 'Bestehende Header (Login) bleiben erhalten');

    CALLS = [];
    await T.esiFetch('https://login.eveonline.com/v2/oauth/token', { method:'POST', headers:{ 'Content-Type':'x' } });
    assert(CALLS.length === 1 && !CALLS[0].opts.headers['X-Compatibility-Date'], 'Andere Adressen (Login) bleiben unveraendert');

    // Interne Aufrufe laufen ueber den Wrapper
    CALLS = [];
    await T.getVolume(34);
    assert(CALLS.length === 1 && /^https:\/\/esi\.evetech\.net\/universe\/types\/34\//.test(CALLS[0].url) && CALLS[0].opts.headers['X-Compatibility-Date'], 'EVECore-Funktionen nutzen automatisch den neuen Weg');

    // 429: kurz warten, einmal wiederholen
    MODE = '429'; CALLS = [];
    const t0 = Date.now();
    const r = await T.esiFetch('https://esi.evetech.net/universe/types/99/');
    assert(r.status === 200 && CALLS.length === 2 && Date.now() - t0 >= 900, 'Bei 429 wird die Wartezeit (Retry-After) abgewartet und einmal wiederholt');

    // Netzwerk-/CORS-Fehler -> Rueckfall auf /latest fuer den Rest der Sitzung
    MODE = 'cors'; CALLS = [];
    const r2 = await T.esiFetch('https://esi.evetech.net/universe/types/35/', { headers:{ Authorization:'Bearer y' } });
    assert(r2.ok && CALLS.length === 2 && CALLS[1].url === 'https://esi.evetech.net/latest/universe/types/35/', 'Rueckfall auf alte /latest-Adresse');
    assert(!(CALLS[1].opts.headers || {})['X-Compatibility-Date'] && CALLS[1].opts.headers.Authorization === 'Bearer y', 'Rueckfall ohne neuen Header, Login bleibt');
    assert(T.isEsiLegacy(), 'Rueckfall gilt fuer die restliche Sitzung');
    CALLS = [];
    await T.esiFetch('https://esi.evetech.net/universe/types/36/');
    assert(CALLS.length === 1 && CALLS[0].url === 'https://esi.evetech.net/latest/universe/types/36/', 'Folgende Abfragen direkt ueber /latest');
    T.setEsiLegacy(false);

    // Normale Fehler (z. B. 404) fuehren nicht zum Rueckfall
    MODE = 'ok';
    const w2err = new Error('offline');
    const orig = w.fetch; w.fetch = () => Promise.reject(w2err);
    let thrown = null; try{ await T.esiFetch('https://esi.evetech.net/universe/types/37/'); }catch(e){ thrown = e; }
    assert(thrown === w2err && !T.isEsiLegacy(), 'Andere Fehler werden durchgereicht, kein Rueckfall');
    w.fetch = orig;

    console.log('\nALL ESI-COMPAT TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
