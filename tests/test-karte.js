// C1–C5 Karte: Kaempfe aus dem Gang-Report, Porträts, System-Suche, System-Menue (Stationen, Assets, Links), Einfaerben.
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
    await T.mpShow(10000060); await tick(100);
    const svg = $('mp-svg');
    // C1 Kampf-Marker + Tooltip
    // AA8: Gank-Systeme als roter Ring, abschaltbar (große Karte + Overlay)
    w.localStorage.setItem('eve-zentrale-gank-v1', JSON.stringify(['8QT-H4'])); T.mpOptSet('gk', true); T.mpDraw();
    assert(svg.querySelectorAll('circle.gk-ring').length === 1 && /8QT-H4/.test(svg.querySelector('circle.gk-ring title').textContent), 'AA8: Gank-System auf der großen Karte markiert');
    $('mp-o-gk').checked = false; $('mp-o-gk').onchange.call($('mp-o-gk'));
    assert(!svg.querySelector('circle.gk-ring'), 'AA8: Ebene „Gank“ abschaltbar');
    T.mpOptSet('gk', true);
    T.ovSatAction('karte', { type: 'mapTog', arg: 'menu' });   // KA6: ☰ ist standardmäßig zu
    T.ovRenderMap(d.createElement('div')); await tick(1500); const gkb = d.createElement('div'); T.ovRenderMap(gkb);
    assert(gkb.querySelector('[data-ova="mapTog"][data-arg="gk"][aria-pressed="true"]') && gkb.querySelectorAll('circle.gk-ring').length === 1, 'AA8: Overlay-Karte markiert Gank-Systeme, Knopf „⚠ Gank“');
    const gm = svg.querySelector('path.gr-m[data-sys="3"]');
    assert(gm && svg.querySelectorAll('path.gr-m').length === 1, 'C1: Kampf aus dem Gang-Report als Marker am System');
    gm.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true, clientX: 50, clientY: 50 }));
    const tip = $('mp-tip');
    assert(!tip.hidden && /Bad Guy/.test(tip.textContent) && /Kill: Rifter/.test(tip.textContent) && tip.querySelector('a[href*="zkillboard.com/related/3/"]'), 'C1: Maus drauf zeigt Piloten, Opfer und zKillboard-Link');
    // C2 Portraet + Tooltip
    const me = svg.querySelector('image.me-img[data-me="111"][data-sys="1"]');
    assert(me && /portrait/.test(me.getAttribute('href')), 'C2: eigener Charakter als Porträt');
    me.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true, clientX: 60, clientY: 60 }));
    assert(!tip.hidden && /Taron Velkar/.test(tip.textContent) && /online/.test(tip.textContent) && /1DQ1-A/.test(tip.textContent) && /angedockt/.test(tip.textContent) && /Flitzer/.test(tip.textContent), 'C2: Tooltip mit Standort, Station, Schiff, online');
    me.dispatchEvent(new w.MouseEvent('mouseout', { bubbles: true })); await tick(400);
    assert(tip.hidden, 'Tooltip verschwindet wieder');
    // C4 System-Menue
    const node = svg.querySelector('circle.n[data-sys="1"]');
    node.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    node.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));
    await tick(200);
    const info = $('mp-info');
    assert(/1DQ1-A - Fortress/.test(info.textContent) && /Markt/.test(info.textContent) && /Klonbank/.test(info.textContent) && /Reparatur/.test(info.textContent), 'C4: Stationen mit Diensten');
    assert(info.querySelector('a[href="https://evemaps.dotlan.net/system/1DQ1-A"]') && info.querySelector('a[href="https://zkillboard.com/system/1/"]'), 'C4: DOTLAN- und zKillboard-Link');
    assert([...info.querySelectorAll('button')].some(b => b.textContent === 'Autopilot-Ziel') && [...info.querySelectorAll('button')].some(b => b.textContent === 'Assets laden'), 'C4: Route-Knöpfe und „Assets laden“');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-mapstations-v1'))['1'][0][2] === 'MKR', 'Stationen dauerhaft gespeichert (Dienst-Kürzel)');
    // C5 Einfaerben
    const fillOf = id => svg.querySelector('circle.n[data-sys="' + id + '"]').getAttribute('fill');
    const store = () => JSON.parse(w.localStorage.getItem('eve-zentrale-map-v1') || '{}');
    // Q7: Klick = als Ring dazu; Klick auf die bisherige Fuellung laesst den Ring nachruecken
    const mode = async m => { const f = store().color || 'sec'; d.querySelector('#mp-modes [data-mpc="' + m + '"]').click(); await tick(200); if (f !== m){ d.querySelector('#mp-modes [data-mpc="' + f + '"]').click(); await tick(200); } };
    assert(d.querySelector('#mp-modes [data-mpc="sec"]').getAttribute('aria-pressed') === 'true' && /Sicherheit/.test($('mp-legend').textContent), 'C5: Standard = Sicherheit');
    d.querySelector('#mp-modes [data-mpc="kills"]').click(); await tick(200);
    assert(store().color === 'sec' && store().color2 === 'kills' && d.querySelector('#mp-modes [data-mpc="kills"][data-ring="1"]') && svg.querySelector('circle.n2[data-sys], circle.n2') && /Rahmen: .*äußerer Rahmen: /.test($('mp-legend').textContent), 'Q7: große Karte – Kills als Ring zur Sicherheit');
    d.querySelector('#mp-modes [data-mpc="kills"]').click(); await tick(200);
    assert(!store().color2 && !svg.querySelector('circle.n2'), 'Q7: Ring wieder abgewählt');
    await mode('kills');
    assert(/hsl/.test(fillOf(3)) && svg.querySelector('circle.n.z[data-sys="4"]') && /Gang-Report/.test($('mp-legend').textContent), 'C5: Kills & Gang-Report – System 3 heiß, ruhige grau');
    await mode('jumps');
    assert(/hsl/.test(fillOf(2)) && svg.querySelector('circle.n.z[data-sys="3"]'), 'C5: Verkehr');
    await mode('npc');
    assert(/hsl/.test(fillOf(3)) && svg.querySelector('circle.n.z[data-sys="2"]'), 'C5: NPC-Kills');
    await mode('stations');
    assert($('mp-svc-f').style.display === '' && /hsl/.test(fillOf(1)) && svg.querySelector('circle.n.z[data-sys="2"]'), 'C5: Stationen');
    $('mp-svc').value = 'J'; $('mp-svc').onchange(); await tick(50);
    assert(svg.querySelector('circle.n.z[data-sys="1"]') && /Sprungklon/.test($('mp-legend').textContent), 'C5: Stationen nach Dienst filtern (Sprungklon gibt es hier nicht)');
    await mode('sov'); await tick(200);
    assert(fillOf(1) === fillOf(2) && /hsl/.test(fillOf(1)) && svg.querySelector('circle.n.z[data-sys="3"]') && /Goons \(2\)/.test($('mp-legend').textContent), 'C5: Souveränität mit Legende');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-map-v1')).color === 'sov', 'Ansicht gemerkt');
    // C3 Suche in andere Region
    $('mp-search').value = 'Outer'; await $('mp-search-go').onclick(); await tick(200);
    const ms = T.mpState();
    assert(ms.region === 10000002 && ms.sel === '5' && ms.vb[2] === 500 && /Outer gefunden/.test($('mp-status').textContent), 'C3: Suche springt in die andere Region und markiert das System');
    $('mp-search').value = 'Gibtsnicht'; await $('mp-search-go').onclick();
    assert(/Kein System/.test($('mp-status').textContent), 'C3: unbekanntes System gemeldet');
    console.log('\nALL MAP TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
