// B3: Hauling-Umkreis bis 15 Jumps oder direktes Ziel (Hub oder eigenes System, Sprünge aus der Route).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const ok = d => Promise.resolve({ ok: true, status: 200, headers: { get: () => '1' }, json: () => Promise.resolve(d) });
const TID = 555;
// Alpha (Start) - Beta - Gamma, eine Region; Beta kauft teurer als Gamma
const SYSTEMS = { 9001: { name: 'Alpha', constellation_id: 8001, stations: [5001], stargates: [71] },
                  9002: { name: 'Beta', constellation_id: 8001, stations: [5002], stargates: [72] },
                  9003: { name: 'Gamma', constellation_id: 8001, stations: [5003], stargates: [] } };
const STATIONS = { 5001: { name: 'Alpha Trade Post', system_id: 9001 }, 5002: { name: 'Beta Trade Post', system_id: 9002 },
                   5003: { name: 'Gamma Trade Post', system_id: 9003 } };
const BOOK = { sell: [{ type_id: TID, location_id: 5001, price: 100, volume_remain: 1000 }],
               buy: [{ type_id: TID, location_id: 5002, price: 200, volume_remain: 1000 }, { type_id: TID, location_id: 5003, price: 150, volume_remain: 1000 }] };
let calls = [];
function fakeFetch(url, opts){
  const u = String(url); calls.push(u); let m;
  if (u.includes('/universe/ids/') && opts && opts.method === 'POST'){
    const n = JSON.parse(opts.body)[0], id = { Alpha: 9001, Gamma: 9003 }[n];
    return ok(id ? { systems: [{ id, name: n }] } : {});
  }
  if (u.match(/\/route\/9001\/9003/)) return ok({ route: [9001, 9002, 9003] });
  if ((m = u.match(/\/universe\/systems\/(\d+)\//))) return ok(SYSTEMS[m[1]]);
  if ((m = u.match(/\/universe\/stargates\/(\d+)\//))) return ok({ destination: { system_id: m[1] === '71' ? 9002 : 9003 } });
  if (u.match(/\/universe\/constellations\//)) return ok({ region_id: 7001 });
  if ((m = u.match(/\/universe\/stations\/(\d+)\//))) return ok(STATIONS[m[1]] || { name: 'Hub', system_id: 1 });
  if (u.match(/\/universe\/types\/555\//)) return ok({ name: 'Test Ore', volume: 1 });
  if ((m = u.match(/\/markets\/7001\/orders\/.*order_type=(sell|buy)/))) return ok(BOOK[m[1]]);
  return Promise.reject(new Error('offline'));
}
function makeWindow(store){
  return new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
    beforeParse(w){ Object.keys(store || {}).forEach(k => w.localStorage.setItem(k, store[k])); w.fetch = fakeFetch; } }).window;
}
const rows = w => [].map.call(w.document.querySelectorAll('#hl-dest-body tr'), tr => [].map.call(tr.cells, c => c.textContent).join('|'));

(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let $ = id => w.document.getElementById(id);
    assert($('hl-radius').max === '15' && $('hl-target').value === '' && !$('hl-radius').disabled && $('hl-target-sys').disabled, 'Standard: Umkreis, Radius bis 15, Ziel-System gesperrt');
    assert($('hl-target').options.length === 7, 'Ziel: Umkreis + 5 Hubs + eigenes System');
    $('hl-hub').value = ''; $('hl-hub').onchange(); $('hl-start').value = 'Alpha';
    $('hl-cargo').value = '5000'; $('hl-budget').value = '1000000000'; $('hl-tax').value = '0';

    // Umkreis 20 -> auf 15 begrenzt; beide Ziele gefunden, Beta (teurer) vorn
    $('hl-radius').value = '20';
    await w.__test.runHaulingSearch();
    let r = rows(w);
    assert(r.length === 2 && /Beta/.test(r[0]) && /Gamma/.test(r[1]), 'Umkreis: Beta und Gamma (' + r.length + ')');

    // direktes Ziel: nur Gamma, Jumps aus der Route (2)
    $('hl-target').value = 'sys'; $('hl-target').onchange();
    assert($('hl-radius').disabled && !$('hl-target-sys').disabled, 'Ziel gewählt: Radius gesperrt, Ziel-System frei');
    $('hl-target-sys').value = 'Gamma';
    $('hl-target').dispatchEvent(new w.Event('change', { bubbles: true }));
    calls = [];
    await w.__test.runHaulingSearch();
    r = rows(w);
    assert(r.length === 1 && /Gamma/.test(r[0]) && /\|2\|/.test(r[0]), 'Ziel Gamma: nur Gamma, 2 Jumps (' + r.join(' | ') + ')');
    assert(calls.some(u => /\/route\/9001\/9003/.test(u)) && !calls.some(u => /\/stargates\//.test(u)), 'Route geholt, keine Umkreis-Suche');

    // unbekanntes Ziel
    $('hl-target-sys').value = 'Nirgendwo';
    await w.__test.runHaulingSearch();
    assert(/Kein System „Nirgendwo“/.test($('hl-status').textContent), 'unbekanntes Ziel-System gemeldet');
    $('hl-target-sys').value = 'Gamma'; $('hl-target-sys').dispatchEvent(new w.Event('change', { bubbles: true }));
    const saved = JSON.parse(w.localStorage.getItem('eve-zentrale-hauling-v1'));
    w.close();

    // gemerkt
    w = makeWindow({ 'eve-zentrale-hauling-v1': JSON.stringify(saved) }); await tick(500);
    $ = id => w.document.getElementById(id);
    assert($('hl-target').value === 'sys' && $('hl-target-sys').value === 'Gamma' && $('hl-radius').disabled, 'Ziel wird gemerkt');
    w.close();
    console.log('\nALL HAULING-ZIEL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.log(e.stack || e.message); console.log('HAULING-ZIEL TESTS FAILED'); process.exit(1); }
})();
