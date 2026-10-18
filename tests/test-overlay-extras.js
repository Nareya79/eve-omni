// Overlay-Extras 1.4.2: Spulbalken in der Jukebox, Titelnamen ohne Nummern, Alarmtöne, Suche starten aus dem Overlay (Hauling/Scanner),
// Hauling: Name + Menge kopieren (Detail-Optionen und Overlay), Login im Standard-Browser (Schalter).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra, host){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.__osc = [];
      w.AudioContext = function(){ this.currentTime = 0; this.state = 'running'; this.destination = {};
        this.createOscillator = () => { const o = { type: '', frequency: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){ w.__osc.push(o.type); }, stop(){} }; return o; };
        this.createGain = () => ({ gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }); };
      w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); Object.defineProperty(this, 'duration', { configurable: true, get: () => 200 }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; };
      try{ Object.defineProperty(w, 'crypto', { configurable: true, value: require('crypto').webcrypto }); }catch(e){}
      if (host) w.evecoreHost = host;
      w.fetch = () => Promise.reject(new Error('offline'));
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // Titel
    assert(T.jbxCleanTitle('EVE Online - Learning From The Past 62931281 - Fenris Creations.mp3') === 'EVE Online - Learning From The Past - Fenris Creations', 'Nummern aus den Titeln entfernt');
    assert(T.jbxCleanTitle('03 - Below the Asteroids.ogg') === 'Below the Asteroids' && T.jbxCleanTitle('Jita 4-4.mp3') === 'Jita 4-4', 'Tracknummern vorne weg, normale Zahlen bleiben');
    // Alarmtöne
    const opts = [...$('ga-tone').options].map(o => o.value);
    assert(opts.length === 7 && opts.indexOf('siren') >= 0 && opts.indexOf('gong') >= 0 && opts[6] === 'file', 'Sechs Alarmtöne + eigene Datei zur Auswahl: ' + opts.join(', '));
    $('ga-tone').value = 'siren'; $('ga-tone').onchange();
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-gangalarm-v1')).tone === 'siren' && w.__osc.filter(t => t === 'sawtooth').length === 3, 'Auswahl wird gespeichert und vorgespielt (Sirene)');
    w.__osc = []; T.gaTone('klaxon'); assert(w.__osc.length === 4 && w.__osc[0] === 'square', 'Alarmhupe klingt anders');
    // Jukebox-Overlay: Spulbalken
    T.jbxSetFiles([{ name: 'EVE Online - Contact 62931256 - Fenris Creations.mp3', url: 'file:///m/c.mp3' }], 'X');
    T.jbxPlay(0);
    T.ovSetMode('compact'); await tick(100);
    const s0 = T.ovLoad(); s0.views = s0.views.filter(v => v.id !== 'musik').concat([{ id: 'musik', on: true }]); s0.view = 'musik'; T.ovSave(s0); T.ovRender();
    assert(/EVE Online - Contact - Fenris Creations/.test($('ov-body').textContent), 'Overlay zeigt den Titel ohne Nummer');
    const seek = d.querySelector('#ov-body input[data-jb-seek]');
    assert(seek && seek.max === '1000', 'Spulbalken im Jukebox-Overlay');
    seek.value = '500'; seek.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(Math.abs(T.getJbxAudio().currentTime - 100) < 1, 'Spulen auf die Hälfte (100 von 200 s)');
    T.ovSatAction('musik', { type: 'jb', cmd: 'seek:0.25' });
    assert(Math.abs(T.getJbxAudio().currentTime - 50) < 1, 'Spulen aus dem Einzelfenster');
    // Hauling-Overlay: Suche starten + Kopieren
    T.setOvData({ haul: { t: Date.now(), origin: 'Jita IV', list: [{ stationId: 1, stationName: 'Amarr VIII', systemName: 'Amarr', jumps: 9, itemCount: 2, profit: 5e6,
      items: [{ name: 'Tritanium', q: 120000, p: 3e6 }, { name: 'Damage Control II', q: 12, p: 2e6 }] }] } });
    const s1 = T.ovLoad(); s1.views = s1.views.filter(v => v.id !== 'handel').concat([{ id: 'handel', on: true }]); s1.view = 'handel'; T.ovSave(s1); T.ovRender();
    // O2: eine Ansicht „Handel“, oben umschaltbar
    T.ovSatAction('handel', { type: 'kkd', arg: 'umkreis' }); await tick(30);   // KK6: Ziel „Alles im Umkreis“ statt Reiter
    assert(w.localStorage.getItem('eve-zentrale-handel-mode-v1') === 'haul' && $('ov-body').querySelector('[data-ova="mirrorRun"][data-arg="haul-run"]'), 'O2: Handel-Overlay auf „Im Umkreis“ umgeschaltet');
    const ob = $('ov-body');
    assert(ob.querySelector('[data-ova="mirrorRun"][data-arg="haul-run"]') && /Hauling-Suche starten/.test(ob.textContent), 'Hauling-Overlay: Knopf „Hauling-Suche starten“');
    // I11: Suchoptionen wie in der großen Ansicht, geänderte Werte gehen beim Start dorthin
    ob.querySelector('[data-ova="mirrorTog"]').click(); await tick(30);
    const bud = $('ov-body').querySelector('[data-ovf="hl-budget"]'), hub = $('ov-body').querySelector('select[data-ovf="kk-buy"]');   // KK6: gemeinsames „Einkaufen in“
    assert(bud && hub && hub.options.length === $('kk-buy').options.length && $('ov-body').querySelector('[data-ovf="hl-sellmode"]') && $('ov-body').querySelector('[data-ova="sb"]'), 'I11: Hauling-Overlay zeigt dieselben Suchfelder (KK: nur gültige, mit Schiff-Knöpfen)');
    let runs = 0; const oldRun = $('hl-search-btn').onclick; $('hl-search-btn').onclick = () => { runs++; };
    bud.value = '250000000'; hub.value = 'amarr';
    $('ov-body').querySelector('[data-ova="mirrorRun"]').click(); await tick(30);
    assert($('hl-budget').value.replace(/[^0-9]/g, '') === '250000000' && $('hl-hub').value === 'amarr' && runs === 1, 'I11: Werte übernommen und Suche gestartet');
    $('hl-search-btn').onclick = oldRun;
    const s9 = T.ovLoad(); s9.mirrorOpen = { 'haul-run': true }; T.ovSave(s9);   // 17.10.: Hauling + Hub-Handel teilen „Suchoptionen auf/zu“
    T.ovSatAction('handel', { type: 'kkd', arg: 'dodixie' }); await tick(30);   // KK6: Ziel-Hub statt Reiter
    assert(w.localStorage.getItem('eve-zentrale-handel-mode-v1') === 'hub' && $('is-budget').value === '250.000.000', 'O2: zurück auf „Zu festem Hub/Station“, Budget mitgenommen');
    const dcb = $('ov-body').querySelector('[data-ova="kkd"][data-arg="dodixie"][aria-pressed="true"]');   // KK6: Ziele als Knöpfe
    assert(dcb && $('ov-body').querySelector('[data-ova="sb"][data-arg^="is:"]') && /Beste Ladung berechnen/.test($('ov-body').textContent), 'I11: Hub-Handel-Overlay mit Zielen, Schiff und Start-Knopf');
    // Schiff im Overlay wählen → sofort übernommen, Laderaum im Overlay zeigt den neuen Wert
    $('ov-body').querySelector('[data-ova="sb"][data-arg="is:ship"]').click(); await tick(150);   // KK7: Schiffsliste nur bei „Bestimmtes Schiff“
    const osh = $('ov-body').querySelector('select[data-ovf="is-ship"]'), bopt = [...osh.options].find(o => /^Bustard/.test(o.textContent));
    assert(osh.hasAttribute('data-ov-now') && bopt, 'Schiffswahl im Overlay ist „sofort“-Feld');
    osh.value = bopt.value; osh.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(250);
    await tick(250);
    assert(w.__sbCargoEff('is') === 55000 && /55\.000 m³/.test($('ov-body').textContent), 'Bustard im Overlay → gerechnet mit 55.000 m³, auch im Overlay (KK8: als Wert; 5.0 #3: getippter Wert bleibt getrennt)');
    // offenes Klappmenü: Neuzeichnen wartet, danach nachgeholt
    const osh2 = $('ov-body').querySelector('select[data-ovf="is-ship"]');
    osh2.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true })); T.ovRender();
    assert($('ov-body').querySelector('select[data-ovf="is-ship"]') === osh2, 'offenes Klappmenü wird nicht weggezeichnet');
    osh2.dispatchEvent(new w.Event('focusout', { bubbles: true }));
    assert($('ov-body').querySelector('select[data-ovf="is-ship"]') !== osh2, 'nach dem Schließen wird neu gezeichnet');
    const oldIs = $('is-start').onclick; $('is-start').onclick = () => { runs++; };
    $('ov-body').querySelector('[data-ova="mirrorRun"]').click(); await tick(30);   // KK6: Ziel Dodixie ist über den Ziel-Knopf schon gesetzt
    assert(T.isDstKeys().indexOf('dodixie') >= 0 && runs === 2, 'I11: Ziel-Haken übernommen, Berechnung gestartet');
    // R6/KK6: Einkauf Jita -> im Overlay auf Amarr umstellen, dann Jita als Ziel waehlen geht sofort
    T.ovSatAction('handel', { type: 'mirrorSet', form: { 'kk-buy': 'jita' } }); T.ovRender(); await tick(30);
    let jcb = $('ov-body').querySelector('[data-ova="kkd"][data-arg="jita"]');
    assert(jcb && jcb.disabled, 'KK6: Einkaufs-Hub ist als Ziel gesperrt');
    T.ovSatAction('handel', { type: 'mirrorSet', form: { 'kk-buy': 'amarr' } }); T.ovRender(); await tick(30); jcb = $('ov-body').querySelector('[data-ova="kkd"][data-arg="jita"]'); assert(jcb && !jcb.disabled, 'R6: Jita nach Wechsel des Einkaufs frei'); jcb.click(); await tick(30);
    $('ov-body').querySelector('[data-ova="mirrorRun"]').click(); await tick(30);
    assert($('is-src').value === 'amarr' && T.isDstKeys().indexOf('jita') >= 0, 'R6: Einkauf Amarr, Verkauf Jita übernommen');
    $('is-start').onclick = oldIs;
    s1.view = 'handel'; T.ovSave(s1); T.ovRender(); T.ovSatAction('handel', { type: 'kkd', arg: 'umkreis' }); await tick(30);
    T.ovSatAction('handel', { type: 'haulSel', arg: '0' }); await tick(30);   // AB: Einkaufsliste erst nach dem Aufklappen
    const cps = [...ob.querySelectorAll('.ov-card:not(.ov-opt)')].map(c => (c.querySelector('[data-copy]') || { getAttribute(){ return ''; } }).getAttribute('data-copy'));
    assert(cps.join('|') === '120000|12', 'PQ1: Menge je Artikel kopierbar, Name ohne Kopier-Knopf: ' + cps.join('|'));
    const mb = [...ob.querySelectorAll('[data-copy]')].find(e => /Tritanium 120000/.test(e.getAttribute('data-copy')));
    assert(mb && mb.getAttribute('data-copy') === 'Tritanium 120000\nDamage Control II 12', 'Einkaufsliste für Multibuy (Name Menge je Zeile)');
    let clicked = 0; $('hl-search-btn').onclick = function(){ clicked++; };
    ob.querySelector('[data-ova="mirrorRun"]').click(); await tick(50);
    assert(clicked === 1, 'Klick im Overlay startet die Hauling-Suche der großen Ansicht');
    T.ovSatAction('hauling', { type: 'act', act: 'haul-run' }); await tick(50);
    assert(clicked === 2, 'Auch aus dem Einzelfenster');
    // Scanner-Overlay
    const s2 = T.ovLoad(); s2.views = s2.views.filter(v => v.id !== 'scanner').concat([{ id: 'scanner', on: true }]); s2.view = 'scanner'; T.ovSave(s2); T.ovRender();
    let sc = 0; $('tsc-start').onclick = function(){ sc++; };
    $('ov-body').querySelector('[data-ova="mirrorRun"][data-arg="scan-run"]').click(); await tick(50);
    assert(sc === 1, 'Scanner-Plan-Overlay: „Markt scannen“ startet den Scan');
    // Login im Browser
    assert($('sso-ext') && $('sso-ext').closest('.host-only'), 'Konto: Schalter „Anmeldung im Standard-Browser“ (nur im Programm)');
    w.close();
    const H = { ext: [] };
    w = makeWindow({ 'eve-zentrale-sso-ext-v1': '1', 'eve-zentrale-sso-client-id': 'abc123' }, { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: () => Promise.resolve({}), onCommand(){}, ready(){}, setMode(){}, publishView(){}, openExternal(u){ H.ext.push(u); } });
    await tick(600); d = w.document;
    d.getElementById('sso-client-id').value = 'abcdef0123456789abcdef0123456789';   // echte Form (32 Hex) – sonst bricht der Login jetzt mit Hinweis ab
    await d.getElementById('sso-login-btn').onclick(); await tick(200);
    assert(d.getElementById('sso-ext').checked && H.ext.length === 1 && /^https:\/\/login\.eveonline\.com\/v2\/oauth\/authorize\?/.test(H.ext[0]) && /Strg\+C/.test(d.getElementById('sso-status').textContent), 'Login öffnet die EVE-Anmeldung im Standard-Browser und erklärt den Rest');
    // T24: mehrere Musikordner – das Programm fuehrt die Liste, die Seite zeigt sie mit Entfernen-Knopf
    const MD = { dirs: ['C:/Musik/EVE'] };
    const mAll = () => Promise.resolve({ dirs: MD.dirs.slice(), files: MD.dirs.map((x, i) => ({ name: x.split('/').pop() + '/t' + i + '.mp3', url: 'file:///' + x + '/t' + i + '.mp3' })) });
    w = makeWindow({}, { getSettings: () => Promise.resolve({ windows: {}, hotkeys: {}, hotkeyStatus: {}, backup: {} }), setSettings: () => Promise.resolve({}),
      listMusic: mAll, pickMusicDir: () => { MD.dirs.push('D:/Soundtracks'); return mAll(); }, removeMusicDir: x => { MD.dirs = MD.dirs.filter(y => y !== x); return mAll(); } });
    await tick(600); d = w.document;
    assert(d.getElementById('jb-dir').children.length === 1 && /1 Titel aus C:\/Musik\/EVE/.test(d.getElementById('jb-status').textContent), 'T24: gespeicherter Ordner beim Start eingelesen');
    d.getElementById('jb-pick-dir').onclick(); await tick(50);
    assert(d.getElementById('jb-dir').children.length === 2 && /2 Titel aus 2 Ordnern/.test(d.getElementById('jb-status').textContent), 'T24: zweiter Ordner hinzugefügt, beide zusammen eingelesen');
    d.querySelector('#jb-dir button').click(); await tick(50);
    assert(MD.dirs.join() === 'D:/Soundtracks' && d.getElementById('jb-dir').textContent.indexOf('C:/Musik') < 0 && /1 Titel/.test(d.getElementById('jb-status').textContent), 'T24: Ordner entfernt');
    console.log('\nALL OVERLAY EXTRAS TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
