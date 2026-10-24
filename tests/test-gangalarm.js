// Gang-Alarm (zKillboard live + Standort), Karte als Overlay, Autoload beim Start, Jukebox weiterspielen beim Start.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
// Kette: 1 - 2 - 3 - 4 - 5 (ich bin in 2)
const SYS = { 1:['Alpha',-0.2,0,0], 2:['Bravo',-0.3,10,0], 3:['Charlie',-0.4,20,0], 4:['Delta',-0.1,30,0], 5:['Echo',0.5,40,0] };
const G = { 1:[2], 2:[1,3], 3:[2,4], 4:[3,5], 5:[4] };
let CALLS = [];
function makeWindow(extra, host){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.__notes = []; w.__beeps = 0;
      w.Notification = function(t, o){ w.__notes.push({ t, o }); }; w.Notification.permission = 'granted';
      w.AudioContext = function(){ this.currentTime = 0; this.destination = {}; this.createOscillator = () => ({ frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){ w.__beeps++; }, stop(){} }); this.createGain = () => ({ gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }); };
      w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; };
      if (host) w.evecoreHost = host;
      w.fetch = function(url, opts){
        const u = String(url); let m; CALLS.push(u);
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (/\/characters\/111\/location\//.test(u)) return ok({ solar_system_id: 2 });
        if (/\/characters\/222\/location\//.test(u)) return ok({ solar_system_id: 5 });
        if (/\/characters\/111\/(online|ship)\//.test(u)) return ok(/online/.test(u) ? { online: true } : { ship_type_id: 587 });
        if (/\/characters\/111\/contacts\//.test(u)) return ok([{ contact_id: 99000777, standing: 10 }]);
        if (/\/characters\/affiliation\//.test(u)) return ok([{ character_id: 111, corporation_id: 98000001 }]);
        if ((m = u.match(/\/universe\/systems\/(\d+)\//))){ const x = SYS[m[1]]; return ok({ system_id: +m[1], name: x[0], security_status: x[1], constellation_id: 100, stargates: G[m[1]].map(t => +m[1] * 100 + t), position: { x: x[2] * 1e15, y: 0, z: x[3] * 1e15 } }); }
        if ((m = u.match(/\/universe\/stargates\/(\d+)\//))) return ok({ destination: { system_id: +m[1] % 100 } });
        if (/\/universe\/constellations\//.test(u)) return ok({ region_id: 10000060, systems: [1, 2, 3, 4, 5] });
        if (/\/universe\/regions\/10000060\//.test(u)) return ok({ name: 'Delve', constellations: [100] });
        if (u.indexOf('/universe/names/') >= 0) return ok(JSON.parse(opts.body).map(id => ({ id, name: ({ 22456: 'Sabre', 17738: 'Machariel', 587: 'Rifter', 10000060: 'Delve', 99000666: 'Bad Alliance', 99000777: 'Blue Alliance' })[id] || ('X' + id) })));
        if ((m = u.match(/\/(alliances|corporations)\/(\d+)\//))) return ok({ ticker: m[2] === '99000666' ? 'BAD' : 'X' });
        if (/\/universe\/ids\//.test(u)){ const n = JSON.parse(opts.body); return ok({ systems: n.map(x => { const k = Object.keys(SYS).find(i => SYS[i][0].toLowerCase() === String(x).toLowerCase()); return k ? { id: +k, name: SYS[k][0] } : null; }).filter(Boolean) }); }
        if (/system_kills|system_jumps/.test(u)) return ok([]);
        if (/\/wallet\//.test(u)) return ok(123);
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
const kill = (id, sys, att, opts) => ({ killmail_id: id, esi: { killmail_id: id, solar_system_id: sys, killmail_time: new Date().toISOString(), victim: { ship_type_id: (opts && opts.pod) ? 670 : 587, corporation_id: 5 },
  attackers: Array.from({ length: att }, (_, i) => ({ character_id: 1000 + i, corporation_id: 2000, alliance_id: (opts && opts.ally) || 99000666, ship_type_id: i % 2 ? 22456 : 17738 })) }, zkb: { npc: !!(opts && opts.npc), totalValue: 5e7 } });
(async () => {
  try{
    const H = { views: [], feed: [] };
    const host = { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: p => { H.patches = (H.patches || []).concat([p]); return Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }); },
      onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(){}, publishView(){}, showView(id){ H.views.push(id); }, killfeed(on){ H.feed.push(on); }, notify(t, b){ H.note = b; },
      intelList(){ return Promise.resolve({ ok: true, dir: 'X', chans: ['Delve.Intel', 'Lokal', 'Corp'] }); }, intelSet(o){ H.intel = o; return Promise.resolve({ ok: true, dir: 'X', chans: [] }); } };
    let w = makeWindow({ 'eve-zentrale-gangalarm-v1': JSON.stringify({ on: false, jumps: 2, min: 3, popSecs: 3, desk: true }) }, host); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert($('ga-box') && $('panel-settings').contains($('ga-box')) && $('ga-jumps').value === '2' && !$('ga-on').checked, 'Einstellungen: Bereich Gang-Alarm mit Umkreis und Mindest-Angreifern');
    assert(d.querySelectorAll('#ga-chars [data-ga-char]').length === 1 && $('ga-popsecs').value === '5', 'Charaktere zum Anhaken (einer oder mehrere), T5: alte 3 s werden 5 s');
    $('ga-goto').onclick();
    assert($('panel-settings').classList.contains('active'), 'Intel › „Einstellungen Gang-Alarm“ springt in die Einstellungen');
    T.ovSatAction('alarm', { type: 'openSettings' });
    assert($('panel-settings').classList.contains('active'), 'Zahnrad im Alarm-Fenster öffnet die Gang-Alarm-Einstellungen');
    $('ga-on').checked = true; $('ga-on').onchange(); await tick(600);
    assert(H.feed[H.feed.length - 1] === true, 'Einschalten startet den Kill-Strom im Programm');
    const st = T.gaState();
    assert(st.origin === 2 && st.near && st.near[2] === 0 && st.near[1] === 1 && st.near[3] === 1 && st.near[4] === 2 && st.near[5] === undefined, 'Umkreis ab meinem Standort: 2 Sprünge (Echo ist 3 Sprünge weg)');
    // Filter
    assert(!(await T.gaOnKill(kill(1, 5, 10))), 'Kampf zu weit weg: kein Alarm');
    assert(!(await T.gaOnKill(kill(2, 3, 2))), 'Zu wenige Angreifer (2 < 3): kein Alarm');
    assert(!(await T.gaOnKill(kill(3, 3, 5, { npc: true }))), 'NPC-Kill: kein Alarm');
    assert(!(await T.gaOnKill(kill(4, 3, 5, { pod: true }))), 'Nur Kapsel: kein Alarm');
    assert(!(await T.gaOnKill(kill(5, 3, 5, { ally: 99000777 }))), 'Freunde (blau): kein Alarm');
    // CC2: abgewählte Sicherheitsklassen gar nicht melden (Einstellungen + Overlay-Knöpfe H/L/0.0)
    ['high', 'low', 'null'].forEach(k => { $('ga-sec-' + k).checked = false; $('ga-sec-' + k).onchange(); });
    assert(!(await T.gaOnKill(kill(6, 3, 5))) && T.gaState().alarms.length === 0, 'CC2: alle Sicherheitsklassen abgewählt: kein Alarm, kein Ton, keine Meldung');
    let cb = d.createElement('div'); T.ovRenderViewInto('alarm', cb);
    assert(cb.querySelectorAll('[data-ova="gaSec"][aria-pressed="false"]').length === 3, 'CC2: Alert-Overlay zeigt H / L / 0.0 als abgewählt');
    ['high', 'low', 'null'].forEach(k => T.ovSatAction('alarm', { type: 'gaSec', arg: k }));
    assert(['high', 'low', 'null'].every(k => $('ga-sec-' + k).checked), 'CC2: Overlay-Knöpfe schalten wieder ein (Einstellungen ziehen mit)');
    assert(H.views.length === 0 && T.gaState().alarms.length === 0, 'Bisher kein Fenster aufgegangen');
    // echter Alarm
    H.cmd({ type: 'kill', data: kill(10, 4, 8) }); await tick(300);
    let al = T.gaState().alarms;
    assert(al.length === 1 && al[0].sys === 4 && al[0].dist === 2 && al[0].att === 8, 'Gang mit 8 Piloten 2 Sprünge weg: Alarm');
    assert(H.views.indexOf('alarm') >= 0 && /8 Piloten in Delta – 2 Sprünge von Taron Velkar/.test(H.note) && w.__beeps >= 1, 'Alarm-Fenster geht auf, Meldung + Ton: ' + H.note);
    // HZ23: Intel-Kanäle über den Alert
    T.sysNamesSet(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    $('ga-intel-on').checked = true; $('ga-intel-on').onchange(); await tick(200);
    assert(H.intel && H.intel.on && H.intel.chans.join() === 'Delve.Intel' && d.querySelectorAll('#ga-intel-chans input').length === 3, 'HZ23: Kanäle aus dem Chatlog-Ordner, „intel“ vorausgewählt, an main.js gemeldet');
    const p1 = T.gaIntelParse('charlie Bad Guy Sabre +3 nv'), p2 = T.gaIntelParse('Charlie clr'), p3 = T.gaIntelParse('https://dscan.info/v/x Hallo');
    assert(p1.sys === 'Charlie' && p1.att === 4 && !p1.clr && p2.clr && p2.sys === 'Charlie' && !p3.sys, 'HZ23: System (Groß/klein egal), +3 = 4 Piloten, clr, Links ignoriert');
    const nAl = T.gaState().alarms.length, v0 = H.views.length;
    assert(!(await T.gaOnIntel({ chan: 'Delve.Intel', who: 'Scout', text: 'Echo Bad Guy' })), 'HZ23: zu weit weg (3 Sprünge) – kein Alarm');
    assert(await T.gaOnIntel({ chan: 'Delve.Intel', who: 'Scout', text: 'Charlie Bad Guy Sabre +3' }), 'HZ23: 1 Sprung weg – Alarm');
    al = T.gaState().alarms;
    assert(al.length === nAl + 1 && al[0].sys === 3 && al[0].intel && al[0].att === 4 && H.views.length > v0 && /Intel \(Delve\.Intel\): Charlie – 1 Sprung/.test(H.note), 'HZ23: Alarm über den Alert (Fenster, Meldung): ' + H.note);
    let ib = d.createElement('div'); T.ovRenderViewInto('alarm', ib);
    assert(/Intel · Delve\.Intel/.test(ib.textContent) && /Charlie Bad Guy Sabre \+3/.test(ib.textContent), 'HZ23: Alert-Overlay zeigt die Intel-Zeile');
    assert(T.grLoad()[0].intel && /Scout: Charlie Bad Guy/.test(T.grLoad()[0].intel), 'HZ23: steht im Gang-Report');
    await T.gaOnIntel({ chan: 'Delve.Intel', who: 'Scout', text: 'Charlie clr' });
    assert(!T.gaState().alarms.some(a => a.intel && a.sys === 3), 'HZ23: „clr“ nimmt die Meldung weg');
    w.localStorage.setItem('eve-zentrale-gangreport-v1', JSON.stringify(T.grLoad().filter(e => !e.intel)));   // Rest des Tests erwartet nur Kill-Meldungen
    assert(!$('ga-desk').checked === false, 'Einstellung „Desktop-Benachrichtigung“ vorhanden (hier an)');
    $('ga-desk').checked = false; $('ga-desk').onchange(); H.note = '';
    H.cmd({ type: 'kill', data: kill(11, 4, 12) }); await tick(300);
    assert(H.note === '' && w.__beeps >= 2, 'Desktop-Benachrichtigung aus: nur Ton + Alarm-Fenster, keine Windows-Meldung');
    H.cmd({ type: 'kill', data: kill(11, 4, 12) }); await tick(200);
    al = T.gaState().alarms;
    assert(al.length === 1 && al[0].kills === 2 && al[0].att === 12, 'Weiterer Kill am selben Ort = derselbe Kampf (2 Kills, 12 Piloten), doppelte Meldung ignoriert');
    assert(/data-neo="report"[^>]*class="[^"]*sk-red/.test(T.neoOverlayHtml()) && $('ga-blink').checked && $('ga-blinksecs').value === '5', 'S14: Gang-Report-Symbol im OmniCom blinkt rot (Standard an, 5 s)');
    // T5: Schließen jetzt in 5-s-Schritten (alte 3 s → 5 s)
    await tick(5000);
    assert((H.patches || []).some(p => p.windows && p.windows.alarm && p.windows.alarm.open === false), 'Alarm-Fenster schließt sich nach 5 Sekunden von selbst');
    const box = d.createElement('div'); T.ovRenderViewInto('alarm', box);
    assert(/Delta/.test(box.textContent) && /12 Piloten/.test(box.textContent) && /2 Sprünge entfernt/.test(box.textContent) && /Taron Velkar/.test(box.textContent) && /Dein Charakter/.test(box.textContent) && /Sabre ×10|Machariel ×10/.test(box.textContent) && /<BAD>/.test(box.textContent) && box.querySelector('.gh .gh-top') && box.querySelector('.ga-r.kill img[src*="/types/"]') && box.querySelector('.ga-r img[src*="/characters/1000/portrait"]'), 'Overlay „Gang-Alarm“ wie „Hostile reported“: System + Sprünge, eigener Charakter mit Bild, Kill, Schiffe ×Anzahl, Piloten mit Porträt: ' + box.textContent);
    assert(/Taron Velkar/.test(box.textContent) && /Bravo/.test(box.textContent), 'Kopf zeigt, wessen Standort beobachtet wird');
    assert(box.querySelector('a.ga-r.kill[href="https://zkillboard.com/kill/11/"][target="_blank"]'), 'I5: Klick auf den Kill öffnet ihn auf zKillboard');
    assert(/Delta/.test($('ga-list').textContent), 'Auch in der großen Ansicht unter Intel gelistet');
    // Gang-Report: Meldungen bleiben stehen
    const rep = JSON.parse(w.localStorage.getItem('eve-zentrale-gangreport-v1'));
    assert(rep.length === 1 && rep[0].n === 'Delta' && rep[0].kills === 2 && rep[0].who === 'Taron Velkar', 'Gang-Report speichert die Meldung (Delta, 2 Kills, Taron Velkar)');
    // Y4: neuer Stil wie EVE (Standard) – eine Zeile je System mit Kacheln
    const ry = d.createElement('div'); T.ovRenderViewInto('gangreport', ry);
    const gx = ry.querySelector('.grx.gr-e');
    assert(gx && /Delta/.test(gx.querySelector('.grx-sys b').textContent) && gx.querySelector('.grx-sys b').style.color && gx.querySelector('.grx-j').textContent === '2' && /^\d+:\d\d$/.test(gx.querySelector('.grx-t').textContent), 'Y4: System in Sicherheitsfarbe, Sprünge im Kreis, Zeit seit Meldung');
    assert(gx.querySelectorAll('a.grx-c.kill[href*="zkillboard.com/kill/"]').length === 2 && gx.querySelector('.grx-c.kill img[src*="/types/"]') && /12 Feinde/.test(gx.textContent) && /<BAD>/.test(gx.textContent) && gx.querySelector('.gr-who img[src*="/characters/111/portrait"]'), 'Y4: Kill-Kacheln (zKillboard), Feinde mit Ticker, eigener Charakter');
    T.ovSatAction('gangreport', { type: 'grToggle', arg: rep[0].key });
    const ry2 = d.createElement('div'); T.ovRenderViewInto('gangreport', ry2);
    assert(ry2.querySelector('.grx.open') && ry2.querySelector('.grx img[src*="/characters/1000/portrait"]'), 'Y4: Klick zeigt alle Piloten als Kacheln');
    T.ovSatAction('gangreport', { type: 'grToggle', arg: rep[0].key });
    assert(/Gang-Report im alten Stil/.test(d.getElementById('ga-grold').parentNode.textContent), 'Y4: Umschalter in den Einstellungen');
    d.getElementById('ga-grold').checked = true; d.getElementById('ga-grold').onchange.call(d.getElementById('ga-grold'));
    const rb = d.createElement('div'); T.ovRenderViewInto('gangreport', rb);
    assert(/1 Meldungen/.test(rb.textContent) && /\d\d:\d\d/.test(rb.textContent) && /Delta/.test(rb.textContent) && /2 Sprünge/.test(rb.textContent) && /Taron Velkar/.test(rb.querySelector('.gr-who').textContent) && rb.querySelector('.gr-who img[src*="/characters/111/portrait"]'), 'Overlay „Gang-Report“ mit Uhrzeit, System, Sprüngen, Charakter mit kleinem Porträt davor');
    // Klick auf die Meldung klappt Piloten + Schiffe mit Bildern auf
    assert(!rb.querySelector('.gr-det') && rep[0].p.length === 12 && rep[0].p[0].n === 'X1000' && rep[0].v.length === 2, 'Report speichert Piloten und Opfer');
    T.ovSatAction('gangreport', { type: 'grToggle', arg: rep[0].key });
    const rb3 = d.createElement('div'); T.ovRenderViewInto('gangreport', rb3);
    assert(rb3.querySelector('.gr-det') && rb3.querySelectorAll('.gr-det .ga-r').length === 14 && rb3.querySelector('.gr-det img[src*="/characters/1000/portrait"]') && rb3.querySelector('.gr-det img[src*="/types/"]') && /Kill: Rifter/.test(rb3.textContent), 'Aufgeklappt: Kills + 12 Piloten mit Porträt und Schiffsbild');
    assert(rb3.querySelector('.gr-det a.ga-r.kill[href="https://zkillboard.com/kill/10/"]'), 'I5: auch im Gang-Report ist der Kill ein zKillboard-Link');
    T.ovSatAction('gangreport', { type: 'grToggle', arg: rep[0].key });
    // Nur die letzten 10
    const many = []; for (let i = 0; i < 14; i++) many.push(Object.assign({}, rep[0], { key: 'k' + i, n: 'Sys' + i, last: Date.now() - i * 60000 }));
    w.localStorage.setItem('eve-zentrale-gangreport-v1', JSON.stringify(many));
    const rb4 = d.createElement('div'); T.ovRenderViewInto('gangreport', rb4);
    assert(rb4.querySelectorAll('.gr-e').length === 10 && /letzten 10 von 14/.test(rb4.textContent) && /Sys0/.test(rb4.textContent) && !/Sys12/.test(rb4.textContent), 'Gang-Report zeigt nur die letzten 10 Meldungen');
    w.localStorage.setItem('eve-zentrale-gangreport-v1', JSON.stringify(rep));
    const keepAl = T.gaState().alarms; T.gaState().alarms = [];
    const rb2 = d.createElement('div'); T.ovRenderViewInto('gangreport', rb2); T.gaState().alarms = keepAl;
    assert(/Delta/.test(rb2.textContent), 'Report bleibt, auch wenn das Alarm-Fenster leer ist');
    // Kill-Strom-Normalisierung (Format killmail/zkb wie RedisQ)
    const n2 = T.gaNormalize({ killID: 7, killmail: { killmail_id: 7, solar_system_id: 3, killmail_time: '2026-09-23T10:00:00Z', victim: { ship_type_id: 1 }, attackers: [{ character_id: 1, ship_type_id: 2 }, { faction_id: 500001 }] }, zkb: {} });
    assert(n2 && n2.sys === 3 && n2.att === 1 && n2.attAll === 2, 'Auch das ältere Format (killmail/zkb) wird verstanden');
    // Karte als Overlay (K6: nur noch die neue Karte) – Zustand für die Leinwand: Gang-Alarm + mein Standort
    const mb2 = d.createElement('div'); T.ovRenderMap(mb2);
    const ks = JSON.parse(mb2.querySelector('.km').getAttribute('data-km'));
    assert(!mb2.querySelector('svg') && Array.isArray(ks.al) && ks.me.some(x => x[0] === '111'), 'Karte-Overlay: neue Karte mit Alarm-Liste und meinem Standort');
    T.ovSetMode('compact'); await tick(100);
    const so = T.ovLoad(); so.views = so.views.filter(v => v.id !== 'karte').concat([{ id: 'karte', on: true }]); so.view = 'karte'; T.ovSave(so); T.ovRender(); await tick(100);
    assert(d.querySelector('#ov-body .ov-map .km'), 'Karte-Overlay zeigt die neue Karte');
    T.ovMapCmd('km:ctx:avoid:30000142:Jita'); await tick(50);
    assert(/gemieden|nicht erkannt/.test(d.getElementById('ov-body').textContent), 'K15: Meiden aus dem Rechtsklick-Menü meldet sich im Karten-Overlay');
    // Hintergrund-Deckkraft je Fenster
    const sl = d.querySelector('#ovs-views [data-alpha-view="karte"]');
    assert(sl && d.querySelector('#ovs-views [data-alpha-view="local"]'), 'Einstellungen: eigener Regler je Overlay-Fenster');
    sl.value = '0.35'; sl.oninput();
    assert(d.documentElement.style.getPropertyValue('--ov-alpha') === '0.35' && T.ovLoad().alphaView.karte === 0.35, 'Karte-Fenster: Hintergrund 35 %, andere bleiben beim allgemeinen Wert');
    const so2 = T.ovLoad(); so2.view = 'trades'; T.ovSave(so2); T.ovRender();
    assert(d.documentElement.style.getPropertyValue('--ov-alpha') === String(T.ovLoad().alpha), 'Anderes Fenster: allgemeine Deckkraft');
    T.ovSetMode('full');
    // Autoload
    const before = CALLS.length;
    const done = await T.alRun(true);
    assert(done.indexOf('Wallet') >= 0 && done.indexOf('Orders') >= 0 && done.indexOf('Skills') >= 0 && done.indexOf('Assets') < 0, 'Beim Start laden: Wallet, Orders, Skills … (Assets nur wenn angehakt): ' + done.join(', '));
    assert(CALLS.slice(before).some(u => /\/wallet\//.test(u)), 'Wallet wurde wirklich abgefragt');
    assert(d.querySelectorAll('#al-items [data-al]').length === 9 && $('al-on').checked, 'Einstellungen: Liste der Bereiche zum Anhaken');
    w.close();
    // Mehrere Charaktere beobachten
    const C2 = CHARS.concat([{ access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Selia' }]);
    w = makeWindow({ 'eve-zentrale-characters': JSON.stringify(C2), 'eve-zentrale-gangalarm-v1': JSON.stringify({ on: true, jumps: 1, min: 1, chars: ['111', '222'], popSecs: 0, friends: false }) }, host); await tick(900);
    T = w.__test; await T.gaUpdateNear(true); await tick(200);
    const n3 = T.gaState().near;
    assert(n3[2] === 0 && n3[5] === 0 && n3[4] === 1 && n3[1] === 1 && T.gaState().nearBy[5] === '222' && T.gaState().nearBy[1] === '111', 'Zwei Charaktere: Umkreis um beide Standorte zusammen');
    await T.gaOnKill(kill(50, 4, 2));
    await T.gaOnKill(kill(51, 5, 3));
    const b3 = w.document.createElement('div'); T.ovRenderViewInto('alarm', b3);
    assert(/Echo[\s\S]*In deinem System[\s\S]*Selia[\s\S]*Dein Charakter/.test(b3.textContent) && !/Delta/.test(b3.textContent), 'Alarm nennt den Charakter, M6: nur die aktuelle Meldung (Delta steht im Gang-Report): ' + b3.textContent);
    assert(/Taron Velkar \(Bravo\), Selia \(Echo\)/.test(b3.textContent), 'Kopf: beide Charaktere mit System');
    // K10: Charakterauswahl im Overlay – Selia abwaehlen → nur noch Umkreis um Taron
    // L8: Auswahl erst nach Klick auf den Mini-Knopf sichtbar
    assert(b3.querySelector('.ga-ch-tog[data-ova="gaChTog"]') && !b3.querySelector('[data-ova="gaChar"]'), 'L8: nur Mini-Knopf, Auswahl zugeklappt');
    T.ovSatAction('alarm', { type: 'gaChTog' }); b3.innerHTML = ''; T.ovRenderViewInto('alarm', b3);
    assert([...b3.querySelectorAll('[data-ova="gaChar"]')].map(b => b.getAttribute('aria-pressed')).join() === 'true,true', 'K10: beide Charaktere als Knöpfe im Overlay');
    T.ovSatAction('alarm', { type: 'gaChar', arg: '222' }); await tick(300);
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-gangalarm-v1')).chars.join() === '111' && T.gaState().near[5] === undefined && !w.document.querySelector('[data-ga-char="222"]').checked, 'K10: abgewählt → gespeichert, Umkreis nur um Taron, Haken im Hauptfenster weg');
    T.ovSatAction('alarm', { type: 'gaChar', arg: '222' }); await tick(300);
    // A4: zKillboard-Link je Kampf im Gang-Report (Kampfseite /related/<System>/<JJJJMMTTHH>00/)
    const b4 = w.document.createElement('div'); T.ovRenderViewInto('gangreport', b4);
    const zk = [...b4.querySelectorAll('a.gr-zk')].map(a => a.getAttribute('href'));
    assert(zk.length === 2 && zk.every(u => /^https:\/\/zkillboard\.com\/related\/[45]\/\d{10}00\/$/.test(u)) && zk.every(u => b4.querySelector('a[href="' + u + '"]').target === '_blank'), 'Gang-Report: „zKillboard öffnen“ je Kampf: ' + zk.join(' '));
    const gl = w.document.getElementById('ga-list'), key = gl.querySelector('.gr-e').getAttribute('data-arg');
    gl.querySelector('a.gr-zk').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert(!gl.querySelector('.gr-e.open'), 'Klick auf den Link klappt den Eintrag nicht auf');
    gl.querySelector('.gr-e .grx-sys').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert(gl.querySelector('.gr-e.open[data-arg="' + key + '"]'), 'Klick daneben klappt weiter auf');
    const saved = w.localStorage.getItem('eve-zentrale-gangreport-v1');
    w.close();
    w = makeWindow({ 'eve-zentrale-gangreport-v1': saved }); await tick(600);
    assert(w.document.querySelectorAll('#ga-list .gr-e').length === 2, 'Gang-Report-Liste ist gleich nach dem Start gefüllt');
    w.close();
    // AA8: Kill auf meiner Route (Echo, 3 Sprünge = außerhalb Umkreis 2) meldet trotzdem – als Gank auf der Route
    w = makeWindow({ 'eve-zentrale-gangalarm-v1': JSON.stringify({ on: true, jumps: 2, min: 3, desk: true, friends: false }), 'eve-zentrale-esiroute-v1': JSON.stringify({ last: { route: [2, 3, 4, 5], pos: 1 } }) }, host); await tick(600);
    T = w.__test;
    assert(await T.gaOnKill(kill(41, 5, 6)), 'AA8: Kill in Echo (auf der Route, außerhalb Umkreis) löst Alarm aus');
    const ra = T.gaState().alarms.filter(a => a.sys === 5)[0];
    assert(ra && ra.rt === 2 && /^⚠ Gank auf deiner Route \(2 Spr\. voraus\)/.test(H.note), 'AA8: Meldung „Gank auf deiner Route“, 2 Sprünge voraus: ' + H.note);
    const rab = w.document.createElement('div'); T.ovRenderViewInto('alarm', rab);
    assert(/⚠ Gank auf deiner Route – 2 Sprünge voraus/.test(rab.textContent), 'AA8: Alarm-Fenster zeigt „Gank auf deiner Route“');
    assert(/⚠ auf Route/.test(w.document.getElementById('ga-list').textContent), 'AA8: Gang-Report markiert „auf Route“');
    w.close();
    // Jukebox: beim Start weiterspielen
    w = makeWindow({ 'eve-zentrale-jukebox-v1': JSON.stringify({ streams: [{ name: 'A', url: 'https://a.example/1' }, { name: 'B', url: 'https://b.example/2' }], url: 'https://b.example/2', idx: 1, autoplay: true, vol: 0.5 }) }); await tick(2000);
    T = w.__test;
    const a = w.document.querySelector('audio') || null;
    assert(T.jbxLoad().url === 'https://b.example/2' && w.document.getElementById('jb-title').textContent === 'B', 'Jukebox spielt beim Start den zuletzt gehörten Titel weiter');
    assert(w.document.getElementById('jb-autoplay').checked, 'Abschaltbar (Haken „Beim Start weiterspielen“)');
    w.close();
    w = makeWindow({ 'eve-zentrale-jukebox-v1': JSON.stringify({ streams: [{ name: 'A', url: 'https://a.example/1' }], url: 'https://a.example/1', autoplay: false }) }); await tick(2000);
    assert(/nichts ausgewählt/.test(w.document.getElementById('jb-title').textContent), 'Ohne Haken startet nichts von selbst');
    console.log('\nALL GANG ALARM / MAP / AUTOLOAD TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
