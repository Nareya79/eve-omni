// MI3 (30.09.2026): Mond-Abbau der Corp – Extraktionen (Station Manager) + Beobachter (Accountant), Rollen-Hinweis, Timer in der Uhr
// mit Vorwarnung (fester Termin), Reiter Mining › Mond per Klick, Overlay, Einstellungen › Alarme › Mond-Timer
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JWT = s => 'x.' + Buffer.from(JSON.stringify({ scp: s })).toString('base64') + '.y';
const now = Date.now(), ARR = now + 5 * 3600e3, CO = 98000001, CO2 = 98000002;
let noRole = false;
const json = x => Promise.resolve({ ok: true, status: 200, headers: { get: k => /x-pages/i.test(k) ? '1' : null }, json: () => Promise.resolve(x) });
const e403 = () => Promise.resolve({ ok: false, status: 403, headers: { get: () => null }, json: () => Promise.resolve({ error: 'Character does not have required role(s)' }), text: () => Promise.resolve('forbidden') });
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
    { access_token: JWT(['esi-industry.read_corporation_mining.v1', 'esi-ui.write_waypoint.v1']), refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' },
    { access_token: JWT(['esi-industry.read_corporation_mining.v1']), refresh_token: 'r', expires_at: now + 36e5, character_id: '222', character_name: 'Zwei' }]));
  x.fetch = (u, o) => { u = String(u); let m;
    if ((m = /characters\/(\d+)\/?\?/.exec(u)) || (m = /characters\/(\d+)\/$/.exec(u))) return json({ corporation_id: m[1] === '111' ? CO : CO2, name: 'X' });
    if (/corporations\/98000001\//.test(u)) return json({ name: 'Omni Corp' });
    if (/corporations\/98000002\//.test(u)) return json({ name: 'Andere Corp' });
    if (/corporation\/98000002\/mining/.test(u)) return e403();
    if (/corporation\/98000001\/mining\/extractions/.test(u)) return noRole ? e403() : json([{ moon_id: 40009077, structure_id: 1035000000001, chunk_arrival_time: new Date(ARR).toISOString(), natural_decay_time: new Date(ARR + 3 * 3600e3).toISOString(), extraction_start_time: new Date(now - 864e5).toISOString() }]);
    if (/corporation\/98000001\/mining\/observers\/1035000000001/.test(u)) return json([{ character_id: 333, last_updated: new Date(now - 864e5).toISOString().slice(0, 10), quantity: 10000, recorded_corporation_id: CO, type_id: 1230 }]);
    if (/corporation\/98000001\/mining\/observers/.test(u)) return json([{ observer_id: 1035000000001, last_updated: new Date(now).toISOString().slice(0, 10), observer_type: 'structure' }]);
    if (/universe\/moons\/40009077/.test(u)) return json({ name: 'Jita IV - Moon 4', system_id: 30000142 });
    if (/universe\/structures\//.test(u)) return json({ name: 'Jita - Omni Athanor', solar_system_id: 30000142, type_id: 35835 });
    if (/universe\/systems\/30000142/.test(u)) return json({ name: 'Jita', security_status: 0.95, constellation_id: 20000020 });
    if (/universe\/constellations\//.test(u)) return json({ region_id: 10000002 });
    if (/universe\/names/.test(u)){ const ids = JSON.parse(o.body); return json(ids.map(id => ({ id, name: id === 333 ? 'Bergmann' : id === 10000002 ? 'The Forge' : 'N' + id }))); }
    if ((m = /markets\/10000002\/orders\/.*type_id=(\d+)/.exec(u))){ const p = { 1230: 20, 62516: 22 }[m[1]]; return json(p ? [{ is_buy_order: true, location_id: 60003760, system_id: 30000142, range: 'station', price: p, volume_remain: 1e9, min_volume: 1 }] : []); }
    if (/ui\/autopilot\/waypoint/.test(u)) return Promise.resolve({ ok: true, status: 204, headers: { get: () => null }, json: () => Promise.resolve(null), text: () => Promise.resolve('') });
    return Promise.reject(new Error('offline ' + u)); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    assert(/"esi-industry\.read_corporation_mining\.v1"/.test(html), 'MI3: neue Berechtigung in der Login-Liste');
    // Reiter per Klick → lädt selbst
    $('neo-btn-mining').click(); await tick(100);
    d.querySelector('#mi-page [data-ova="miView"][data-arg="moon"]').click(); await tick(600);
    const st = JSON.parse(w.localStorage.getItem('eve-zentrale-moons-v1')), c1 = st.corps.find(c => +c.id === CO), c2 = st.corps.find(c => +c.id === CO2);
    assert(c1 && c1.ex.length === 1 && c1.ex[0].mn === 'Jita IV - Moon 4' && c1.ex[0].sys === 30000142 && c1.ex[0].arr === Date.parse(new Date(ARR).toISOString()), 'MI3: Extraktion mit Mondname, System und Ankunft');
    assert(c2 && /Station Manager/.test(c2.err) && /Accountant/.test(c2.oerr), 'MI3: fehlende Corp-Rolle → klarer Hinweis statt Fehler');
    assert(c1.obs.length === 1 && c1.obs[0].n === 'Bergmann' && c1.obs[0].q[1230] === 10000, 'MI3: Beobachter – wer wie viel abgebaut hat');
    const pg = $('mi-page');
    assert(/Brocken in/.test(pg.textContent) && /Rolle „Station Manager“/.test(pg.textContent) && /Bergmann/.test(pg.textContent) && pg.querySelector('[data-ova="mnDest"]'), 'MI3: Seite zeigt Countdown, Rollen-Hinweis, Abbau je Pilot, Ziel-Knopf');
    // Timer in der Uhr (30 Min. Vorwarnung)
    let tm = JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1')), mt = tm.list.find(t => /^moon:/.test(t.src));
    assert(mt && mt.mode === 'at' && mt.at === c1.ex[0].arr && mt.pre === 30 && /Mond Jita IV - Moon 4/.test(mt.name), 'MI3: Timer „Mond …“ mit fester Ankunft und 30 Min. Vorwarnung');
    assert(T.tmTick(ARR - 31 * 60000).length === 0, 'MI3: vor der Vorwarnung kein Alarm');
    const hit = T.tmTick(ARR - 29 * 60000);
    assert(hit.length === 1 && /Mond Jita IV - Moon 4 in 29 Min\./.test(hit[0]), 'MI3: Alarm 30 Min. vorher: ' + hit[0]);
    assert(T.tmTick(ARR + 60000).length === 0, 'MI3: nur einmal');
    // Einstellungen › Alarme: Vorwarnung ändern
    const sel = $('tm-moonpre'); sel.value = '60'; sel.dispatchEvent(new w.Event('change')); await tick(50);
    tm = JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1'));
    assert(tm.list.find(t => /^moon:/.test(t.src)).pre === 60 && $('tm-list').textContent.indexOf('Mond Jita IV') >= 0, 'MI3: Vorwarnung in Einstellungen › Alarme, Timer in der Uhr-Liste');
    const cb = $('tm-moon'); cb.checked = false; cb.dispatchEvent(new w.Event('change')); await tick(50);
    assert(!JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1')).list.some(t => /^moon:/.test(t.src)), 'MI3: Mond-Timer ausschaltbar');
    cb.checked = true; cb.dispatchEvent(new w.Event('change')); await tick(50);
    // Ziel setzen
    d.querySelector('#mi-page [data-ova="mnDest"]').click(); await tick(150);
    assert(/Ziel .* im Spiel gesetzt/.test(pg.textContent), 'MI3: Struktur als Ziel im Autopiloten');
    // Overlay + Uhr-Overlay
    const box = d.createElement('div'); T.ovRenderViewInto('mining', box);
    assert(/Brocken in/.test(box.textContent) && box.querySelector('.mn-row .tsc-cp-b[data-copy="Jita"]'), 'MI3: Mining-Overlay mit Mond-Timer, System kopierbar');
    const ub = d.createElement('div'); T.ovRenderViewInto('uhr', ub);
    assert(/Mond Jita IV - Moon 4/.test(ub.textContent), 'MI3: Mond-Timer im Uhr-Overlay');
    // Extraktion verschwindet → Timer weg
    noRole = true; await T.mnAction({ type: 'mnGo' }); await tick(300);
    assert(!JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1')).list.some(t => /^moon:/.test(t.src)), 'MI3: keine Extraktion mehr → Timer entfernt');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
