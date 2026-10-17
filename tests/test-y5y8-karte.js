// Y5/Y8 (27.09.2026): Karten wie in EVE – Hintergrund-Flächen, Zahlen je System, Region unter fremden Systemen, Regionsübersicht (große + Overlay-Karte)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
// Region Delve: A(1)-B(2)-C(3)-D(4); Outer(5) liegt in The Forge
const SYS = { 1:{ name:'1DQ1-A', s:-0.4, c:100, x:0, z:0, g:[11], st:[601] }, 2:{ name:'8QT-H4', s:-0.3, c:100, x:10, z:0, g:[21, 22] }, 3:{ name:'Q-JQSG', s:-0.5, c:100, x:20, z:5, g:[31, 32] },
              4:{ name:'MJXW-P', s:-0.1, c:100, x:30, z:0, g:[41, 42] }, 5:{ name:'Outer', s:0.5, c:200, x:60, z:0, g:[51], st:[602] } };
const GATES = { 11:2, 21:1, 22:3, 31:2, 32:4, 41:3, 42:5, 51:4 };
const STATIONS = { 601:{ name:'1DQ1-A - Fortress', services:['market', 'cloning', 'repair-facilities', 'docking'] }, 602:{ name:'Outer IV - Hub', services:['market'] } };
const now = Date.now();
const GR = [{ key:'3:' + now, sys:3, n:'Q-JQSG', s:-0.5, dist:1, who:'', att:12, kills:4, first:now - 60000, last:now, ships:['Rifter'], orgs:['[ABC]'],
  p:[{ i:900, n:'Bad Guy', s:587, sn:'Rifter', c:0, t:'' }], v:[{ i:901, n:'Opfer', s:587, sn:'Rifter', t:'' }], sh:[] }];
let CALLS = [];
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = function(url, opts){
        const u = String(url); let m; CALLS.push(u);
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (u.indexOf('/universe/ids/') >= 0){
          const names = JSON.parse(opts.body);
          return ok({ systems: names.map(n => { const id = Object.keys(SYS).find(k => SYS[k].name.toLowerCase() === String(n).toLowerCase()); return id ? { id:+id, name:SYS[id].name } : null; }).filter(Boolean) });
        }
        if (/\/characters\/111\/location\//.test(u)) return ok({ solar_system_id: 1, station_id: 601 });
        if (/\/characters\/111\/online\//.test(u)) return ok({ online: true });
        if (/\/characters\/111\/ship\//.test(u)) return ok({ ship_type_id: 587, ship_name: 'Flitzer' });
        if ((m = u.match(/\/universe\/regions\/(\d+)\//))) return ok({ region_id: +m[1], name: m[1] === '10000002' ? 'The Forge' : 'Delve', constellations: m[1] === '10000002' ? [200] : [100] });
        if (/\/universe\/regions\//.test(u)) return ok([10000060, 10000002]);
        if ((m = u.match(/\/universe\/constellations\/(\d+)\//))) return ok({ region_id: m[1] === '200' ? 10000002 : 10000060, systems: m[1] === '100' ? [1, 2, 3, 4] : [5] });
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))){ const x = SYS[m[1]]; return ok({ name: x.name, security_status: x.s, constellation_id: x.c, position: { x: x.x * 1e15, y: 0, z: x.z * 1e15 }, stargates: x.g, stations: x.st }); }
        if ((m = u.match(/\/universe\/stargates\/(\d+)\//))) return ok({ destination: { system_id: GATES[m[1]] } });
        if ((m = u.match(/\/universe\/stations\/(\d+)\//))) return ok(STATIONS[m[1]]);
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: ({ 10000060: 'Delve', 10000002: 'The Forge', 587: 'Rifter', 99000001: 'Goons' })[id] || ('X' + id) })));
        if (/sovereignty\/map/.test(u)) return ok([{ system_id: 1, alliance_id: 99000001 }, { system_id: 2, alliance_id: 99000001 }, { system_id: 5, faction_id: 500001 }]);
        if (/system_kills/.test(u)) return ok([{ system_id: 3, ship_kills: 7, pod_kills: 2, npc_kills: 40 }]);
        if (/system_jumps/.test(u)) return ok([{ system_id: 2, ship_jumps: 50 }]);
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    const w = makeWindow({ 'eve-zentrale-gangreport-v1': JSON.stringify(GR) }); await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    await T.chRefresh(false); await tick(100);
    T.navShow('map'); await tick(300);
    await T.mpShow(10000060); await tick(300);
    let svg = $('mp-svg');
    assert(svg.querySelectorAll('circle.bgf').length === 1 && $('mp-bg').querySelectorAll('button').length === 8 && $('mp-bg').querySelector('[data-mpb="kills"][aria-pressed="true"]'), 'Große Karte: Hintergrund Kills als Fläche (nur System mit Kills), 8 Auswahlen');
    assert(/Füllung: Farbe = Kills/.test($('mp-legend').textContent), 'Legende nennt die Füllung (KA: früher Hintergrund)');
    const nu = [...svg.querySelectorAll('text.nu')].map(t => t.textContent).join('|');
    assert(/⇄ 50/.test(nu) && /✕ 9/.test(nu), 'Zahlen je System: Sprünge und Kills: ' + nu);
    const ex = svg.querySelector('text.ext');
    assert(ex && /Outer/.test(ex.textContent) && (!ex.querySelector('tspan.rg') || /The Forge/.test(ex.querySelector('tspan.rg').textContent)), 'Fremdes System, Region (wenn bekannt) in eigener Zeile: ' + ex.innerHTML);
    $('mp-bg').querySelector('[data-mpb="npc"]').click();
    assert(svg.querySelectorAll('circle.bgf').length === 1 && JSON.parse(w.localStorage.getItem('eve-zentrale-map-v1')).bg === 'npc', 'Hintergrund umschaltbar und gemerkt');
    $('mp-bg').querySelector('[data-mpb="none"]').click();
    assert(!svg.querySelector('circle.bgf'), 'Hintergrund „Keiner“');
    $('mp-o-nu').checked = false; $('mp-o-nu').onchange.call($('mp-o-nu'));
    assert(!svg.querySelector('text.nu'), 'Zahlen ausblendbar');
    $('mp-uni').click();
    assert(svg.querySelectorAll('g.ur').length === 70 && svg.querySelectorAll('line.ue').length > 150 && svg.querySelector('g.ur.cur[data-reg="10000060"]') && $('mp-uni').getAttribute('aria-pressed') === 'true', 'Regionsübersicht: 70 Regionen, Verbindungen, aktuelle Region hervorgehoben');
    assert(svg.querySelector('g.ur.u-c[data-reg="10000002"]') && svg.querySelector('g.ur.u-a[data-reg="10000043"]') && svg.querySelector('g.ur.u-m[data-reg="10000042"]'), 'Farbe je Fraktion (Caldari, Amarr, Minmatar)');
    const fr = svg.querySelector('g.ur[data-reg="10000002"] rect');
    fr.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    fr.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 })); await tick(600);
    assert(T.mpState().region === 10000002 && !svg.querySelector('g.ur') && /Outer/.test(svg.textContent), 'Klick auf Region öffnet ihre Karte');
    // Overlay-Karte
    const mapR = () => { const b = d.createElement('div'); T.ovRenderMap(b); return b; };
    T.ovSatAction('karte', { type: 'mapTog', arg: 'menu' });   // KA6
    mapR(); await tick(1200);
    let mn = mapR();
    assert(mn.querySelectorAll('[data-ova="mapBg"]').length === 8 && mn.querySelector('[data-ova="mapBg"][data-arg="kills"][aria-pressed="true"]') && mn.querySelector('circle.bgf') && /Rahmen:/.test(mn.textContent) && /Füllung:/.test(mn.textContent), 'Overlay: Zeilen Rahmen/Füllung, Fläche bei Kills: ' + mn.querySelectorAll('circle.bgf').length);
    T.ovSatAction('karte', { type: 'mapBg', arg: 'none' }); mn = mapR();
    assert(T.ovLoad().mapBg === 'none' && !mn.querySelector('circle.bgf'), 'Overlay: Hintergrund aus');
    T.ovSatAction('karte', { type: 'mapTog', arg: 'uni' }); mn = mapR();
    assert(mn.querySelectorAll('g.ur[data-ova="mapReg"]').length === 70, 'Overlay: Regionsübersicht, Regionen klickbar');
    T.ovSatAction('karte', { type: 'mapReg', arg: '10000002' });
    assert(T.ovLoad().mapReg === 10000002 && !T.ovLoad().mapUni, 'Overlay: Klick öffnet die Region');
    console.log('\nALL Y5/Y8 KARTE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
