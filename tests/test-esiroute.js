// Reiseroute ohne DOTLAN: Route von EVE (POST /route), Sicherheitsanzeige wie im Spiel, Kills, Umfahren, Vergleich, Overlay-Ansicht.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));

// Mini-Universum: Jita(1) - Perimeter(2) - Urlen(3) - Uedama(4, heiss) - Amarr(9); Umweg ueber Sivala(5)/Aldrat(6); Lowsec-Abkuerzung Tama(7)
const SYS = {
  1:{name:'Jita', s:0.946, c:100}, 2:{name:'Perimeter', s:0.95, c:100}, 3:{name:'Urlen', s:0.96, c:101}, 4:{name:'Uedama', s:0.5, c:102},
  5:{name:'Sivala', s:0.35, c:102}, 6:{name:'Aldrat', s:0.62, c:103}, 7:{name:'Tama', s:0.3, c:104}, 8:{name:'Nullsys', s:-0.2, c:105},
  9:{name:'Amarr', s:1.0, c:106}, 10:{name:'Tiny', s:0.03, c:104}
};
const REG = { 100:20, 101:20, 102:21, 103:21, 104:22, 105:23, 106:24 };
const REGNAME = { 20:'The Forge', 21:'The Citadel', 22:'Black Rise', 23:'Nullregion', 24:'Domain' };
function routeFor(pref, avoid){
  avoid = avoid || [];
  if (pref === 'LessSecure' || pref === 'insecure') return [1, 7, 9];
  if (avoid.indexOf(4) < 0) return [1, 2, 3, 4, 9];
  if (avoid.indexOf(6) < 0) return [1, 2, 3, 6, 9];
  return null;
}
let CALLS = [];
function makeWindow(extra, legacy){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.fetch = function(url, opts){
        const u = String(url); let m; CALLS.push({ u, opts });
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (u.indexOf('/universe/ids/') >= 0){
          const names = JSON.parse(opts.body);
          return ok({ systems: names.map(n => { const id = Object.keys(SYS).find(k => SYS[k].name.toLowerCase() === n.toLowerCase()); return id ? { id:+id, name:SYS[id].name } : null; }).filter(Boolean) });
        }
        if ((m = u.match(/esi\.evetech\.net\/route\/(\d+)\/(\d+)$/)) && opts && opts.method === 'POST'){
          if (legacy) return Promise.reject(new TypeError('Failed to fetch'));
          const b = JSON.parse(opts.body); const r = routeFor(b.preference, b.avoid_systems);
          return r ? ok({ route: r }) : Promise.resolve({ ok:false, status:404, headers:{get:()=>null}, json:() => Promise.resolve({ error:'no route' }) });
        }
        if ((m = u.match(/\/latest\/route\/(\d+)\/(\d+)\/\?datasource=tranquility&flag=(\w+)(&avoid=([\d,]+))?/))){
          const r = routeFor(m[3], m[5] ? m[5].split(',').map(Number) : []);
          return r ? ok(r) : Promise.resolve({ ok:false, status:404, headers:{get:()=>null}, json:() => Promise.resolve({}) });
        }
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))) return ok({ name: SYS[m[1]].name, security_status: SYS[m[1]].s, constellation_id: SYS[m[1]].c, system_id:+m[1] });
        if ((m = u.match(/\/universe\/constellations\/(\d+)\//))) return ok({ region_id: REG[m[1]] });
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: REGNAME[id] || ('X' + id) })));
        if (u.indexOf('/universe/system_kills/') >= 0) return ok([{ system_id:4, ship_kills:12, pod_kills:5, npc_kills:0 }, { system_id:2, ship_kills:1, pod_kills:0, npc_kills:3 }]);
        if (u.indexOf('/universe/system_jumps/') >= 0) return ok([{ system_id:2, ship_jumps:900 }, { system_id:4, ship_jumps:300 }]);
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
}

(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;

    // --- Sicherheitsanzeige wie im Spiel ---
    assert(T.rtSecDisplay(0.946) === 0.9 && T.rtSecDisplay(0.45) === 0.5 && T.rtSecDisplay(0.449) === 0.4, 'Sicherheit auf eine Stelle gerundet');
    assert(T.rtSecDisplay(0.03) === 0.1 && T.rtSecClass(0.03) === 'low', '0,0 < s < 0,05 zeigt EVE als 0,1 (Lowsec)');
    assert(T.rtSecClass(-0.2) === 'null' && T.rtSecClass(0) === 'null' && T.rtSecClass(0.5) === 'high', 'Highsec / Lowsec / Nullsec');
    assert(T.rtSecColor(1.0) === '#2e74df' && T.rtSecColor(0.5) === '#eeff83' && T.rtSecColor(-0.5) === '#8d3163', 'EVE-Farben je Sicherheitsstufe');

    // --- Navigation: Reiseroute ist Standard, laedt kein DOTLAN ---
    $('neo-btn-jump').onclick(); await tick(150);
    assert(!$('nav-esi-wrap').hidden && !$('rp-frame').getAttribute('src') && !$('jp-frame').getAttribute('src'), 'Reiseroute offen, keine DOTLAN-Karte geladen');

    // --- Route berechnen ---
    $('rt-from').value = 'jita'; $('rt-to').value = 'Amarr'; $('rt-pref').value = 'secure';
    CALLS = [];
    await T.rtGo(); await tick();
    const post = CALLS.find(c => /\/route\/1\/9$/.test(c.u));
    assert(post && post.opts.method === 'POST' && JSON.parse(post.opts.body).preference === 'Safer' && post.opts.headers['X-Compatibility-Date'], 'Route per POST mit Kompatibilitaetsdatum, Sicherste = Safer');
    assert(!CALLS.some(c => /dotlan/.test(c.u)), 'Kein Aufruf an DOTLAN');
    let st = T.rtLoad();
    assert(st.last && st.last.route.join(',') === '1,2,3,4,9', 'Route gespeichert');
    assert(/Sicherste Route Jita → Amarr: 4 Sprünge · nur Highsec/.test($('rt-status').textContent), 'Status nennt Route, Sprünge und Sicherheit: ' + $('rt-status').textContent);
    let rows = d.querySelectorAll('#rt-body tr');
    assert(rows.length === 5 && /Uedama/.test(rows[3].textContent) && /0,5/.test(rows[3].textContent) && /The Citadel/.test(rows[3].textContent), 'Tabelle mit System, Sicherheit, Region');
    assert(rows[3].classList.contains('hot') && /12/.test(rows[3].textContent) && /300/.test(rows[3].textContent), 'Viele Kills markiert, Spruenge der letzten Stunde');
    const cmp = d.querySelectorAll('#rt-cmp .rt-opt');
    assert(cmp.length === 3 && /Unsicherer/.test(cmp[2].textContent) && /2 Sprünge · 1 Lowsec/.test(cmp[2].textContent), 'Vergleich der Routenarten: ' + cmp[2].textContent);
    assert(cmp[1].getAttribute('aria-pressed') === 'true', 'Gewaehlte Routenart markiert');

    // --- Kopieren ---
    $('rt-copy').onclick(); await tick(30);
    assert(w.__clip === 'Jita (0,9) → Perimeter (1,0) → Urlen (1,0) → Uedama (0,5) → Amarr (1,0)', 'Route als Text kopiert: ' + w.__clip);

    // --- System meiden per Knopf -> neue Route ---
    const avoidBtn = rows[3].querySelector('button.btn');
    assert(avoidBtn && avoidBtn.textContent === 'meiden', 'Meiden-Knopf in der Zeile');
    // Namensliste fuer die Pruefung bereitstellen (sonst per ESI)
    T.rtLoad();
    avoidBtn.click(); await tick(300);
    st = T.rtLoad();
    assert(st.avoid.indexOf('Uedama') >= 0 && st.last.route.join(',') === '1,2,3,6,9', 'Uedama gemieden, Route ueber Aldrat');
    assert(/Uedama/.test($('rt-avoid-list').textContent), 'Gemiedenes System als Chip sichtbar');
    $('rt-avoid-list').querySelector('button').onclick(); await tick();
    assert(T.rtLoad().avoid.length === 0, 'Chip entfernt das System wieder');

    // --- automatisch umfahren ---
    $('rt-auto').checked = true; $('rt-auto-n').value = '10';
    await T.rtGo(); await tick();
    st = T.rtLoad();
    assert(st.last.route.join(',') === '1,2,3,6,9' && st.last.autoAvoided.join(',') === '4', 'Heisses System (12 Kills >= 10) automatisch umfahren');
    assert(/Umfahren \(viele Kills \/ Gank\): Uedama/.test($('rt-status').textContent), 'Hinweis im Status');
    $('rt-auto-n').value = '20';
    await T.rtGo(); await tick();
    assert(T.rtLoad().last.route.join(',') === '1,2,3,4,9', 'Unter der Schwelle wird nicht umfahren');

    // --- Unbekannte Systeme ---
    $('rt-from').value = 'Nirgendwo';
    await T.rtGo();
    assert(/nicht gefunden/.test($('rt-status').textContent), 'Unbekanntes Start-System gemeldet');
    $('rt-from').value = 'Jita';
    await T.rtGo(); await tick();

    // --- Position + Overlay-Ansicht ---
    T.rtSetPos(2);
    assert(T.rtLoad().last.pos === 2 && d.querySelectorAll('#rt-body tr')[2].classList.contains('here'), '„Hier bin ich“ gespeichert und markiert');
    const ov = T.ovLoad(); ov.view = 'route'; T.ovSave(ov);
    T.ovSetMode('compact'); await tick(100);
    const orows = d.querySelectorAll('#ov-body .ov-route-row');
    assert(orows.length === 5 && orows[0].classList.contains('past') && orows[2].classList.contains('here'), 'Kompaktansicht: Route mit erledigten Systemen und aktuellem Standort');
    assert(/noch 2 von 4 Sprüngen/.test($('ov-body').textContent), 'Kompaktansicht zeigt verbleibende Sprünge');
    orows[3].onclick(); await tick();
    assert(T.rtLoad().last.pos === 3, 'Klick in der Kompaktansicht setzt den Standort');
    T.ovSetMode('full');

    // --- Unsicher waehlen ueber Vergleichsknopf ---
    d.querySelectorAll('#rt-cmp .rt-opt')[2].onclick(); await tick(300);
    assert(T.rtLoad().last.pref === 'insecure' && T.rtLoad().last.route.join(',') === '1,7,9', 'Vergleichsknopf rechnet mit anderer Routenart');
    w.close();

    // --- Wiederherstellen + Rueckfall auf /latest (GET) ---
    const saved = { 'eve-zentrale-esiroute-v1': JSON.stringify({ from:'Jita', to:'Amarr', pref:'shortest', avoid:['Uedama'] }), 'eve-zentrale-nav-sub':'esi' };
    w = makeWindow(saved, true); await tick(600);
    d = w.document; $ = id => d.getElementById(id); T = w.__test;
    $('neo-btn-jump').onclick(); await tick(150);
    assert($('rt-from').value === 'Jita' && $('rt-to').value === 'Amarr' && $('rt-pref').value === 'shortest', 'Eingaben bleiben gespeichert');
    CALLS = [];
    await T.rtGo(); await tick();
    assert(CALLS.some(c => /\/latest\/route\/1\/9\/\?datasource=tranquility&flag=shortest&avoid=4/.test(c.u)), 'Rueckfall: GET /latest/route mit flag und avoid');
    assert(T.rtLoad().last.route.join(',') === '1,2,3,6,9', 'Route auch ueber den alten Weg');

    console.log('\nALL ESI-ROUTE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
