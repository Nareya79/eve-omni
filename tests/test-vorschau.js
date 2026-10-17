// Client-Vorschau Stufe 2 (Live-Kacheln in Einstellungen › EVE-Clients) und die Einstellungen fuer Stufe 3 (schwebende Fenster).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const S = { hotkeys:{}, backup:{}, fgHelper:'ok', eveClients:[{ hwnd:'11', name:'Taron Velkar' }, { hwnd:'22', name:'' }],
  cycle:{ on:false, fwd:{ vk:9, mods:0, label:'Tab' }, back:{ vk:9, mods:2, label:'Umschalt+Tab' }, skipLogin:true, order:[] }, preview:{ float:false, fps:10, width:280, pos:{} } };
const log = [];
const host = { isHost:true, version:'1.6.0', onCommand(){}, ready(){}, setMode(){},
  getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))),
  setSettings: p => { log.push(['set', p]); if (p.preview) Object.assign(S.preview, p.preview); return Promise.resolve(JSON.parse(JSON.stringify(S))); },
  previewPick: h => { log.push(['pick', h]); return Promise.resolve(true); },
  activateClient: h => { log.push(['act', h]); return Promise.resolve(true); } };
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.localStorage.setItem('eve-zentrale-settings-sub-v1', 'clients');
    w.fetch = () => Promise.reject(new Error('offline'));
    w.evecoreHost = host;
    const tracks = [];
    w.__tracks = tracks;
    Object.defineProperty(w.navigator, 'mediaDevices', { value: { getDisplayMedia: c => { log.push(['gdm', c.video.frameRate.max, c.video.width.max]); const t = { stopped: false, stop(){ this.stopped = true; } }; tracks.push(t); return Promise.resolve({ getTracks: () => [t] }); } } });
    Object.defineProperty(w.HTMLMediaElement.prototype, 'srcObject', { configurable: true, get(){ return this.__so || null; }, set(v){ this.__so = v; } });
  } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert($('pv-float') && !$('pv-float').checked && $('pv-fps').value === '10' && $('pv-size').value === '280', 'Einstellungen Vorschau: aus, 10 Bilder/s, 280 px');
    assert(d.querySelectorAll('#cy-pv .cy-tile').length === 0 && !log.some(x => x[0] === 'gdm'), 'Bereich nicht sichtbar gemeldet: keine Aufnahme');
    T.cyPvShow(true); await tick(100);
    const tiles = [...d.querySelectorAll('#cy-pv .cy-tile')];
    assert(tiles.length === 2 && tiles[0].querySelector('.cy-tn').textContent === 'Taron Velkar' && tiles[1].querySelector('.cy-tn').textContent === 'Charakterauswahl', 'Sichtbar: je Client eine Kachel (auch Charakterauswahl)');
    assert(log.filter(x => x[0] === 'pick').map(x => x[1]).join() === '11,22' && log.filter(x => x[0] === 'gdm').length === 2, 'Erst Fenster anmelden, dann Aufnahme – der Reihe nach');
    assert(tiles[0].querySelector('video').srcObject && tiles[0].querySelector('.cy-tm').textContent === '', 'Live-Bild hängt in der Kachel');
    tiles[0].click();
    assert(log.some(x => x[0] === 'act' && x[1] === '11'), 'Klick auf Kachel holt den Client nach vorne');
    // Client geht zu
    S.eveClients = [{ hwnd:'11', name:'Taron Velkar' }];
    $('cy-on').onchange.call({ checked: false }); await tick(100);
    assert(d.querySelectorAll('#cy-pv .cy-tile').length === 1 && w.__tracks[1].stopped, 'Geschlossener Client: Kachel weg, Aufnahme beendet');
    T.cyPvShow(false);
    assert(d.querySelectorAll('#cy-pv .cy-tile').length === 0 && w.__tracks[0].stopped, 'Bereich verlassen: alle Aufnahmen aus');
    // Stufe 3 Einstellungen
    $('pv-float').checked = true; $('pv-float').onchange.call($('pv-float'));
    $('pv-fps').value = '5'; $('pv-fps').onchange.call($('pv-fps'));
    $('pv-size').value = '360'; $('pv-size').onchange.call($('pv-size'));
    await tick(50);
    const sets = log.filter(x => x[0] === 'set' && x[1].preview).map(x => JSON.stringify(x[1].preview));
    assert(sets.join() === '{"float":true},{"fps":5},{"width":360}', 'Schwebende Fenster, Bildrate und Größe werden ans Programm gegeben: ' + sets.join(' '));
    T.cyPvShow(true); await tick(100);
    assert(log.filter(x => x[0] === 'gdm').pop()[1] === 5, 'Neue Kacheln nutzen die eingestellte Bildrate');
    // H5: 16:9-Ausschnitt, ganzes Bild, Rahmenfarbe
    assert($('pv-fit').value === 'crop' && $('cy-pv').classList.contains('crop') && $('pv-border').value === '#e0b84a', 'H5: Standard 16:9 aus der Mitte, goldener Rahmen');
    assert(/\.cy-pv\.crop \.cy-tile video\{object-fit:cover\}/.test(d.querySelector('style').textContent), 'H5: Kacheln schneiden zu statt Balken');
    assert(log.filter(x => x[0] === 'gdm').pop()[2] === 1400, 'H5: Ausschnitt nimmt breiter auf (schärfer)');
    $('pv-fit').value = 'full'; $('pv-fit').onchange.call($('pv-fit')); await tick(50);
    assert(!$('cy-pv').classList.contains('crop') && S.preview.fit === 'full', 'H5: „ganzes Bild“ umschaltbar');
    $('pv-border').value = '#00ff88'; $('pv-border').onchange.call($('pv-border')); await tick(50);
    assert(S.preview.border === '#00ff88' && $('pv-border').value === '#00ff88', 'H5: Rahmenfarbe wählbar');
    $('pv-border-def').onclick(); await tick(50);
    assert(S.preview.border === '#e0b84a', 'H5: Rahmen „Standard“');
    // I4: Darstellung Windows-Spiegelbild (Standard) oder Video (alte Version)
    assert($('pv-engine').value === 'dwm', 'I4: Standard ist das Windows-Spiegelbild');
    $('pv-engine').value = 'video'; $('pv-engine').onchange.call($('pv-engine')); await tick(50);
    assert(S.preview.engine === 'video' && !$('pv-fps').disabled, 'I4: alte Video-Version wählbar, dann zählt die Bildrate');
    // O1: Name oben mittig, Farben aktiv/inaktiv waehlbar
    assert($('pv-name').checked && $('pv-name-act').value === '#e0b84a' && $('pv-name-idle').value === '#c8d2dc', 'O1: Name an, Standardfarben');
    $('pv-name-idle').value = '#112233'; $('pv-name-idle').onchange.call($('pv-name-idle')); await tick(50);
    assert(S.preview.nameIdle === '#112233', 'O1: Farbe inaktiv wählbar');
    $('pv-name').checked = false; $('pv-name').onchange.call($('pv-name')); await tick(50);
    assert(S.preview.nameOn === false, 'O1: Name abschaltbar');
    $('pv-name-def').onclick(); await tick(50);
    assert(S.preview.nameAct === '#e0b84a' && S.preview.nameIdle === '#c8d2dc', 'O1: Farben „Standard“');
    // O7: Stapel fuer nicht eingeloggte Clients, Beschriftung waehlbar
    assert($('pv-stack').checked && $('pv-stack-label').value === 'count', 'O7: Stapel an, Beschriftung „3 nicht eingeloggt“');
    $('pv-stack-label').value = 'select'; $('pv-stack-label').onchange.call($('pv-stack-label')); await tick(50);
    assert(S.preview.stackLabel === 'select', 'O7: Beschriftung „Charakterauswahl“ wählbar');
    $('pv-stack').checked = false; $('pv-stack').onchange.call($('pv-stack')); await tick(50);
    assert(S.preview.stack === false, 'O7: Stapel abschaltbar');
    console.log('\nALL VORSCHAU TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
