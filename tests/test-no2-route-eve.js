// NO2 (29.10.2026, Tester): Navigations-Overlay schickt die berechnete Route an EVE – ganze Route als Wegpunkte (ab „hier bin ich“) oder nur das Ziel.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
// Mini-Region: A(1)-B(2)-C(3)-D(4), Bridge A<->D; E(5) liegt in einer Nachbarregion
const SYS = { 1:{ name:'1DQ1-A', s:-0.4, c:100, x:0, z:0, g:[11] }, 2:{ name:'8QT-H4', s:-0.3, c:100, x:10, z:0, g:[21, 22] }, 3:{ name:'Q-JQSG', s:-0.5, c:100, x:20, z:5, g:[31, 32] },
              4:{ name:'MJXW-P', s:-0.1, c:100, x:30, z:0, g:[41, 42] }, 5:{ name:'Outer', s:0.5, c:200, x:60, z:0, g:[51] } };
const GATES = { 11:2, 21:1, 22:3, 31:2, 32:4, 41:3, 42:5, 51:4 };
let CALLS = [], POSTS = [];
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.fetch = function(url, opts){
        const u = String(url); let m; CALLS.push(u);
        if (opts && opts.method === 'POST') POSTS.push({ u, body: opts.body, auth: opts.headers && opts.headers.Authorization });
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (u.indexOf('/universe/ids/') >= 0){
          const names = JSON.parse(opts.body);
          return ok({ systems: names.map(n => { const id = Object.keys(SYS).find(k => SYS[k].name.toLowerCase() === String(n).toLowerCase()); return id ? { id:+id, name:SYS[id].name } : null; }).filter(Boolean) });
        }
        if ((m = u.match(/esi\.evetech\.net\/route\/(\d+)\/(\d+)$/))){
          const b = JSON.parse(opts.body);
          const bridge = (b.connections || []).some(c => c.from === 1 && c.to === 4);
          return ok({ route: bridge ? [1, 4] : [1, 2, 3, 4] });
        }
        if (/\/ui\/autopilot\/waypoint\//.test(u)) return Promise.resolve({ ok:true, status:204, headers:{get:()=>null}, json:() => Promise.resolve(null) });
        if (/\/characters\/111\/location\//.test(u)) return ok({ solar_system_id: 3 });
        if (/\/characters\/111\/(online|ship)\//.test(u)) return ok(/online/.test(u) ? { online: true } : { ship_type_id: 587, ship_name: 'x' });
        if ((m = u.match(/\/universe\/regions\/(\d+)\//))) return ok({ region_id: +m[1], name: 'Delve', constellations: [100] });
        if (/\/universe\/regions\//.test(u)) return ok([10000060, 10000002, 11000001]);
        if ((m = u.match(/\/universe\/constellations\/(\d+)\//))) return ok({ region_id: m[1] === '200' ? 10000002 : 10000060, systems: m[1] === '100' ? [1, 2, 3, 4] : [5] });
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))){ const x = SYS[m[1]]; return ok({ name: x.name, security_status: x.s, constellation_id: x.c, position: { x: x.x * 1e15, y: 0, z: x.z * 1e15 }, stargates: x.g }); }
        if ((m = u.match(/\/universe\/stargates\/(\d+)\//))) return ok({ destination: { system_id: GATES[m[1]] } });
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: ({ 10000060: 'Delve', 10000002: 'The Forge', 587: 'Rifter' })[id] || ('X' + id) })));
        if (/system_kills/.test(u)) return ok([{ system_id: 3, ship_kills: 7, pod_kills: 2 }]);
        if (/system_jumps/.test(u)) return ok([{ system_id: 3, ship_jumps: 50 }]);
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    $('neo-btn-jump').onclick(); T.navShow('esi'); await tick(200);
    $('rt-from').value = '1DQ1-A'; $('rt-to').value = 'MJXW-P'; await T.rtGo(); await tick(300);
    assert(T.rtLoad().last.route.join() === '1,2,3,4', 'Route berechnet');
    let ob = d.createElement('div'); T.ovRenderViewInto('route', ob);
    const bw = ob.querySelector('[data-ova="rtAp"][data-arg="way"]'), bd = ob.querySelector('[data-ova="rtAp"][data-arg="dest"]');
    assert(bw && bd && !bw.disabled && /ganze Route/.test(bw.textContent) && /nur Ziel/.test(bd.textContent), 'Overlay: Knöpfe „→ EVE: ganze Route“ und „→ EVE: nur Ziel“ unter der Route');
    POSTS = []; T.ovSatAction('route', { type: 'rtAp', arg: 'way' }); await tick(400);
    let wp = POSTS.filter(x => /autopilot/.test(x.u)).map(x => x.u);
    assert(wp.length === 3 && /clear_other_waypoints=true&destination_id=2/.test(wp[0]) && /clear_other_waypoints=false&destination_id=4/.test(wp[2]) && POSTS[0].auth === 'Bearer a', 'Ganze Route: jedes System als Wegpunkt, erster löscht alte');
    ob = d.createElement('div'); T.ovRenderViewInto('route', ob);
    assert(/Taron Velkar: 3 Wegpunkte gesetzt/.test(ob.textContent), 'Rückmeldung mit Charakter im Overlay');
    T.rtSetPos(2); await tick(100);
    POSTS = []; T.ovSatAction('route', { type: 'rtAp', arg: 'way' }); await tick(300);
    wp = POSTS.filter(x => /autopilot/.test(x.u)).map(x => x.u);
    assert(wp.length === 1 && /clear_other_waypoints=true&destination_id=4/.test(wp[0]), 'Ab „hier bin ich“: nur die restlichen Systeme');
    POSTS = []; T.ovSatAction('route', { type: 'rtAp', arg: 'dest' }); await tick(300);
    wp = POSTS.filter(x => /autopilot/.test(x.u)).map(x => x.u);
    ob = d.createElement('div'); T.ovRenderViewInto('route', ob);
    assert(wp.length === 1 && /clear_other_waypoints=true&destination_id=4/.test(wp[0]) && /Ziel MJXW-P im Spiel gesetzt/.test(ob.textContent), 'Nur Ziel: ein Aufruf, Meldung im Overlay');
    T.rtSetPos(3); await tick(100);
    ob = d.createElement('div'); T.ovRenderViewInto('route', ob);
    assert(ob.querySelector('[data-ova="rtAp"][data-arg="way"]').disabled, 'Am Ziel: „ganze Route“ gesperrt');
    console.log('\nALL NO2 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
