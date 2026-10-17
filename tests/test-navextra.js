// Navigation-Erweiterungen: Jump Bridges in der Route, Start = Standort, Standort mitverfolgen, Autopilot-Ziel/Wegpunkte (ESI), Regionskarte.
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
    const names = Object.keys(SYS).map(k => SYS[k].name);
    const p = T.jbrParse('1DQ1-A <-> MJXW-P\n8qt-h4 » Q-JQSG (Ansiblex)\nQuatsch ohne Systeme\n1DQ1-A 1DQ1-A', names);
    assert(p.pairs.length === 2 && p.pairs[0].join() === '1DQ1-A,MJXW-P' && p.pairs[1].join() === '8QT-H4,Q-JQSG' && p.bad.length === 2, 'Jump-Bridge-Liste: Schreibweisen erkannt, Unsinn gemeldet');
    // Route ohne Bridges
    $('neo-btn-jump').onclick(); T.navShow('esi'); await tick(200);
    $('rt-from').value = '1DQ1-A'; $('rt-to').value = 'MJXW-P'; await T.rtGo(); await tick(300);
    assert(T.rtLoad().last.route.join() === '1,2,3,4', 'Ohne Bridges: normale Route über Stargates');
    // Bridges an
    w.localStorage.setItem('eve-zentrale-jumpbridges-v1', JSON.stringify({ text: '', pairs: [['1DQ1-A', 'MJXW-P']], on: true }));
    POSTS = []; await T.rtGo(); await tick(300);
    const rb = JSON.parse(POSTS.find(x => /\/route\//.test(x.u)).body);
    assert(rb.connections.some(c => c.from === 30004116 && c.to === 30004125), 'Fehlende Tore (Rayeret-Jakri) gehen immer mit');
    assert(rb.connections.length === 2 + 4 && rb.connections.some(c => c.from === 1 && c.to === 4) && rb.connections.some(c => c.from === 4 && c.to === 1), 'Bridges werden EVE als Verbindungen in beide Richtungen mitgegeben');
    const L = T.rtLoad().last;
    assert(L.route.join() === '1,4' && L.jb.join() === '1', 'Route nutzt die Bridge und merkt sich den Bridge-Sprung');
    assert(/Bridge/.test($('rt-body').rows[1].textContent) && /Jump Bridges genutzt/.test($('rt-stats').textContent), 'Tabelle markiert „Bridge“, Übersicht zählt sie');
    // Autopilot
    POSTS = []; await (async () => { $('rt-ap-dest').onclick(); await tick(200); })();
    const ap = POSTS.filter(x => /autopilot/.test(x.u));
    assert(ap.length === 1 && /destination_id=4/.test(ap[0].u) && /clear_other_waypoints=true/.test(ap[0].u) && ap[0].auth === 'Bearer a', 'Ziel im Spiel setzen: ein Aufruf mit Ziel-ID und Login');
    assert(/Ziel MJXW-P im Spiel gesetzt/.test($('rt-ap-status').textContent), 'Rückmeldung nach dem Setzen');
    w.localStorage.setItem('eve-zentrale-jumpbridges-v1', JSON.stringify({ pairs: [], on: false }));
    await T.rtGo(); await tick(300);
    POSTS = []; $('rt-ap-way').onclick(); await tick(300);
    const wp = POSTS.filter(x => /autopilot/.test(x.u)).map(x => x.u);
    assert(wp.length === 3 && /destination_id=2/.test(wp[0]) && /clear_other_waypoints=true/.test(wp[0]) && /clear_other_waypoints=false&destination_id=4/.test(wp[2]), 'Genaue Route als Wegpunkte (erster löscht alte Wegpunkte)');
    // Standort
    await T.rtLocStart(); await tick(100);
    assert($('rt-from').value === 'Q-JQSG' && /Start: Q-JQSG/.test($('rt-loc-info').textContent), 'Start = aktuelles System des Charakters');
    const s = T.rtLoad(); s.locFollow = true; s.locChar = '111'; w.localStorage.setItem('eve-zentrale-esiroute-v1', JSON.stringify(s));
    await T.chRefresh(false); await tick(100);
    assert(T.rtLoad().last.pos === 2, 'Standort mitverfolgen: „hier bin ich“ springt automatisch auf das aktuelle System');
    // HH5: 📍 an Einzel-Ortsfeldern, nicht an Meiden-Feldern
    assert($('rt-from').parentNode.querySelector('.sys-me') && $('rt-to').parentNode.querySelector('.sys-me') && !$('rt-avoid-in').parentNode.querySelector('.sys-me'), 'HH5: 📍 an Start/Ziel, nicht bei „Meiden“');
    // HH6: ab Werk an, Von-Feld läuft mit, Ziel erreicht
    const s6 = T.rtLoad(); delete s6.locFollow; w.localStorage.setItem('eve-zentrale-esiroute-v1', JSON.stringify(s6));
    $('rt-from').value = 'irgendwas'; T.chData()['111'].loc = { solar_system_id: 4 }; T.rtLocFollowTick(); await tick(50);
    assert(T.rtLoad().last.pos === 3 && $('rt-from').value === 'MJXW-P' && /Ziel erreicht/.test($('rt-status').textContent), 'HH6: folgt ohne Haken, Start läuft mit, „Ziel erreicht“');
    // Karte
    T.navShow('map'); await tick(1200);
    assert(!$('nav-map-wrap').hidden && $('nav-sub-map').getAttribute('aria-selected') === 'true', 'Unterbereich „Karte“');
    assert($('mp-region').options.length === 2, 'Regionsliste (ohne Wurmloch-Regionen)');
    const ms = T.mpState();
    assert(ms.region === 10000060 && Object.keys(ms.data.sys).length === 4 && ms.data.edges.length === 4 && ms.data.ext['5'], 'Region der Route geladen: 4 Systeme, 4 Verbindungen, Nachbarsystem außerhalb');
    const svg = $('mp-svg');
    assert(svg.querySelectorAll('circle.n').length === 5 && svg.querySelectorAll('line.r').length === 3 && svg.querySelectorAll('circle.k').length === 1, 'Karte: Systeme, Route hervorgehoben, Kill-Ring');
    assert(svg.querySelector('image.me-img[data-me="111"]') && /Delve/.test($('mp-status').textContent), 'Eigener Charakter auf der Karte');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-map-v1')).r['10000060'], 'Region gespeichert (Speicher-Schlüssel eve-zentrale-map-v1)');
    const n = CALLS.length; await T.mpShow(10000060);
    assert(CALLS.filter((u, i) => i >= n && /\/universe\/(systems|stargates)\//.test(u)).length === 0, 'Zweites Öffnen ohne neue Abfragen');
    // Klick auf System
    const node = svg.querySelector('circle.n[data-sys="3"]');
    node.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    node.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));
    await tick(50);
    assert(!$('mp-info').hidden && /Q-JQSG/.test($('mp-info').textContent) && /Kills 1 Std: 7 Schiffe/.test($('mp-info').textContent), 'Infokasten mit Kills und Sprüngen');
    const btn = [...$('mp-info').querySelectorAll('button')].find(b => b.textContent === 'Ziel'); btn.onclick();
    assert($('rt-to').value === 'Q-JQSG' && !$('nav-esi-wrap').hidden, 'Aus der Karte: als Ziel übernehmen');
    console.log('\nALL NAV EXTRA TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
