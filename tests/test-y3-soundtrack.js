// Y3 (27.09.2026): EVECore Soundtrack wird mitgeliefert und erscheint als feste Playlist (Hauptfenster + Overlay)
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
    T.jbxHostSet({ dirs: ['C:\M'], files: [{ name: 'Mein Lied.mp3', url: 'file:///M/lied.mp3' }],
      ost: { album: 'EVECore Soundtrack', artist: 'Nareya79', tracks: [{ title: 'Radio Silence', url: 'file:///app/soundtrack/rs.mp3', sec: 217 }, { title: 'Echo Sun', url: 'file:///app/soundtrack/es.mp3', sec: 268 }] } });
    const opts = [...$('jb-list-sel').options].map(o => o.value + '=' + o.textContent);
    assert(opts[1] === 'ost=♪ EVECore Soundtrack (2)', 'Hauptfenster: feste Playlist „EVECore Soundtrack“: ' + opts.join(' | '));
    assert(T.jbxTracks().length === 2 && $('jb-list-sel').value === 'ost', 'BB1: ohne Wahl spielt der Soundtrack');
    T.jbxCommand('list:');
    assert(T.jbxTracks().length === 3, 'Alle Titel = Soundtrack + eigene Musik');
    T.jbxCommand('list:ost');
    assert(T.jbxTracks().map(t => t.title).join(',') === 'Radio Silence,Echo Sun', 'Playlist spielt in der Reihenfolge aus soundtrack.json');
    assert($('jb-list').rows[0].cells[3].textContent === '3:37', 'Dauer aus soundtrack.json');
    const b = d.createElement('div'); T.ovRenderMusic(b);
    assert(b.querySelector('select.ov-jbsel option[value="ost"][selected]') && /EVECore Soundtrack/.test(b.querySelector('option[value="ost"]').textContent), 'Overlay: Soundtrack in der Playlist-Auswahl');
    T.jbxHostSet({ dirs: [], files: [], ost: null });
    assert(T.jbxTracks().length === 0 && ![...$('jb-list-sel').options].some(o => o.value === 'ost'), 'ohne mitgelieferten Ordner keine Soundtrack-Liste');
    console.log('\nALL Y3 SOUNDTRACK TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
