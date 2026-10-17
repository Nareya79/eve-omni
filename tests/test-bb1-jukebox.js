// BB1 (27.09.2026): Soundtrack vorn mit Cover (Jukebox, Overlay, Miniplayer), Streaming zugeklappt mit Spotify/Deezer/Apple Music
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){
    w.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function(){};
    w.HTMLMediaElement.prototype.load = function(){};
    w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-jukebox-v1', JSON.stringify({ autoplay: false }));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    T.jbxHostSet({ dirs: ['C:\\M'], files: [{ name: 'Mein Lied.mp3', url: 'file:///M/lied.mp3', cover: 'file:///M/lied.jpg' }, { name: 'Ohne.mp3', url: 'file:///M/o.mp3' }],
      ost: { album: 'EVE Omni Soundtrack', artist: 'Nareya79', tracks: [{ title: 'Warpdrive', url: 'file:///app/soundtrack/w.mp3', sec: 234, cover: 'file:///app/soundtrack/w.jpg' }, { title: 'Static Bloom', url: 'file:///app/soundtrack/s.mp3', sec: 189, cover: 'file:///app/soundtrack/s.jpg' }] } });
    // Soundtrack vorn: Liste steht vor Ordnern/Radio/Streaming, ist Standard
    const pos = id => [...d.querySelectorAll('#panel-music *')].indexOf($(id));
    assert(pos('jb-list') < pos('jb-pick-dir') && pos('jb-pick-dir') < pos('jb-st-box'), 'Titelliste oben, Ordner/Radio darunter, Streaming ganz unten');
    assert($('jb-list-sel').value === 'ost' && T.jbxTracks()[0].title === 'Warpdrive', 'Standardliste = EVE Omni Soundtrack');
    assert($('jb-cover').hidden, 'ohne Titel kein Cover');
    T.jbxPlay(0);
    assert(!$('jb-cover').hidden && $('jb-cover').getAttribute('src') === 'file:///app/soundtrack/w.jpg' && /EVE Omni Soundtrack · Nareya79/.test($('jb-album').textContent), 'Jukebox: Cover + Album/Künstler zum Titel');
    let b = d.createElement('div'); T.ovRenderMusic(b);
    assert(b.querySelector('.ov-card img.ov-jbc').getAttribute('src') === 'file:///app/soundtrack/w.jpg', 'Overlay/Miniplayer: Cover in der Karte');
    T.jbxCommand('list:');
    const i = T.jbxTracks().findIndex(t => t.title === 'Ohne'); T.jbxPlay(i);
    assert($('jb-cover').hidden && $('jb-album').textContent === '', 'Datei ohne Bild: kein Cover');
    T.jbxPlay(T.jbxTracks().findIndex(t => t.title === 'Mein Lied'));
    assert($('jb-cover').getAttribute('src') === 'file:///M/lied.jpg', 'eigene Musik: Bild mit gleichem Namen = Cover');
    // 04.10.2026: entfernter Soundtrack-Titel in alten Favoriten/Playlists/letztem Titel – wird übersprungen, kein Fehler
    const old = 'file:///app/soundtrack/' + 'Nareya79 - S' + 'unbreak.mp3', jd = T.jbxLoad();
    jd.favs = [old, 'file:///app/soundtrack/w.mp3']; jd.lists = [{ name: 'Alt', urls: [old] }]; jd.list = 'fav'; w.localStorage.setItem('eve-zentrale-jukebox-v1', JSON.stringify(jd));
    assert(T.jbxTracks().map(t => t.title).join() === 'Warpdrive', 'Favoriten: entfernter Titel übersprungen');
    T.jbxCommand('list:p0'); assert(T.jbxTracks().length === 0, 'Playlist nur mit entferntem Titel: leer, kein Fehler');
    T.jbxCommand('list:');
    // Streaming: zugeklappt, erst beim Aufklappen ein Player
    assert(!$('jb-st-box').open && !d.querySelector('#jb-sp-frame iframe'), 'Streaming zugeklappt, nichts geladen');
    $('jb-st-box').open = true; $('jb-st-box').dispatchEvent(new w.Event('toggle'));
    assert(/embed\/album\/2BG5/.test(d.querySelector('#jb-sp-frame iframe').src) && T.jbxLoad().stOpen === true, 'Aufklappen merkt sich den Zustand und lädt Spotify');
    assert([...$('jb-st-tabs').children].map(x => x.textContent).join(',') === 'Spotify,Deezer,Apple Music', 'Reiter Spotify · Deezer · Apple Music');
    $('jb-st-tabs').children[2].onclick();
    assert(d.querySelector('#jb-sp-frame iframe').src === 'https://embed.music.apple.com/de/album/music-from-eve-online/1846911943' && $('jb-sp-presets').children.length === 1, 'Apple Music: offizielles EVE-Album');
    $('jb-st-tabs').children[1].onclick();
    assert(!d.querySelector('#jb-sp-frame iframe') && $('jb-sp-presets').children.length === 0 && /Deezer/.test($('jb-sp-url-l').textContent), 'Deezer: nur eigene Links');
    $('jb-sp-url').value = 'https://www.deezer.com/de/playlist/1234567'; $('jb-sp-add').onclick();
    assert(d.querySelector('#jb-sp-frame iframe').src === 'https://widget.deezer.com/widget/dark/playlist/1234567' && $('jb-sp-presets').children.length === 1, 'Deezer-Link gemerkt und angezeigt');
    assert(T.jbSpEmbed('https://music.apple.com/de/playlist/chill/pl.u-abc123XYZ?l=en') === 'https://embed.music.apple.com/de/playlist/chill/pl.u-abc123XYZ' && T.jbSpEmbed('https://deezer.com/track/99') === 'https://widget.deezer.com/widget/dark/track/99' && T.jbSpEmbed('https://evil.example/album/1') === null && T.jbSpEmbed('https://music.apple.com.evil.example/de/album/x/1') === null, 'Links erkannt, fremde nicht');
    $('jb-st-tabs').children[0].onclick();
    assert($('jb-sp-presets').children.length === 3, 'Spotify-Reiter zeigt keine Deezer-Links');
    // Overlay: Streaming-Zeile zu/auf, Dienst öffnet die große Ansicht
    b = d.createElement('div'); T.ovRenderMusic(b);
    assert(/▸ Streaming/.test(b.querySelector('.ov-jbst').textContent) && !b.querySelector('.ov-jbst button'), 'Overlay: Streaming zugeklappt');
    T.jbxCommand('stov'); b = d.createElement('div'); T.ovRenderMusic(b);
    assert(b.querySelectorAll('.ov-jbst button[data-jb^="st:"]:not([data-jb="st:off"])').length === 3, 'Overlay: aufgeklappt drei Dienste (+ Aus, MM2)');
    $('jb-st-box').open = false; $('jb-st-box').dispatchEvent(new w.Event('toggle'));
    T.jbxCommand('st:dz');
    assert($('panel-music').classList.contains('active') && $('jb-st-box').open && T.jbxLoad().stSvc === 'dz' && /deezer/.test(d.querySelector('#jb-sp-frame iframe').src), 'Overlay-Knopf öffnet Jukebox mit Deezer');
    console.log('\nALL BB1 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
