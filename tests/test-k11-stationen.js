// K11 (24.10.2026): OmniMap › EVE Omni – Stationsdienste inkl. Industrie/Labor/Raffinerie (ESI factory/labratory/reprocessing-plant),
// nur Stationen mit ALLEN angehakten Diensten (Name für den Tooltip), neuer Speicher mapstations-v2, alte v1-Daten werden gelöscht.
const fs = require('fs');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 50));
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
(async () => {
  try{
    const ST = { 60000001: { name: 'Testsystem I - Fabrik', services: ['factory', 'cloning', 'market'] }, 60000002: { name: 'Testsystem II - Labor', services: ['labratory', 'reprocessing-plant'] } };
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.localStorage.setItem('eve-zentrale-mapstations-v1', '{"30000001":[[1,"alt",""]]}');
        const J = d => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(d) });
        w.fetch = u => { u = String(u); if (/universe\/systems\/30000001\//.test(u)) return J({ system_id: 30000001, name: 'Testsystem', stations: [60000001, 60000002] });
          const m = /universe\/stations\/(\d+)\//.exec(u); if (m && ST[m[1]]) return J(ST[m[1]]); return Promise.reject(new Error('offline')); }; } }).window;
    await tick(800);
    const T = w.__test;
    assert(w.localStorage.getItem('eve-zentrale-mapstations-v1') === null, 'alte Stationsdaten (ohne Industrie/Labor/Raffinerie) gelöscht');
    await T.mpStations([30000001]);
    const v2 = JSON.parse(w.localStorage.getItem('eve-zentrale-mapstations-v2'))['30000001'];
    assert(v2 && v2.length === 2 && v2.find(x => x[1] === 'Testsystem I - Fabrik')[2].split('').sort().join('') === 'IKM' && v2.find(x => x[1] === 'Testsystem II - Labor')[2] === 'LP', 'Dienste-Kürzel: Industrie I, Labor L (ESI „labratory“), Raffinerie P');
    const set = sv => { const st = T.mpLoadStore(); st.kmO = Object.assign({}, st.kmO, { om: { me: 1, st: 1, sv } }); T.mpSaveStore(st); return T.kmOmState().st['30000001']; };
    let r = set('I');
    assert(r.length === 1 && r[0][0] === 'Testsystem I - Fabrik', 'Industrie angehakt → nur die Fabrik-Station (Name für den Tooltip)');
    r = set('IK');
    assert(r.length === 1 && r[0][0] === 'Testsystem I - Fabrik', 'Industrie + Klonbank → Station mit beiden');
    r = set('IL');
    assert(Array.isArray(r) && r.length === 0, 'Industrie + Labor in keiner Station → leer (System leuchtet nicht)');
    r = set('LP');
    assert(r.length === 1 && r[0][0] === 'Testsystem II - Labor', 'Labor + Raffinerie → Labor-Station');
    assert(/var KM_ST_GLOW = "rgba\(196,107,255/.test(html) && /K11a: weiß leuchtende Kiste/.test(html), 'Stationen leuchten Violett, Assets als weiße Kiste');
    console.log('\nALL K11 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); console.log('FAILED'); process.exit(1); }
})();
