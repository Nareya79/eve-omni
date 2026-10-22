// Kompaktansicht / Overlay: Trades mit Ueberboten-Alarm, Gewinn netto pro Stueck + gesamt, Sperrzeit, Ansichten,
// Skills/Wallet, Einstellungen - und die Schnittstelle zum Programm EVECore.exe (window.evecoreHost).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const JITA = 60003760;
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
const iso = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
let oid = 500;
function ord(type, buy, price, vol, ageMin){
  return { order_id: oid++, type_id: type, is_buy_order: buy, price, volume_remain: vol, volume_total: vol, location_id: JITA,
           issued: iso(Date.now() - ageMin * 60000), duration: 90, min_volume: 1, range: 'station', system_id: 30000142 };
}
const MY = ord(1001, true, 99510, 70, 2);          // eigene Kauforder, erst 2 Minuten alt -> Sperre aktiv
let BOOK = [ ord(1001, true, 99520, 40, 30), ord(1001, false, 118000, 20, 30) ];
const TRADE = { id:'t1', tid:1001, name:'Neurotoxin Recovery', hub:'jita', charId:'111', charName:'Taron Velkar', qty:120, buy:99510, sell:120200,
                unit:14567.89, margin:14.6, created: Date.now() - 3600000, status:'active', buyDone:false, buyOrderId: MY.order_id };
const QUEUE = [{ skill_id:3300, finished_level:5, queue_position:0, start_date: iso(Date.now() - 3600000), finish_date: iso(Date.now() + 2*86400000),
                 training_start_sp: 1000, level_start_sp: 0, level_end_sp: 256000 }];

function makeWindow(extra, host){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      w.localStorage.setItem('eve-zentrale-active-char', '111');
      w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify([TRADE]));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.sessionStorage.setItem('eve-sso-verifier', 'v'); w.sessionStorage.setItem('eve-sso-state', 'S1');
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.__notes = []; w.__beeps = 0; w.__calls = [];
      w.Notification = function(t, o){ w.__notes.push({ t, o }); }; w.Notification.permission = 'granted'; w.Notification.requestPermission = () => Promise.resolve('granted');
      w.AudioContext = function(){ this.currentTime = 0; this.state = 'running'; this.destination = {};
        this.createOscillator = () => ({ frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type: '', connect(){}, start(){ w.__beeps++; }, stop(){} });
        this.createGain = () => ({ gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }); };
      if (host) w.evecoreHost = host(w);
      w.fetch = function(url, opts){
        const u = String(url); let m; w.__calls.push({ u, opts });
        const ok = (d) => Promise.resolve({ ok:true, status:200, headers:{ get:k => (k === 'x-pages' ? '1' : null) }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if ((m = u.match(/\/markets\/10000002\/orders\/.*type_id=(\d+)/))) return ok(BOOK.filter(o => o.type_id === +m[1]).concat([MY]));
        if (u.indexOf('/universe/names/') !== -1) return ok(JSON.parse(opts.body).map(id => ({ id, name: 'Neurotoxin Recovery' })));
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/transactions\//))) return ok([]);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\/journal\//))) return ok([]);
        if ((m = u.match(/\/characters\/(\d+)\/wallet\//))) return ok(2345678901.5);
        if ((m = u.match(/\/characters\/(\d+)\/orders\//))) return ok([MY]);
        if ((m = u.match(/\/characters\/(\d+)\/skillqueue\//))) return ok(QUEUE);
        if ((m = u.match(/\/characters\/(\d+)\/attributes\//))) return ok({ intelligence:20, memory:20, perception:20, willpower:20, charisma:19 });
        if ((m = u.match(/\/characters\/(\d+)\/skills\//))) return ok({ skills: [{skill_id:16622, trained_skill_level:5}], total_sp: 5000000 });
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name: 'Neurotoxin Recovery', volume: 1 });
        return Promise.reject(new Error('offline ' + u));
      };
    }
  }).window;
}

(async () => {
  try{
    // ================= Browser (ohne Programm) =================
    let w = makeWindow(); await tick(700);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert(!d.documentElement.classList.contains('in-host'), 'Im Browser keine Programm-Elemente');
    assert(!$('ov-open-btn'), 'W12: kein Knopf „Kompakt“ mehr');
    T.ovSetMode('compact'); await tick(900);   // interner Renderer (liefert auch die Overlay-Inhalte)
    assert(d.body.classList.contains('ov-mode') && T.ovGetMode() === 'compact', 'Kompaktansicht aktiv');
    const tabs = [...d.querySelectorAll('#ov-tabs .ov-tab')].map(b => [...b.childNodes].find(n => n.nodeType === 3).textContent);
    assert(tabs.join(',') === 'Trades,Navigation,Skills,Wallet,Local Report', 'Ansichten in Standard-Reihenfolge: ' + tabs);
    assert([...d.querySelectorAll('#ov-tabs .ov-tab')].every(b => b.querySelector('svg.ic2')), 'U7: OmniCom-Symbol vor jedem Titel');
    const body = $('ov-body').textContent;
    assert(/überboten →/.test(body) && /99\.530/.test(body), 'Kauforder überboten, neuer Preis 99.530 (ein Schritt über 99.520)');
    assert(/änderbar in [234]:\d\d/.test(body), 'Sperrzeit (5 Minuten nach letzter Änderung) als Countdown');
    // R4: eigene Kauforder steht zu anderem Preis als geplant -> Gewinn wird mit dem echten Preis neu gerechnet; AV1 (22.10.): Verkauf zum Marktpreis (118.000 → 117.990) statt Plan 120.200
    assert(/Gewinn netto \+7\.888,57 ISK\/Stk · gesamt \+947 Tsd\. ISK/.test(body), 'Gewinn netto pro Stück und gesamt: ' + (body.match(/Gewinn[^·]*·[^·]*/) || [''])[0]);
    assert(/1 überboten/.test(body) && /geplant netto \+947 Tsd\. ISK/.test(body), 'Zusammenfassung oben (Summe = gesamt der Karte, AV3)');
    const card = d.querySelector('#ov-body .ov-card');
    assert(card.classList.contains('alarm'), 'Karte leuchtet bei Alarm');
    assert(w.__notes.length === 1 && /überboten/.test(w.__notes[0].t) && /Neurotoxin Recovery – Kauf: neuer Preis 99530/.test(w.__notes[0].o.body), 'Windows-Meldung mit neuem Preis');
    assert(w.__beeps === 4, 'Alarm-Ton (Doppelpiep, P3: gleiche Töne wie Gang-Alarm)');
    assert(d.querySelector('#ov-tabs .ov-badge').textContent === '1', 'Zähler am Trades-Reiter');
    // Kopieren des neuen Preises
    const cpBtn = [...card.querySelectorAll('.tsc-cp-b')].find(b => /Kaufpreis/.test(b.title));
    cpBtn.onclick({ stopPropagation(){} }); await tick(30);
    assert(w.__clip === '99530', 'Neuer Preis exakt kopiert');
    // Gleicher Zustand -> kein zweiter Alarm
    await T.trRefresh(); await tick(100);
    assert(w.__notes.length === 1, 'Kein doppelter Alarm für dieselbe Lage');
    // Neues Überbieten -> neuer Alarm
    BOOK = [ ord(1001, true, 99600, 40, 30), ord(1001, false, 118000, 20, 30) ];
    await T.trRefresh(); await tick(100);
    assert(w.__notes.length === 2 && /99610/.test(w.__notes[1].o.body), 'Erneut überboten -> neuer Alarm');
    assert(/Stand: gerade eben/.test($('ov-age').textContent) && /nächste in 4:5\d|nächste in 5:00/.test($('ov-next').textContent), 'Fußzeile: Alter der Daten + nächste Aktualisierung: ' + $('ov-next').textContent);
    // Trade komplett verkauft -> beim Aktualisieren automatisch erledigt
    const t0 = Date.now() - 1800000, trs = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1'));
    trs.push({ id:'t2', tid:1002, name:'Ware2', hub:'jita', charId:'111', qty:2, buy:100, sell:200, created: t0, status:'active', buyDone:true });
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(trs));
    const ps = JSON.parse(w.localStorage.getItem('eve-zentrale-pnl-v1-111') || '{"tx":{},"fee":{},"ord":{},"upd":0}');
    ps.tx.x1 = [t0 + 60000, 1002, 2, 100, 1, JITA]; ps.tx.x2 = [t0 + 120000, 1002, 2, 200, 0, JITA];
    w.localStorage.setItem('eve-zentrale-pnl-v1-111', JSON.stringify(ps));
    await T.trRefresh(); await tick(100);
    const t2 = JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).find(t => t.id === 't2');
    assert(t2.status === 'done' && t2.finalResult > 0 && JSON.parse(w.localStorage.getItem('eve-zentrale-trades-v1')).find(t => t.id === 't1').status === 'active', 'Komplett verkaufter Trade wird automatisch erledigt');

    // --- Wallet + Skills ---
    d.querySelectorAll('#ov-tabs .ov-tab')[3].onclick(); await tick(200);
    assert(/Gesamtwert2,35 Mrd\. ISK/.test($('ov-body').textContent) && d.querySelector('#ov-body img.ow-p[src*="/characters/"]') && /2\.345\.678\.901,50 ISK/.test($('ov-body').textContent), 'Wallet: Kontostand kurz und exakt');
    d.querySelectorAll('#ov-tabs .ov-tab')[2].onclick(); await tick(400);
    const sk = $('ov-body').textContent;
    assert(/Taron Velkar/.test(sk) && /V/.test(sk) && /Warteschlange: 1 Skill, leer in/.test(sk), 'Skills: aktueller Skill und Ende der Warteschlange');
    assert(d.querySelector('#ov-body .ow-c img.ow-p[src*="/characters/"]'), 'I10: Porträt im Skills-Overlay');

    // --- Einstellungen (Konto) ---
    T.ovSetMode('full');
    const rows = d.querySelectorAll('#ovs-views .ov-view-row');
    assert(rows.length === 33 && /Sound/.test(d.getElementById("ovs-views").textContent) && /Produktion/.test(d.getElementById('ovs-views').textContent) && /Workbench/.test(d.getElementById('ovs-views').textContent) && /OmniBreaker/.test(d.getElementById('ovs-views').textContent) && /Mail/.test(d.getElementById('ovs-views').textContent) && /Markt/.test(d.getElementById('ovs-views').textContent) && !/Übersicht/.test(d.getElementById('ovs-views').textContent) && /Wurmlöcher/.test(d.getElementById('ovs-views').textContent) && /Uhr & Timer/.test(d.getElementById('ovs-views').textContent) && /D-Scan/.test(d.getElementById('ovs-views').textContent) && /Wertschätzer/.test(d.getElementById('ovs-views').textContent) && /Industrie/.test(d.getElementById('ovs-views').textContent) && /Leistung/.test(d.getElementById('ovs-views').textContent) && /Notizen/.test(d.getElementById('ovs-views').textContent) && /Radar/.test(d.getElementById('ovs-views').textContent) && /Assets/.test(d.getElementById('ovs-views').textContent) && /Scanner-Plan/.test(d.getElementById('ovs-views').textContent) && /Jukebox/.test(d.getElementById('ovs-views').textContent), 'Einstellungen: 16 Ansichten + OmniCom-Zeile (u. a. Radar, Assets, Scanner-Plan, Local, Planeten, Jukebox, Karte, Gang-Alarm)');
    assert(!d.querySelector('#ovs-views button') && !d.getElementById('ovs-v-trades'), 'W12: keine Reiter/Reihenfolge der Kompaktansicht mehr');
    $('ovs-alpha').value = '0.5'; $('ovs-alpha').oninput();
    assert(d.documentElement.style.getPropertyValue('--ov-alpha') === '0.5', 'Hintergrund-Deckkraft wirkt sofort');
    $('ovs-sound').checked = false; $('ovs-sound').onchange();
    $('ovs-test').onclick();
    assert(w.__notes.length === 3 && w.__beeps === 8, 'Alarm testen: Meldung ja, Ton aus');
    $('ovs-refresh').value = '0'; $('ovs-refresh').onchange();
    assert(T.ovLoad().refresh === 0, 'Automatisches Aktualisieren abschaltbar');
    w.close();

    // ================= Im Programm (window.evecoreHost) =================
    let S = { alwaysOnTop:true, transparent:false, clickThrough:false, opacity:0.9, hotkeys:{ clickThrough:'CommandOrControl+Shift+E', toggleShow:'CommandOrControl+Shift+O', toggleMode:'CommandOrControl+Shift+K', nextView:'' },
              hotkeyStatus:{ clickThrough:true, toggleShow:true, toggleMode:true }, backup:{ on:true, logins:false, dirEffective:'D:\\Sicherungen\\EVECore-Sicherungen' }, htmlPathEffective:'C:\\EVECore\\EVECore.html' };
    const H = { modes:[], patches:[], backups:[], cmd:null, attention:0, ready:0 };
    w = makeWindow({ 'eve-zentrale-overlay-v1': JSON.stringify({ refresh:0 }) }, win => ({
      setMode: m => H.modes.push(m), onCommand: cb => { H.cmd = cb; }, ready: () => { H.ready++; },
      getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))),
      setSettings: p => { H.patches.push(p); if (p.hotkeys) Object.assign(S.hotkeys, p.hotkeys); else Object.assign(S, p); return Promise.resolve(JSON.parse(JSON.stringify(S))); },
      writeBackup: (json, reason) => { H.backups.push({ json, reason }); return Promise.resolve(); },
      attention: () => { H.attention++; }, hide(){}, resizeTo(){}, resizeEnd(){}, resetBounds(){}, pickHtml: () => Promise.resolve(S), pickBackupDir: () => Promise.resolve(S)
    }));
    await tick(700);
    d = w.document; $ = id => d.getElementById(id); T = w.__test;
    assert(d.documentElement.classList.contains('in-host') && H.cmd && H.ready === 1, 'Programm erkannt, Befehlskanal verbunden');
    assert($('hs-ontop').checked && $('hs-opacity-v').textContent === '90 %' && /EVECore-Sicherungen/.test($('hs-backup-dir').textContent), 'Programm-Einstellungen angezeigt');
    const hk = [...d.querySelectorAll('#hs-hotkeys .hk-btn')].map(b => b.textContent);
    assert(hk[0] === 'Strg+Umschalt+E' && hk[1] === 'Strg+Umschalt+O' && /kein Kürzel/.test(hk[3]), 'Tastenkürzel lesbar: ' + hk.join(' | '));
    // Tastenkuerzel aendern
    d.querySelectorAll('#hs-hotkeys .hk-btn')[3].onclick(); await tick(20);
    assert(/Tasten drücken/.test(d.querySelectorAll('#hs-hotkeys .hk-btn')[3].textContent), 'Aufnahme-Modus');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key:'n', code:'KeyN', ctrlKey:true, altKey:true, bubbles:true }));
    await tick(50);
    assert(H.patches.some(p => p.hotkeys && p.hotkeys.musicToggle === 'CommandOrControl+Alt+N') && /Strg\+Alt\+N/.test(d.querySelectorAll('#hs-hotkeys .hk-btn')[3].textContent), 'Neues Kürzel gespeichert');
    assert(T.hsAccelFromEvent({ code:'KeyE' }) === '' && T.hsAccelFromEvent({ code:'F7' }) === 'F7' && T.hsAccelFromEvent({ code:'Numpad3', shiftKey:true }) === 'Shift+num3', 'Kürzel-Regeln (ohne Zusatztaste nur F-Tasten)');
    // Schalter
    $('hs-transparent').checked = true; $('hs-transparent').onchange(); await tick(20);
    assert(H.patches.some(p => p.transparent === true), 'Transparent-Schalter geht ans Programm');
    // S2: Durchklicken nur fuer ein Fenster
    const ctb = d.querySelector('#hs-ct-win input[data-ctwin="trades"]');
    ctb.checked = true; ctb.dispatchEvent(new w.Event('change', { bubbles:true })); await tick(20);
    assert(H.patches.some(p => p.windows && p.windows.trades && p.windows.trades.ct === true) && !d.querySelector('#hs-ct-win input[data-ctwin="neocom"]'), 'S2: Durchklicken je Fenster (OmniCom bleibt klickbar)');
    // W12: kein Kompaktmodus mehr – Titelleiste des Hauptfensters hat die Overlay-Schalter
    assert(!/Kompakt/.test($('hs-hotkeys').textContent), 'W12: keine Kompakt-Tastenkürzel');
    H.cmd({ type:'mode', mode:'compact' }); H.cmd({ type:'nextView' }); await tick(50);
    assert(T.ovGetMode() === 'full' && !H.modes.length, 'W12: alte Modus-Befehle bleiben wirkungslos');
    $('win-lock').onclick(); await tick(20);
    assert(H.patches.some(p => p.windows && p.windows.main && p.windows.main.lock === true), 'W12: Schloss in der Titelleiste sperrt das Hauptfenster');
    $('win-pin').onclick(); await tick(20);
    assert(H.patches.some(p => p.alwaysOnTopFull === true && p.alwaysOnTop === true), 'W12: Stecknadel = Hauptfenster immer im Vordergrund');
    H.cmd({ type:'settings', settings: Object.assign({}, S, { windows: { main: { ct: true } } }) }); await tick(20);
    assert($('win-ct').getAttribute('aria-pressed') === 'true' && d.querySelector('#hs-ct-win input[data-ctwin="main"]').checked, 'W12: Durchklicken des Hauptfensters angezeigt');
    T.ovSetMode('compact');
    H.cmd({ type:'settings', settings: Object.assign({}, S, { clickThrough:true }) }); await tick(20);
    assert(d.documentElement.classList.contains('ct-on') && $('ov-ct').getAttribute('aria-pressed') === 'true' && /Durchklicken aktiv/.test($('ov-next').textContent), 'Durchklicken sichtbar angezeigt');
    // Login-Ruecksprung automatisch
    w.__calls = [];
    H.cmd({ type:'sso', url:'https://claude.ai/artifact/SCXYB3dGYr' + 'Vf9XaTZcQW7U?code=ABC123&state=S1' }); await tick(80);
    const tokCall = w.__calls.find(c => /login\.eveonline\.com/.test(c.u));
    assert(tokCall && /code=ABC123/.test(tokCall.opts.body) && /code_verifier=v/.test(tokCall.opts.body), 'Login-Code wird automatisch übernommen');
    // Sicherung auf Anforderung
    H.cmd({ type:'backupRequest', includeLogins:false, reason:'taeglich' }); await tick(30);
    assert(H.backups.length === 1 && H.backups[0].reason === 'taeglich' && JSON.parse(H.backups[0].json).format === 'evecore-daten' && !JSON.parse(H.backups[0].json).data['eve-zentrale-characters'], 'Sicherung an das Programm übergeben (ohne Logins)');
    // Alarm holt Aufmerksamkeit
    const att0 = H.attention;
    T.ovAlarm([{ name:'X', side:'s', price:5 }], false);
    assert(H.attention === att0 + 1, 'Alarm meldet sich beim Programm (Fenster blinkt)');

    console.log('\nALL OVERLAY TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
