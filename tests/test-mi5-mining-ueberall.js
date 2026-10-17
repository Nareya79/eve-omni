// MI5 (30.09.2026): Mining in bestehenden Bereichen – Karten-Ebene „⛏ Mining“ (Tagebuch-Systeme + Mond-Extraktionen, groß + Overlay),
// Assets „→ Verkaufen“ bei Erz (öffnet Mining › Verkaufen mit Menge), Wallet-Bericht „Verkauft: Erz/Mineralien“
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now(), day = o => new Date(now - o * 864e5).toISOString().slice(0, 10), JITA = 60003760;
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){
  x.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: now + 36e5, character_id: '111', character_name: 'Eins' }]));
  x.localStorage.setItem('eve-zentrale-miningledger-v1', JSON.stringify({ e: { ['111|' + day(1) + '|30000142|1230']: ['111', day(1), 30000142, 1230, 5000], ['111|' + day(60) + '|30000144|1230']: ['111', day(60), 30000144, 1230, 5000] }, cn: { 111: 'Eins' }, t: now }));
  x.localStorage.setItem('eve-zentrale-moons-v1', JSON.stringify({ t: now, corps: [{ id: 98000001, name: 'C', ex: [{ moon: 1, mn: 'Perimeter I - Moon 1', sys: 30000145, st: 2, stn: 'A', arr: now + 36e5, decay: now + 72e5 }] }] }));
  x.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { 1: [now - 864e5, 62516, 1000, 20, 0, JITA], 2: [now - 864e5, 34, 10000, 4, 0, JITA], 3: [now - 864e5, 587, 1, 1e6, 0, JITA] }, fee: {}, ord: {}, upd: now }));
  x.fetch = (u) => { u = String(u); let m;
    if ((m = /markets\/(\d+)\/orders\/.*type_id=(\d+)/.exec(u))) return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve(+m[2] === 62516 ? [{ is_buy_order: true, location_id: JITA, system_id: 30000142, range: 'station', price: 22, volume_remain: 1e9, min_volume: 1 }] : []) });
    return Promise.reject(new Error('offline')); }; } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, $ = id => d.getElementById(id);
    // Karte
    const ms = T.mpMiningSys();
    assert(ms[30000142] && /Abgebaut \(30 Tage\)/.test(ms[30000142]) && !ms[30000144] && /Perimeter I - Moon 1: Brocken in/.test(ms[30000145]), 'MI5: Mining-Systeme = Tagebuch (30 Tage, nicht älter) + Mond-Extraktionen');
    assert($('mp-o-mn') && html.indexOf('pb("mapTog", "mn"') >= 0, 'MI5: Schalter „⛏ Mining“ in großer Karte und Overlay-Karte');
    assert(/\.mn-ring/.test(html) && /class="mn-ring"/.test(html) && /"mn-ring"\)/.test(html), 'MI5: Ring in beiden Karten');
    // Assets: → Verkaufen
    T.asRender({ v: true, v2: 1, n: 1, g: [{ cid: '111', name: 'Eins', locs: [{ id: String(JITA), name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', sys: null, st: null,
      rows: [{ tid: 62516, name: 'Compressed Veldspar', qty: 40000, estValue: 8e5, vol: 40 }, { tid: 34, name: 'Tritanium', qty: 5, estValue: 20, vol: 0.05 }] }] }] });
    T.switchTab('assets'); T.asPageRender(); await tick(50);
    d.querySelector('#as-body [data-ova="asLoc"]').click(); await tick(50);
    const b = d.querySelector('#as-body [data-ova="asOreSell"]');
    assert(b && b.getAttribute('data-arg') === '62516:40000' && d.querySelectorAll('#as-body [data-ova="asOreSell"]').length === 1, 'MI5: „→ Verkaufen“ nur bei Erz (komprimiert erkannt), nicht bei Mineralien');
    b.click(); await tick(300);
    const md = T.miLoad();
    assert(md.view === 'sell' && md.stid === 1230 && md.svar === 'cmp' && md.sq === 40000 && $('panel-mining').classList.contains('active'), 'MI5: öffnet Mining › Verkaufen mit Veldspar, komprimiert, 40.000');
    // Wallet-Bericht
    const row = T.nwReportRows(T.nwReport('w')).find(x => /Erz\/Mineralien/.test(x[0]));
    assert(row && row[1] === T.shortIsk(1000 * 20 + 10000 * 4), 'MI5: Wochenbericht „Verkauft: Erz/Mineralien“ ohne andere Waren: ' + (row && row[1]));
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
