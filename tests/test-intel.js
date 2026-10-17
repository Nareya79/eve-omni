// Intel: Local-Bedrohung (Local einfuegen -> Piloten, Corp/Allianz, zKillboard-Gefahr, Freund/Feind aus Kontakten), Overlay-Ansicht "Local", Tastenkuerzel.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
const PILOTS = { 'taron velkar': 111, 'alpha pilot': 1001, 'bravo pilot': 1002, 'charlie pilot': 1003 };
const AFF = { 111: { corporation_id: 2002 }, 1001: { corporation_id: 2001, alliance_id: 3001 }, 1002: { corporation_id: 2002 }, 1003: { corporation_id: 2003 } };
const NAMES = { 2001: 'Bad Corp', 3001: 'Evil Alliance', 2002: 'Meine Corp', 2003: 'Neutral Corp', 587: 'Rifter', 17738: 'Machariel' };
let ZK = 0, CALLS = [];
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
          return ok({ characters: names.map(n => PILOTS[n.toLowerCase()] ? { id: PILOTS[n.toLowerCase()], name: n.replace(/\b\w/g, c => c.toUpperCase()) } : null).filter(Boolean) });
        }
        if (u.indexOf('/characters/affiliation/') >= 0) return ok(JSON.parse(opts.body).map(id => Object.assign({ character_id: id }, AFF[id] || { corporation_id: 1 })));
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: NAMES[id] || ('X' + id) })));
        if ((m = u.match(/\/(corporations|alliances)\/(\d+)\//))) return ok({ ticker: ({ 2001: 'BAD', 3001: 'EVIL', 2002: 'MEIN', 2003: 'NEUT' })[m[2]] || 'X' });
        if (/\/characters\/111\/contacts\//.test(u)) return ok([{ contact_id: 3001, contact_type: 'alliance', standing: -10 }]);
        if ((m = u.match(/zkillboard\.com\/api\/stats\/characterID\/(\d+)\//))){
          ZK++;
          if (m[1] === '1001') return ok({ dangerRatio: 92, gangRatio: 35, shipsDestroyed: 1234, shipsLost: 56, iskDestroyed: 5e11, soloKills: 400,
            months: { '202608': { shipsDestroyed: 10, shipsLost: 1 }, '202609': { shipsDestroyed: 4 } },
            info: { birthday: '2015-03-01T00:00:00Z', secStatus: -4.2 }, topShips: [{ shipTypeID: 17738 }], recentShips: [{ shipTypeID: 587, kills: 3 }, { shipTypeID: 17738 }] });
          if (m[1] === '1003') return ok({ dangerRatio: 20, gangRatio: 90, shipsDestroyed: 8, shipsLost: 30, months: { '202401': { shipsLost: 2 } }, info: { birthday: '2025-12-01T00:00:00Z' } });
          return Promise.resolve({ ok:false, status:404, headers:{get:()=>null}, json:() => Promise.resolve(null) });
        }
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Einlesen: Tabs, doppelte Namen, Muell
    const parsed = T.ltParse('Alpha Pilot\r\nBravo Pilot\tCharlie Pilot\nalpha pilot\n\nx\nDas ist eine sehr lange Zeile die sicher kein Pilotenname ist\n  Unknown Guy  \n<script>');
    assert(parsed.join('|') === 'Alpha Pilot|Bravo Pilot|Charlie Pilot|Unknown Guy', 'Local-Text wird sauber in Namen zerlegt: ' + parsed.join('|'));
    assert($('neo-btn-intel') && $('panel-intel'), 'OmniCom: neuer Bereich Intel');
    $('neo-btn-intel').onclick();
    assert($('panel-intel').classList.contains('active'), 'Intel öffnet sich');
    $('lt-paste').value = 'Alpha Pilot\nBravo Pilot\nCharlie Pilot\nUnknown Guy';
    $('lt-go').onclick(); await tick(600);
    const st = T.ltState();
    assert(st.rows.length === 3 && st.unknown.join() === 'Unknown Guy', '3 Piloten erkannt, 1 unbekannt');
    assert(st.rows[0].name === 'Alpha Pilot' && st.rows[0].zk.danger === 92, 'Sortiert nach Gefahr: gefährlichster oben');
    const a = st.rows[0], b = st.rows.find(r => r.id === 1002), c = st.rows.find(r => r.id === 1003);
    assert(a.rel === -10 && b.rel === 10 && c.rel === 0, 'Freund/Feind: Allianz-Kontakt −10 = Feind, eigene Corp = Freund, sonst neutral');
    assert(a.allianceName === 'Evil Alliance' && a.corpName === 'Bad Corp', 'Corp und Allianz aufgelöst');
    assert(a.zk.last === '202609' && c.zk.last === '202401' && a.zk.ships[0] === 587, 'Letzte Aktivität und zuletzt geflogene Schiffe');
    const rows = d.querySelectorAll('#lt-body tr');
    assert(rows.length === 3 && rows[0].classList.contains('lt-foe') && d.querySelector('#lt-body tr.lt-friend'), 'Tabelle: Feind rot, Freund blau markiert');
    assert(/92 %/.test(rows[0].textContent) && /1\.234 \/ 56/.test(rows[0].textContent) && /Evil Alliance/.test(rows[0].textContent), 'Zeile zeigt Gefahr, Kills/Verluste, Allianz');
    assert(rows[0].querySelector('.lt-bar.hot'), 'Gefahrbalken ab 70 % rot');
    assert(/keine Kills/.test([...rows].find(r => /Bravo/.test(r.textContent)).textContent), 'Pilot ohne zKillboard-Einträge: „keine Kills“');
    assert(/3 Piloten geprüft/.test($('lt-status').textContent) && /Unknown Guy/.test($('lt-status').textContent) && /1 gefährlich/.test($('lt-status').textContent), 'Status: geprüft, nicht gefunden, Anzahl gefährlich');
    assert(d.querySelectorAll('#lt-groups .lt-grp').length === 3, 'Gruppen-Übersicht nach Corp/Allianz');
    assert(ZK === 3, 'zKillboard je Pilot einmal gefragt');
    const cache = JSON.parse(w.localStorage.getItem('eve-zentrale-zkcache-v1'));
    assert(cache['1001'] && cache['1003'] && cache['1002'] && cache['1002'].d.kills === 0, 'zKillboard-Werte 1 Std zwischengespeichert (Speicher-Schlüssel eve-zentrale-…)');
    await T.ltCheck('Alpha Pilot\nCharlie Pilot'); await tick(200);
    assert(ZK === 3, 'Zweite Prüfung innerhalb einer Stunde: keine neuen zKillboard-Abfragen');
    // ohne zKillboard
    await T.ltCheck('Bravo Pilot', { zkill: false });
    assert(ZK === 3 && T.ltState().rows.length === 1 && T.ltState().rows[0].zk === null, 'zKillboard abschaltbar');
    await T.ltCheck('Bravo Pilot\nTaron Velkar', { zkill: false });
    assert(T.ltState().rows.length === 1 && T.ltState().rows[0].id === 1002 && !T.ltState().unknown.length, 'H2: eigener Charakter steht nicht in der Local-Liste');
    // Kompaktansicht + Tastenkuerzel (Programm schickt die Zwischenablage)
    T.ovSetMode('compact'); await tick(200);
    T.onHostCommand({ type: 'localPaste', text: 'Alpha Pilot\nBravo Pilot\nCharlie Pilot' }); await tick(500);
    assert(T.ovLoad().view === 'local', 'Tastenkürzel: Kompaktansicht springt auf „Local“');
    const ob = $('ov-body').textContent;
    assert(/3 Piloten/.test(ob) && /1 gefährlich/.test(ob) && /Alpha Pilot/.test(ob), 'Overlay: Liste: ' + ob.slice(0, 160));
    const orow = d.querySelector('#ov-body .olt-r.hot.foe');
    assert(orow && d.querySelector('#ov-body .olt-r.friend'), 'Overlay: gefährlicher Feind hervorgehoben, Freund blau');
    assert(orow.querySelector('.olb.hot i').style.width === '92%' && orow.querySelector('.olb.gang i').style.width === '35%', 'Balken: Gefahr 92 %, Gang 35 %');
    assert(/\[BAD\]/.test(orow.textContent) && !/EVIL/.test(orow.textContent) && /Evil Alliance/.test(orow.title), 'H3: nur Corp-Kürzel in der Zeile, Allianz im Tooltip: ' + orow.textContent);
    assert(/>Corp</.test(d.querySelector('#ov-body .olt-h').innerHTML), 'H3: Spalte heißt „Corp“');
    assert(/Machariel|Rifter/.test(orow.title) && /Kills 1\.234/.test(orow.title), 'Details (Schiffe, Kills) als Tooltip');
    assert(orow.querySelector('img.p').getAttribute('src') === 'https://images.evetech.net/characters/1001/portrait?size=32', 'Spielerporträt in der Zeile');
    assert(d.querySelector('#ov-body .olt-h') && /Gefahr/.test(d.querySelector('#ov-body .olt-h').textContent), 'Kopfzeile Pilot/Gefahr/Gang');
    T.onHostCommand({ type: 'localPaste', text: 'nur Quatsch <>' }); await tick(100);
    assert(/keine Pilotennamen/.test($('lt-status').textContent) && T.ltState().rows.length === 3, 'Leere/falsche Zwischenablage: Hinweis, alte Liste bleibt');
    // Einzelfenster-Liste ist eine Overlay-Ansicht
    const box = d.createElement('div'); T.ovRenderViewInto('local', box);
    assert(/Alpha Pilot/.test(box.textContent), 'Ansicht „Local“ auch als Einzelfenster darstellbar');
    // Automatische Erkennung (Programm meldet kopierten Text): nur echte Pilotenlisten ersetzen die Anzeige
    const before = T.ltState().rows.map(r => r.id).join();
    T.onHostCommand({ type: 'localPaste', text: 'Tritanium\nPyerite\nMexallon', auto: true }); await tick(400);
    assert(T.ltState().rows.map(r => r.id).join() === before, 'Kopierte Nicht-Piloten (z. B. Artikelnamen) werden ignoriert');
    T.onHostCommand({ type: 'localPaste', text: 'Charlie Pilot\nBravo Pilot', auto: true }); await tick(500);
    assert(T.ltState().rows.length === 2 && $('lt-paste').value === 'Charlie Pilot\nBravo Pilot', 'Kopierte Local-Liste wird automatisch geprüft');
    // Kopien kurz hintereinander: die neueste gewinnt
    T.ltCheck('Alpha Pilot\nBravo Pilot\nCharlie Pilot'); T.ltCheck('Alpha Pilot'); await tick(700);
    assert(T.ltState().rows.length === 1 && T.ltState().rows[0].id === 1001, 'Mehrere Kopien kurz hintereinander: die neueste wird angezeigt');
    console.log('\nALL INTEL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
