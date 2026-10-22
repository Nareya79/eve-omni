// F1: Jukebox-Favoriten und eigene Playlists (anlegen, fuellen, abspielen, im Overlay umschalten, loeschen).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; this.dispatchEvent(new w.Event('pause')); };
    w.HTMLMediaElement.prototype.load = function(){};
    w.confirm = () => true;
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const store = () => JSON.parse(w.localStorage.getItem('eve-zentrale-jukebox-v1'));
    const btn = (row, label) => [...$('jb-list').rows[row].querySelectorAll('button')].find(b => b.textContent === label);
    $('neo-btn-music').onclick();
    T.jbxSetFiles([{ name: 'Alpha.mp3', url: 'file:///m/a.mp3' }, { name: 'Beta.mp3', url: 'file:///m/b.mp3' }, { name: 'Gamma.mp3', url: 'file:///m/c.mp3' }], 'C:\\M');
    assert($('jb-list-sel').options.length === 2 && $('jb-pl-target-f').hidden && $('jb-pl-del').hidden, 'Start: „Alle Titel“ und „Favoriten“, noch keine Playlist');
    // Favoriten
    btn(2, '☆').click(); btn(0, '☆').click();
    assert(store().favs.join() === 'file:///m/c.mp3,file:///m/a.mp3' && btn(0, '★'), 'Stern merkt Favoriten');
    $('jb-list-sel').value = 'fav'; $('jb-list-sel').onchange();
    assert(T.jbxTracks().map(x => x.title).join() === 'Gamma,Alpha' && $('jb-list').rows.length === 2, 'Favoriten-Liste spielt nur die Favoriten');
    $('jb-play').onclick();
    assert(/Gamma/.test($('jb-title').textContent), 'Abspielen aus den Favoriten');
    // Playlist anlegen und fuellen
    $('jb-list-sel').value = ''; $('jb-list-sel').onchange();
    assert(T.getJbxIdx() === 2, 'Listenwechsel: laufender Titel wird in der neuen Liste wiedergefunden');
    $('jb-pl-name').value = 'PvP'; $('jb-pl-add').onclick();
    assert(store().lists[0].name === 'PvP' && !$('jb-pl-target-f').hidden && $('jb-list-sel').options.length === 3, 'Playlist „PvP“ angelegt');
    $('jb-pl-name').value = 'pvp'; $('jb-pl-add').onclick();
    assert(/gibt es schon/.test($('jb-status').textContent) && store().lists.length === 1, 'Doppelter Name abgelehnt');
    btn(1, '＋').click(); btn(0, '＋').click();
    assert(store().lists[0].urls.join() === 'file:///m/b.mp3,file:///m/a.mp3' && btn(1, '✓') && !btn(1, '✓').disabled, '＋ fügt zur Playlist hinzu (Reihenfolge wie hinzugefügt)');
    btn(0, '✓').click();
    assert(store().lists[0].urls.join() === 'file:///m/b.mp3' && btn(0, '＋'), 'X5: ✓ nimmt wieder heraus');
    btn(0, '＋').click();
    $('jb-list-sel').value = 'p0'; $('jb-list-sel').onchange();
    assert(T.jbxTracks().map(x => x.title).join() === 'Beta,Alpha' && !$('jb-pl-del').hidden && T.getJbxIdx() === -1, 'Playlist gewählt');
    assert(!btn(0, '▲') && !$('jb-pl-renb').hidden, 'X5: erster Titel ohne ▲, Umbenennen sichtbar');
    btn(1, '▲').click();
    assert(store().lists[0].urls.join() === 'file:///m/a.mp3,file:///m/b.mp3' && T.jbxTracks()[0].title === 'Alpha', 'X5: ▲ schiebt eine Stelle hoch');
    $('jb-pl-renb').onclick();
    assert(!$('jb-pl-ren-f').hidden && $('jb-pl-ren').value === 'PvP', 'X5: Umbenennen zeigt Feld mit altem Namen');
    $('jb-pl-ren').value = 'Kampf'; $('jb-pl-ren').onkeydown({ key: 'Enter' });
    assert(store().lists[0].name === 'Kampf' && $('jb-pl-ren-f').hidden && /Kampf/.test($('jb-list-sel').selectedOptions[0].textContent), 'X5: Enter speichert neuen Namen');
    $('jb-pl-renb').onclick(); $('jb-pl-ren').value = 'PvP'; $('jb-pl-renb').onclick();
    assert(store().lists[0].name === 'PvP', 'X5: zweiter Klick speichert auch');
    btn(0, '−').click();
    assert(store().lists[0].urls.join() === 'file:///m/b.mp3' && $('jb-list').rows.length === 1, '− nimmt aus der Playlist');
    // Overlay
    T.ovSetMode('compact'); await tick(100);
    const s = T.ovLoad(); s.views.forEach(v => { if (v.id === 'musik') v.on = true; }); s.view = 'musik'; T.ovSave(s); T.ovRender();
    const chips = [...d.querySelectorAll('#ov-body .ov-jbp [data-jb]')];
    assert(chips.map(b => b.textContent).join('|') === 'Alle|★ Favoriten|PvP' && chips[2].getAttribute('aria-pressed') === 'true', 'Overlay: Leiste zum Umschalten, PvP aktiv');
    chips[1].click();
    assert(store().list === 'fav' && d.querySelectorAll('#ov-body .ov-jbl-r').length === 2 && $('jb-list-sel').value === 'fav', 'Overlay schaltet auf Favoriten (große Ansicht zieht mit)');
    d.querySelector('#ov-body .ov-jbl-r [data-jb="fav:1"]').click();
    assert(store().favs.join() === 'file:///m/c.mp3' && d.querySelectorAll('#ov-body .ov-jbl-r').length === 1, 'Stern im Overlay nimmt aus den Favoriten');
    T.ovSatAction('musik', { type: 'jb', cmd: 'list:p0' });
    assert(store().list === 'p0', 'Einzelfenster kann die Liste umschalten');
    T.ovRender();
    assert(d.querySelector('#ov-body .ov-jbl-r [data-jb="plrm:0"]') && !d.querySelector('#ov-body [data-jb="plup:0"]'), 'X5: Overlay zeigt − in der Playlist');
    T.ovSatAction('musik', { type: 'jb', cmd: 'plrm:0' });
    assert(store().lists[0].urls.length === 0, 'X5: − im Overlay nimmt aus der Playlist');
    // Loeschen
    await $('jb-pl-del').onclick();   // AT: Rückfrage ist jetzt asynchron
    assert(store().lists.length === 0 && store().list === '' && T.jbxTracks().length === 3, 'Playlist gelöscht, zurück auf alle Titel');
    console.log('\nALL PLAYLIST TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
