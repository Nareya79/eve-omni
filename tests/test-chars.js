// Charaktere: Standort/online/Schiff, Klone + Implantate, Planeten (PI) mit Extraktor-Laufzeit, Lager-Hochrechnung und Alarm,
// Standings aus EVE -> Brokergebuehr, Hinweis bei fehlender Berechtigung, Overlay-Ansichten "Charaktere" und "Planeten".
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const NOW = Date.now();
function jwt(scopes){ const b = s => Buffer.from(JSON.stringify(s)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); return b({ alg: 'none' }) + '.' + b({ scp: scopes, sub: 'CHARACTER:EVE:222' }) + '.x'; }
const CHARS = [
  { access_token:'a', refresh_token:'r', expires_at:NOW+3600000, character_id:'111', character_name:'Taron Velkar' },
  { access_token: jwt(['esi-wallet.read_character_wallet.v1']), refresh_token:'r', expires_at:NOW+3600000, character_id:'222', character_name:'Alt Char' }
];
const TYPES = { 2848: { name: 'Barren Extractor Control Unit', capacity: 0 }, 2541: { name: 'Barren Storage Facility', capacity: 12000 },
  2268: { name: 'Aqueous Liquids', volume: 0.01 }, 2470: { name: 'Basic Industry Facility', capacity: 0 }, 587: { name: 'Rifter' } };
const NAMES = { 587: 'Rifter', 9899: 'Ocular Filter - Basic', 40009077: 'Jita IV', 30000142: 'Jita' };
let CALLS = [];
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.__notes = [];
      w.Notification = function(t, o){ w.__notes.push({ t, o }); }; w.Notification.permission = 'granted'; w.Notification.requestPermission = () => Promise.resolve('granted');
      w.fetch = function(url, opts){
        const u = String(url); let m; CALLS.push(u);
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (/\/characters\/111\/location\//.test(u)) return ok({ solar_system_id: 30000142, station_id: 60003760 });
        if (/\/characters\/111\/online\//.test(u)) return ok({ online: true, last_login: new Date(NOW - 3600000).toISOString() });
        if (/\/characters\/111\/ship\//.test(u)) return ok({ ship_type_id: 587, ship_name: 'Tony', ship_item_id: 1 });
        if (/\/characters\/111\/clones\//.test(u)) return ok({ home_location: { location_id: 60003760, location_type: 'station' }, last_clone_jump_date: new Date(NOW - 2 * 3600000).toISOString(),
          jump_clones: [{ jump_clone_id: 1, location_id: 60008494, location_type: 'station', implants: [9899], name: 'Trade' }] });
        if (/\/characters\/\d+\/implants\//.test(u)) return ok([9899]);
        if (/\/characters\/111\/planets\/40009077\//.test(u)) return ok({ pins: [
          { pin_id: 1, type_id: 2848, expiry_time: new Date(NOW + 3600000).toISOString(), extractor_details: { product_type_id: 2268, cycle_time: 1800, qty_per_cycle: 1000, heads: [{}, {}] } },
          { pin_id: 2, type_id: 2541, contents: [{ type_id: 2268, amount: 100000 }] },
          { pin_id: 3, type_id: 2470, schematic_id: 121, contents: [{ type_id: 2268, amount: 3000 }] } ] });
        if (/\/characters\/111\/planets\//.test(u)) return ok([{ planet_id: 40009077, solar_system_id: 30000142, planet_type: 'barren', upgrade_level: 4, num_pins: 3, last_update: new Date(NOW - 2 * 3600000).toISOString() }]);
        if (/\/characters\/111\/standings\//.test(u)) return ok([{ from_id: 500001, from_type: 'faction', standing: 3.456 }, { from_id: 1000035, from_type: 'npc_corp', standing: 6.1 }]);
        if (/\/characters\/222\//.test(u)) return Promise.resolve({ ok:false, status:403, headers:{get:()=>null}, json:() => Promise.resolve({ error: 'forbidden' }) });
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok(Object.assign({ type_id: +m[1], volume: 1 }, TYPES[m[1]] || { name: 'T' + m[1] }));
        if ((m = u.match(/\/universe\/stations\/(\d+)\//))) return ok({ name: m[1] === '60003760' ? 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' : 'Dodixie IX - Moon 20 - Federation Navy Assembly Plant', system_id: 30000142 });
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))) return ok({ name: 'Jita', security_status: 0.946, constellation_id: 20000020 });
        if (/\/universe\/constellations\//.test(u)) return ok({ region_id: 10000002 });
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: NAMES[id] || (id === 10000002 ? 'The Forge' : 'X' + id) })));
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(3200);    // Standings-Import startet 2,5 s nach dem Laden
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Standings -> Brokergebuehr
    const st = T.tscLoadState().stand;
    assert(st && st.jita && st.jita.f === '3.46' && st.jita.c === '6.1' && st.jita.auto, 'Standings aus EVE für Jita übernommen (Caldari State 3,46 / Caldari Navy 6,1)');
    assert(st.amarr && st.amarr.f === '0', 'Andere Handelsplätze ebenfalls gefüllt');
    assert(T.tokHasScope(CHARS[1], 'esi-characters.read_standings.v1') === false && T.tokHasScope(CHARS[0], 'x') === true, 'Berechtigungsprüfung am Login');
    // Charaktere
    $('neo-btn-chars').onclick(); await tick(900);
    assert($('panel-chars').classList.contains('active'), 'OmniCom: Charaktere öffnen');
    const c = T.chData()['111'];
    assert(c.loc.solar_system_id === 30000142 && c.online.online && c.ship.ship_type_id === 587, 'Standort, online, Schiff geladen');
    const over = $('ch-over').textContent;
    assert(/Taron Velkar/.test(over) && /online/.test(over) && /Jita/.test(over) && /Caldari Navy Assembly Plant/.test(over) && /Rifter/.test(over) && /Tony/.test(over), 'Übersicht: online, System, Station, Schiff');
    assert(/The Forge/.test(over) && d.querySelector('#ch-over .ch-card.on'), 'Region und Online-Markierung');
    const alt = Array.from(d.querySelectorAll('#ch-over .ch-card')).find(x => /Alt Char/.test(x.textContent));
    assert(/neu einloggen/.test(alt.textContent), 'Alter Login ohne neue Berechtigungen: Hinweis „neu einloggen“');
    // R3: online zuerst (Taron vor Alt, obwohl alphabetisch spaeter); offline = roter Punkt, ohne Online-Daten grau
    assert(/Taron/.test(d.querySelector('#ch-over .ch-card').textContent) && !alt.querySelector('.ch-dot.off'), 'R3: online zuerst, unbekannt bleibt grau');
    T.chData()['222'] = Object.assign(T.chData()['222'] || {}, { online: { online: false } });
    const r3b = d.createElement('div'); T.ovRenderViewInto('chars', r3b);
    const oc = Array.from(r3b.querySelectorAll('.ov-card'));
    assert(/Taron/.test(oc[0].textContent) && /Alt Char/.test(oc[1].textContent) && oc[1].classList.contains('bad') && oc[1].querySelector('.ch-dot.off'), 'R3: Overlay – offline rot, online oben');
    assert(!CALLS.some(u => /\/characters\/222\/(location|online|ship|planets|clones)/.test(u)), 'Ohne Berechtigung wird gar nicht erst gefragt');
    // Planeten
    const pl = c.planets[0], a = T.piAnalyze(pl, NOW);
    assert(a.ext.length === 1 && Math.round(a.ext[0].perH) === 2000 && a.ext[0].product === 'Aqueous Liquids', 'Extraktor: Produkt und Menge pro Stunde');
    assert(a.store.length === 1 && a.cap === 12000 && Math.round(a.used) === 1000, 'Lager: 1.000 von 12.000 m³ (Fabriken zählen nicht)');
    assert(Math.round(a.est) === 1040, 'Hochrechnung seit letztem Stand: +20 m³/Std × 2 Std = 1.040 m³');
    $('ch-sub-pi').onclick(); await tick(100);
    const pi = $('ch-pi-list').textContent;
    assert(!$('ch-pi').hidden && /Jita IV/.test(pi) && /Aqueous Liquids/.test(pi) && /läuft noch/.test(pi) && /2\.000 \/ Std/.test(pi) && /12\.000 m³/.test(pi), 'Planeten-Ansicht: Extraktor-Laufzeit, Lagerfüllung');
    assert(w.__notes.some(n => /Planeten/.test(n.t) && /Jita IV: Extraktor \(Aqueous Liquids\) läuft in 5\d Min aus/.test(n.o.body)), 'Alarm: Extraktor läuft in unter 2 Std aus');
    const n0 = w.__notes.length; T.piCheckAlarms();
    assert(w.__notes.length === n0, 'Kein doppelter Alarm');
    // HH2: Planeten-Seite zeigt nur Planeten-Reiter, keine Übersicht
    assert($('ch-sub-over').hidden && !$('ch-sub-pi').hidden && !$('ch-sub-pp').hidden && $('ch-all-open').hidden, 'HH2: Planeten = eigene Seite ohne Charakter-Reiter');
    // HH3: Klone in der Charakterkarte (aufklappbar), Reiter „Klone & Implantate“ entfällt
    assert(!$('ch-sub-clones') && !$('ch-clones'), 'HH3: Reiter Klone & Implantate entfernt');
    $('ch-sub-over').onclick(); await tick(50);
    assert(!$('ch-sub-over').hidden && $('ch-sub-pi').hidden && !$('ch-all-open').hidden, 'HH2: Charaktere ohne Planeten-Reiter');
    assert(!/Route ab hier/.test($('ch-over').textContent), 'HH4: „Route ab hier“ entfernt');
    const det = d.querySelector('#ch-over details.ch-more[data-chopen="111"]');
    assert(det && !det.open, 'HH3: Karte hat zugeklappten Bereich Skills/Implantate/Klone');
    $('ch-all-open').onclick(); await tick(50);
    assert(d.querySelector('#ch-over details.ch-more[data-chopen="111"]').open && $('ch-all-open').textContent === 'alle zuklappen', 'HH3: „alle aufklappen“ öffnet alle und bleibt nach dem Neuzeichnen offen');
    const cl = d.querySelector('#ch-over details.ch-more[data-chopen="111"]').textContent;
    assert(/Ocular Filter - Basic/.test(cl) && /Heimatstation: Jita IV/.test(cl) && /Sprungklon „Trade“: Dodixie/.test(cl), 'Klone: Implantate, Heimat, Sprungklon mit Ort');
    assert(/wieder möglich in 2\d Std|wieder möglich in 21 Std/.test(cl) && /ohne Skill-Bonus/.test(cl), 'Klonsprung-Sperre (24 Std ohne Skill) als Countdown');
    // Overlay
    T.ovSetMode('compact'); await tick(100);
    const s = T.ovLoad(); s.views.forEach(v => { if (v.id === 'chars' || v.id === 'pi') v.on = true; }); s.view = 'chars'; T.ovSave(s); T.ovRender();
    let ob = $('ov-body').textContent;
    assert(/Taron Velkar/.test(ob) && /Jita/.test(ob) && /Rifter/.test(ob) && /neu einloggen/.test(ob), 'Overlay „Charaktere“: Standort und Schiff je Charakter');
    assert(d.querySelector('#ov-body .ow-c img.ow-p[src*="/characters/111/portrait"]') && d.querySelector('#ov-body img.ow-shp[src*="/types/587/icon"]') && /Tony/.test(ob), 'I9: Porträt, Schiffssymbol und Schiffsname im Overlay');
    assert(/Rifter\s*Tony angedockt in Jita IV/.test(ob) && d.querySelector('#ov-body .chr .chr-r b[style*="color"]') && d.querySelector('#ov-body .chr .ch-dot.on'), 'Y6: wie EVE – Schiff angedockt in Station, System rechts in Sicherheitsfarbe, Online-Punkt am Namen: ' + ob);
    const s2 = T.ovLoad(); s2.view = 'pi'; T.ovSave(s2); T.ovRender();
    ob = $('ov-body').textContent;
    assert(/Jita IV/.test(ob) && /Extraktor noch/.test(ob) && /Lager ≈ 9 %/.test(ob), 'Overlay „Planeten“: Laufzeit und Lager');
    assert(d.querySelector('#ov-body .ov-card.warnc'), 'Planet mit bald leerem Extraktor gelb markiert');
    console.log('\nALL CHARACTER TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
