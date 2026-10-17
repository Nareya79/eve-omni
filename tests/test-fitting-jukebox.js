// Fittings aus den Assets (EFT-Text zum Import in EVE) und Jukebox (Musikordner/Dateien, Streams, Overlay-Steuerung, Tastenkuerzel).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const CHARS = [{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Taron Velkar' }];
// type_id -> [name, group]; group -> category
const TY = { 24698: ['Drake', 419], 2048: ['Damage Control II', 60], 1999: ['Ballistic Control System II', 367], 3841: ['Large Shield Extender II', 38],
  2281: ['Adaptive Invulnerability Field II', 77], 2410: ['Heavy Missile Launcher II', 510], 2629: ['Scourge Heavy Missile', 385], 31718: ['Medium Core Defense Field Extender I', 774],
  2488: ['Warrior II', 100], 28668: ['Nanite Repair Paste', 4], 34: ['Tritanium', 18], 670: ['Capsule', 29], 11399: ['Morphite', 18] };
const GRP = { 419: 6, 29: 6, 60: 7, 367: 7, 38: 7, 77: 7, 510: 7, 774: 7, 385: 8, 100: 18, 4: 4, 18: 4 };
const CAT = { 6: 'Ship', 7: 'Module', 8: 'Charge', 18: 'Drone', 4: 'Material' };
const ASSETS = [
  { item_id: 1, type_id: 24698, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', is_singleton: true, quantity: 1 },
  { item_id: 2, type_id: 2048, location_id: 1, location_type: 'item', location_flag: 'LoSlot0', is_singleton: true, quantity: 1 },
  { item_id: 3, type_id: 1999, location_id: 1, location_type: 'item', location_flag: 'LoSlot1', is_singleton: true, quantity: 1 },
  { item_id: 4, type_id: 3841, location_id: 1, location_type: 'item', location_flag: 'MedSlot0', is_singleton: true, quantity: 1 },
  { item_id: 5, type_id: 2281, location_id: 1, location_type: 'item', location_flag: 'MedSlot1', is_singleton: true, quantity: 1 },
  { item_id: 6, type_id: 2410, location_id: 1, location_type: 'item', location_flag: 'HiSlot0', is_singleton: true, quantity: 1 },
  { item_id: 7, type_id: 2629, location_id: 1, location_type: 'item', location_flag: 'HiSlot0', is_singleton: false, quantity: 40 },
  { item_id: 8, type_id: 2410, location_id: 1, location_type: 'item', location_flag: 'HiSlot1', is_singleton: true, quantity: 1 },
  { item_id: 9, type_id: 31718, location_id: 1, location_type: 'item', location_flag: 'RigSlot0', is_singleton: true, quantity: 1 },
  { item_id: 10, type_id: 2488, location_id: 1, location_type: 'item', location_flag: 'DroneBay', is_singleton: false, quantity: 3 },
  { item_id: 11, type_id: 2488, location_id: 1, location_type: 'item', location_flag: 'DroneBay', is_singleton: false, quantity: 2 },
  { item_id: 12, type_id: 28668, location_id: 1, location_type: 'item', location_flag: 'Cargo', is_singleton: false, quantity: 50 },
  { item_id: 13, type_id: 34, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', is_singleton: false, quantity: 1000 },
  { item_id: 14, type_id: 670, location_id: 60003760, location_type: 'station', location_flag: 'Hangar', is_singleton: true, quantity: 1 }
];
let POSTS = [];
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      w.localStorage.setItem('eve-zentrale-characters', JSON.stringify(CHARS));
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; this.dispatchEvent(new w.Event('pause')); };
      w.HTMLMediaElement.prototype.load = function(){};
      w.fetch = function(url, opts){
        const u = String(url); let m;
        if (opts && opts.method === 'POST') POSTS.push({ u, body: opts.body });
        const ok = d => Promise.resolve({ ok:true, status:200, headers:{ get:() => '1' }, json:() => Promise.resolve(JSON.parse(JSON.stringify(d))) });
        if (/\/characters\/111\/assets\/names\//.test(u)) return ok(JSON.parse(opts.body).map(id => ({ item_id: id, name: id === 1 ? 'Missile Drake' : 'None' })));
        if (/\/characters\/111\/assets\//.test(u)) return ok(ASSETS);
        if (/\/characters\/111\/location\//.test(u)) return ok({ solar_system_id: 30000144 });
        if (/\/route\/30000144\/30000142/.test(u)) return ok([30000144, 30000145, 30000142]);
        if ((m = u.match(/\/universe\/types\/(\d+)\//))) return ok({ name: TY[m[1]][0], group_id: TY[m[1]][1], volume: 1 });
        if ((m = u.match(/\/universe\/groups\/(\d+)\//))) return ok({ category_id: GRP[m[1]] });
        if ((m = u.match(/\/universe\/categories\/(\d+)\//))) return ok({ name: CAT[m[1]] });
        if ((m = u.match(/\/universe\/stations\/(\d+)\//))) return ok({ name: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant', system_id: 30000142 });
        return Promise.reject(new Error('offline ' + u));
      };
    } }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // ---------- Fittings ----------
    const ship = ASSETS[0], kids = ASSETS.filter(a => a.location_id === 1);
    const eft = await T.fitBuildEft(ship, kids, { 1: 'Missile Drake' });
    const want = ['[Drake, Missile Drake]', 'Damage Control II', 'Ballistic Control System II', '', 'Large Shield Extender II', 'Adaptive Invulnerability Field II', '',
      'Heavy Missile Launcher II, Scourge Heavy Missile', 'Heavy Missile Launcher II', '', 'Medium Core Defense Field Extender I', '', 'Warrior II x5', '', 'Nanite Repair Paste x50'].join('\n');
    assert(eft === want, 'EFT-Text: Low, Mid, High (mit Munition), Rigs, Drohnen, Fracht – so wie EVE ihn importiert\n' + eft);
    // Assets-Bereich: Schiffe-Liste mit Kopier-Knopf
    $('neo-btn-assets').onclick();
    d.querySelectorAll('.char-check input, #as-chars input').forEach(i => { i.checked = true; });
    await $('as-refresh').onclick(); await tick(400);
    assert(!$('as-ships-wrap').hidden && $('as-ships').rows.length === 1 && /\(1\)/.test($('as-ships-count').textContent), 'Assets: aufgebaute Schiffe werden gelistet (ohne Kapsel und Material)');
    const r0 = [...$('as-ships').rows].find(r => /Drake/.test(r.textContent));
    assert(/Missile Drake/.test(r0.textContent) && /Taron Velkar/.test(r0.textContent) && /Jita IV/.test(r0.textContent), 'Zeile: Schiff, eigener Name, Charakter, Ort');
    assert(POSTS.some(p => /assets\/names/.test(p.u)), 'Schiffsnamen über EVE abgefragt');
    // Q10: Assets wie das EVE-Fenster – Ort mit Spruengen vom aktuellen System (Perimeter → Jita: 2), Schiff mit Slots + Fit kopieren
    await tick(300);
    const lo = d.querySelector('#as-body .as-loc');
    assert(lo && /Jita IV/.test(lo.textContent) && /Tritanium/.test(lo.textContent) && /Drake/.test(lo.textContent) && /Missile Drake/.test(lo.textContent) && !/Warrior/.test(lo.textContent), 'Q10: Ort → Items, Schiffsinhalt nicht beim Ort');
    assert(lo.querySelector('.as-j').textContent === '2', 'Q10: Sprünge dorthin: ' + lo.querySelector('.as-j').textContent);
    assert(/m³/.test(lo.querySelector('.as-l .m').textContent), 'Q10: m³ je Ort');
    lo.querySelector('[data-ova="asShip"]').click(); await tick(50);
    const sl = d.querySelector('#as-body .as-sl');
    assert(sl && /High/.test(sl.textContent) && /Heavy Missile Launcher II ×2/.test(sl.textContent) && /Drohnen/.test(sl.textContent) && /Warrior II ×5/.test(sl.textContent) && /Fracht/.test(sl.textContent), 'Q10: Schiff aufgeklappt mit Slots: ' + (sl && sl.textContent));
    sl.querySelector('.as-fit').click(); await tick(50);
    assert(w.__clip === want, 'Q10: „Fit kopieren“ legt den EFT-Text in die Zwischenablage');
    w.__clip = '';
    const asCache = w.localStorage.getItem('eve-zentrale-listcache-v1');
    const w2 = makeWindow({ 'eve-zentrale-listcache-v1': asCache }); await tick(600);
    assert(/Tritanium/.test(w2.document.getElementById('as-body').textContent) && /Stand/.test(w2.document.getElementById('as-status').textContent), 'K11/K12: Assets nach Neustart sofort da');
    w2.close();
    await r0.querySelector('button').onclick(); await tick(100);
    assert(w.__clip === want, 'Knopf „Fitting kopieren“ legt den EFT-Text in die Zwischenablage');
    // ---------- Jukebox ----------
    $('neo-btn-music').onclick();
    assert($('panel-music').classList.contains('active'), 'OmniCom: Jukebox');
    assert(/Noch keine Musik/.test($('jb-list').textContent), 'Leer: Hinweis');
    assert(!$('jb-st-box').open && !d.querySelector('#jb-sp-frame iframe'), 'BB1: Streaming zugeklappt, kein Player geladen');
    $('jb-st-box').open = true; $('jb-st-box').dispatchEvent(new w.Event('toggle'));
    const fr = d.querySelector('#jb-sp-frame iframe');
    assert(fr && fr.src === 'https://open.spotify.com/embed/album/2BG5eWiHoAgzjALJAdWDFX?theme=0' && $('jb-sp-presets').children.length === 3, 'Spotify-Player mit offizieller EVE-Musik (3 Alben zur Auswahl)');
    assert(T.jbSpEmbed('https://open.spotify.com/intl-de/playlist/4aR2OU5QIkGV89D0XxONAh?si=abc') === 'https://open.spotify.com/embed/playlist/4aR2OU5QIkGV89D0XxONAh?theme=0' && T.jbSpEmbed('https://evil.example/album/x') === null, 'Spotify-Links werden erkannt, andere nicht');
    $('jb-sp-url').value = 'https://open.spotify.com/playlist/4aR2OU5QIkGV89D0XxONAh'; $('jb-sp-add').onclick();
    assert(/playlist\/4aR2OU5QIkGV89D0XxONAh/.test(d.querySelector('#jb-sp-frame iframe').src) && $('jb-sp-presets').children.length === 4 && JSON.parse(w.localStorage.getItem('eve-zentrale-jukebox-v1')).spLast.indexOf('4aR2') > 0, 'Eigener Spotify-Link gemerkt und angezeigt');
    T.jbxSetFiles([{ name: 'Below the Asteroids.mp3', url: 'file:///m/b.mp3' }, { name: 'Akat_Rainforest.ogg', url: 'file:///m/a.ogg' }], 'C:\\Musik\\EVE');
    assert($('jb-list').rows.length === 2 && /Akat Rainforest/.test($('jb-list').rows[0].textContent) && /2 Titel aus C:\\Musik\\EVE/.test($('jb-status').textContent), 'Ordner eingelesen, sortiert, Dateiendung weg');
    $('jb-s-url').value = 'ftp://quatsch'; $('jb-s-add').onclick();
    assert(/http/.test($('jb-status').textContent) && T.jbxTracks().length === 2, 'Stream-Adresse wird geprüft');
    $('jb-s-name').value = 'EVE Radio'; $('jb-s-url').value = 'https://radio.example/stream'; $('jb-s-add').onclick();
    assert(T.jbxTracks().length === 3 && JSON.parse(w.localStorage.getItem('eve-zentrale-jukebox-v1')).streams[0].name === 'EVE Radio', 'Stream gespeichert (Speicher-Schlüssel eve-zentrale-jukebox-v1)');
    $('jb-play').onclick(); await tick(50);
    assert(T.getJbxIdx() === 0 && T.getJbxAudio().src === 'file:///m/a.ogg' && /Akat Rainforest/.test($('jb-title').textContent), 'Abspielen startet ersten Titel');
    $('jb-next').onclick();
    assert(T.getJbxIdx() === 1 && /Below the Asteroids/.test($('jb-title').textContent), 'Weiter');
    T.getJbxAudio().dispatchEvent(new w.Event('ended'));
    assert(T.getJbxIdx() === 2 && T.getJbxAudio().src === 'https://radio.example/stream', 'Titelende: nächster (Stream)');
    T.getJbxAudio().dispatchEvent(new w.Event('ended'));
    assert(T.getJbxIdx() === 0, 'Wiederholen: nach dem letzten wieder von vorn');
    $('jb-prev').onclick();
    assert(T.getJbxIdx() === 2, 'Zurück');
    $('jb-vol').value = '0.3'; $('jb-vol').oninput();
    assert(Math.abs(T.getJbxAudio().volume - 0.3) < 1e-6, 'Lautstärke');
    // Overlay + Einzelfenster-Knöpfe
    T.ovSetMode('compact'); await tick(100);
    const s = T.ovLoad(); s.views.forEach(v => { if (v.id === 'musik') v.on = true; }); s.view = 'musik'; T.ovSave(s); T.ovRender();
    assert(/EVE Radio/.test($('ov-body').textContent) && d.querySelectorAll('#ov-body .ov-jb [data-jb]').length === 6, 'Overlay „Jukebox“ mit Titel und Knöpfen (Zufall, Zurück, Play, Weiter, Wiederholen, Autostart)');
    const rowsO = d.querySelectorAll('#ov-body .ov-jbl-r');
    assert(rowsO.length === 3 && /Akat Rainforest/.test(rowsO[0].textContent) && rowsO[2].classList.contains('on') && /Radio/.test(rowsO[2].textContent), 'Overlay zeigt die ganze Playlist, laufender Titel markiert');
    rowsO[1].click();
    assert(T.getJbxIdx() === 1 && d.querySelectorAll('#ov-body .ov-jbl-r')[1].classList.contains('on'), 'Klick auf einen Titel im Overlay spielt ihn');
    d.querySelector('#ov-body [data-jb="shuffle"]').click();
    assert(T.jbxLoad().shuffle === true && d.querySelector('#ov-body [data-jb="shuffle"]').getAttribute('aria-pressed') === 'true', 'Zufallswiedergabe im Overlay an');
    const seen = new Set([T.getJbxIdx()]); T.jbxCommand('next'); seen.add(T.getJbxIdx()); T.jbxCommand('next'); seen.add(T.getJbxIdx());
    assert(seen.size === 3, 'Zufall spielt erst alle Titel, bevor sich einer wiederholt');
    T.jbxCommand('shuffle');
    const vol = d.querySelector('#ov-body input[data-jb-vol]');
    assert(vol && vol.type === 'range' && Math.abs(Number(vol.value) - 0.3) < 0.021, 'Lautstärke als Schieberegler im Overlay');
    vol.value = '0.8'; vol.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert(Math.abs(T.getJbxAudio().volume - 0.8) < 1e-6 && Math.abs(Number($('jb-vol').value) - 0.8) < 1e-6 && /80 %/.test(d.querySelector('#ov-body .ov-vol em').textContent), 'Regler ändert die Lautstärke sofort (auch in der großen Ansicht)');
    T.ovSatAction('musik', { type: 'jb', cmd: 'vol:0.25' });
    assert(Math.abs(T.getJbxAudio().volume - 0.25) < 1e-6, 'Regler im Einzelfenster wirkt im Hauptfenster');
    T.jbxPlay(2);
    d.querySelector('#ov-body [data-jb="toggle"]').click();
    assert(T.getJbxAudio().paused === true, 'Overlay-Knopf: Pause');
    T.ovSatAction('musik', { type: 'jb', cmd: 'next' });
    assert(T.getJbxIdx() === 0, 'Einzelfenster-Knopf wird im Hauptfenster ausgeführt');
    T.onHostCommand({ type: 'music', cmd: 'toggle' });
    assert(T.getJbxAudio().paused === true && T.getJbxIdx() === 0, 'Tastenkürzel vom Programm steuert die Jukebox');
    // Tastenkürzel-Liste (Programm)
    assert(T.hsAccelFromEvent({ code: 'MediaPlayPause', key: 'MediaPlayPause' }) === 'MediaPlayPause' && T.hsAccelText('MediaNextTrack') === 'Medientaste Weiter', 'Medientasten als Kürzel wählbar');
    assert(T.hsAccelFromEvent({ code: 'KeyL', key: 'l', ctrlKey: true, shiftKey: true }) === 'CommandOrControl+Shift+L', 'Local-Kürzel Strg+Umschalt+L');
    console.log('\nALL FITTING / JUKEBOX TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
