// Abschnitt I (Wuensche vom 24.09.2026, 2. Liste)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Flottenhangar der Deep Space Transporter zaehlt mit
    const bus = T.flattenShips().find(s => /^Bustard/.test(s.name));
    assert(bus.fh === 50000, 'DST: Bustard hat 50.000 m³ Flottenhangar');
    const opt = Array.from($('is-ship').options).find(o => /^Bustard/.test(o.textContent));
    assert(opt.value === '55000' && /Flottenhangar/.test(opt.textContent), 'DST: Hub-Handel-Auswahl rechnet Laderaum + Flottenhangar');
    // I2: Markt-Pfeil sitzt im Kopier-Kaestchen und traegt data-mk (Overlay-Fenster sehen nur HTML)
    const mb = T.mkBtn(34).firstChild;   // AA3: danach der Kurven-Knopf
    assert(mb.getAttribute('data-mk') === '34', 'I2: Markt-Pfeil trägt die Waren-ID für Overlay-Fenster');
    assert(/\.tsc-cp \.mk-btn\{margin-left:0\}/.test(d.querySelector('style').textContent), 'I2: Pfeil sitzt bündig im Kopier-Kästchen');
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
      { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Eins', scopes:'esi-ui.open_window.v1' }]));
    const calls = [];
    w.fetch = (u, o) => { calls.push(String(u)); return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) }); };
    T.ovSatAction('trading', { type: 'mk', tid: 34 }); await tick(80);
    assert(calls.some(u => /\/ui\/openwindow\/marketdetails\/\?type_id=34&/.test(u)), 'I2: Klick im Overlay-Fenster öffnet den Markt in EVE');
    // I8: Handelsskills nicht mehr einstellbar, nur noch aus EVE
    assert(d.getElementById('sk-acc').closest('[hidden]') && !/Weitere Handelsskills/.test(d.getElementById('panel-account').textContent), 'I8: keine Skill-Auswahl mehr im Konto');
    assert(/Verkaufssteuer/.test(d.getElementById('sk-derived').textContent), 'I8: abgeleitete Steuer/Broker bleiben sichtbar');
    // I12: Routenwahl, Standard Sicherste, beide Auswahlen gleich; Umkreis bleibt dann im Highsec
    assert($('hl-route').value === 'secure' && $('is-route').value === 'secure', 'I12: Standard ist die sichere Route');
    $('is-route').value = 'shortest'; $('is-route').dispatchEvent(new w.Event('change'));
    assert($('hl-route').value === 'shortest' && w.localStorage.getItem('eve-zentrale-haulroute-v1') === 'shortest', 'I12: eine gemeinsame Einstellung für Hauling und Hub-Handel');
    const SYS = { 1: [1.0, [12, 13]], 2: [0.3, [24]], 3: [0.9, []], 4: [0.9, []] }, GATE = { 12: 2, 13: 3, 24: 4 };
    w.fetch = u => { let m = /systems\/(\d+)\//.exec(u); if (m) return Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'S' + m[1], security_status: SYS[m[1]][0], stargates: SYS[m[1]][1] }) });
      m = /stargates\/(\d+)\//.exec(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ destination: { system_id: GATE[m[1]] } }) }); };
    const all = await T.bfsSystemsInRadius(1, 2), hi = await T.bfsSystemsInRadius(1, 2, null, true);
    assert(Object.keys(all).join() === '1,2,3,4' && Object.keys(hi).join() === '1,3', 'I12: Sicherste Route – Umkreis ohne Lowsec und nicht durch Lowsec hindurch');
    // I13: Overlay-Vorschlag -> Route (sichere Wahl) -> Wegpunkte in EVE
    $('is-route').value = 'secure'; $('is-route').dispatchEvent(new w.Event('change'));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Eins', scopes:'esi-ui.write_waypoint.v1' }]));
    const rc = [];
    w.fetch = (u, o) => { u = String(u); rc.push(u + ' ' + ((o && o.body) || ''));
      const J = x => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(x) });
      if (/universe\/ids/.test(u)) return J({ systems: [{ id: 30000142, name: 'Jita' }, { id: 30002187, name: 'Amarr' }] });
      if (/\/route\//.test(u)) return J({ route: [30000142, 30000144, 30002187] });
      if (/universe\/systems\/(\d+)/.test(u)) return J({ name: 'X', security_status: 0.9, constellation_id: 1 });
      if (/autopilot\/waypoint/.test(u)) return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) });
      return J([]); };
    T.setOvData({ haul: { t: Date.now(), origin: 'Jita IV', originSys: 'Jita', list: [{ stationId: 1, stationName: 'Amarr VIII', systemName: 'Amarr', jumps: 2, itemCount: 1, profit: 1e6 }] } });
    w.document.getElementById('rt-ap-char').innerHTML = '<option value="111">Eins</option>';
    T.ovSatAction('hauling', { type: 'haulEve', arg: '0' }); await tick(600);
    assert(rc.some(u => /\/route\/30000142\/30002187 .*Safer/.test(u)), 'I13: Route mit der gewählten Art (Sicherste) berechnet');
    const wp = rc.filter(u => /autopilot\/waypoint/.test(u));
    assert(wp.length === 1 && /clear_other_waypoints=true&destination_id=30002187/.test(wp[0]), 'I13 (17.10.): nur das Ziel in EVE gesetzt, keine Wegpunkte: ' + wp.length);
    // I15: Hauling-Lauf merken, Fortschritt aus der Wallet (Kauf am Start, Verkauf am Ziel)
    w.localStorage.setItem('eve-zentrale-active-char', '111');
    const run = T.hrAdd(60003760, 'Jita IV (Jita)', 60008494, 'Amarr VIII', [{ tid: '34', name: 'Tritanium', q: 100, sp: 500, p: 300 }]);
    assert(run.charId === '111' && T.hrLoad().length === 1 && T.hrProgress(run).phase === 'angenommen', 'I15: Lauf gemerkt, Phase angenommen');
    const now = Date.now();
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { a: [now, 34, 100, 5, 1, 60003760], b: [now, 34, 60, 10, 0, 60008494], c: [now, 34, 50, 9, 0, 60003760] }, fee: {}, ord: {}, upd: now }));
    const g = T.hrProgress(run);
    assert(g.bought === 100 && g.sold === 60 && g.phase === 'wird verkauft', 'I15: gekauft 100, verkauft 60 am Ziel (Verkauf am Start zählt nicht)');
    assert(g.profit > 0 && g.profit < 300, 'I15: Gewinn nach Steuer aus der Wallet: ' + g.profit.toFixed(1));
    // M4: Kauf kurz vor dem Merken zählt, Nachkauf über Planmenge nicht, Verkauf durch anderen Charakter an anderer Station zählt
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify({ tx: { a: [now - 2 * 3600000, 34, 100, 5, 1, 60003760], d: [now, 34, 40, 5, 1, 60003760] }, fee: {}, ord: {}, upd: now }));
    w.localStorage.setItem('eve-zentrale-pnl-v1-222', JSON.stringify({ tx: { b: [now, 34, 100, 10, 0, 60008000] }, fee: {}, ord: {}, upd: now }));
    const tk = JSON.parse(w.localStorage.getItem('eve-zentrale-characters') || '[]');
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(tk.concat({ character_id: 222, character_name: 'Zwei' })));
    const g4 = T.hrProgress(run);
    assert(g4.bought === 100 && g4.sold === 100 && g4.phase === 'verkauft', 'M4: gekauft ' + g4.bought + ', verkauft ' + g4.sold);
    assert(/Hauling-Läufe \(1 aktiv\)/.test($('hr-sum').textContent) && /1 Lauf aktiv/.test($('hr-list').textContent) && $('hr-list').querySelector('[data-go-track]'), 'BB11: Hauling zeigt nur den Hinweis → Watchlist');
    console.log('\nALL WUENSCHE-I TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
