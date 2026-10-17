// JB (09.10.2026): Jukebox aufmotzen – Lautstärke angleichen, Equalizer, Alarm leiser, Suche, Ziehen, Playlist im Overlay löschen, Schalter.
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
    w.fetch = () => Promise.reject(new Error('offline'));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // JB1a: Lautheit messen – Sinus mit Spitze a hat RMS a/√2, Ziel 0,2
    const sine = (amp, n) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 7));
    assert(Math.abs(T.jbxGainCalc([sine(0.2 * Math.SQRT2, 48000)], 48000) - 1) < 0.03, 'Angleichen: Titel in Ziellautstärke bleibt bei Faktor 1');
    assert(T.jbxGainCalc([sine(0.9, 48000)], 48000) < 0.35, 'Angleichen: lauter Titel wird leiser');
    assert(T.jbxGainCalc([sine(0.02, 48000)], 48000) === 3, 'Angleichen: sehr leiser Titel höchstens ×3');
    assert(T.jbxGainCalc([new Float32Array(48000)], 48000) === 1, 'Angleichen: Stille zählt nicht (Faktor 1)');
    const half = new Float32Array(115200); half.set(sine(0.2 * Math.SQRT2, 57600));   // 3 Messstücke Ton, 3 Stille
    assert(Math.abs(T.jbxGainCalc([half], 48000) - 1) < 0.03, 'Angleichen: stille Stellen verfälschen die Messung nicht');
    // JB9: Equalizer
    assert(T.jbxEqVals({}).join() === '0,0,0' && T.jbxEqVals({ eq: { on: false, p: 'bass' } }).join() === '0,0,0', 'EQ aus = flach');
    assert(T.jbxEqVals({ eq: { on: true, p: 'bass' } }).join() === '6,0,-1' && T.jbxEqVals({ eq: { on: true, p: 'eigen', b: 3, m: -2, h: 4 } }).join() === '3,-2,4', 'EQ: Vorlage und eigene Regler');
    // Schalter: fehlt = an, Klick = aus, nochmal = an; Seite zeigt den Stand
    assert($('jb-fx-norm').checked && $('jb-fx-toast').checked && !$('jb-fx-eq').checked, 'Standard: Angleichen + Einblendung an, Equalizer aus');
    T.jbxCommand('fx:toast'); assert(T.jbxLoad().toast === false && !$('jb-fx-toast').checked, 'Einblendung ausschaltbar');
    T.jbxCommand('fx:toast'); assert(T.jbxLoad().toast === true && $('jb-fx-toast').checked, 'Einblendung wieder an');
    T.jbxCommand('fx:eq'); assert(T.jbxLoad().eq.on && $('jb-fx-eq').checked && $('jb-eq-p').value === 'bass' && $('jb-eq-b').value === '6', 'Equalizer an mit „Mehr Bass“');
    T.jbxCommand('eq:klar'); assert(T.jbxLoad().eq.p === 'klar' && $('jb-eq-h').value === '5', 'EQ-Vorlage wechseln');
    // Titel + Suche
    T.jbxSetFiles([{ name: 'Akat Rainforest.mp3', url: 'file:///m/a.mp3' }, { name: 'Below the Asteroids.mp3', url: 'file:///m/b.mp3' }, { name: 'Cold Space.mp3', url: 'file:///m/c.mp3' }], 'C:\\Musik');
    T.jbxCommand('list:'); T.jbxCommand('q:aster');
    assert($('jb-list').rows.length === 1 && /Below the Asteroids/.test($('jb-list').textContent), 'Suche filtert die Liste');
    T.jbxCommand('q:zzz'); assert(/Kein Titel passt/.test($('jb-list').textContent), 'Suche ohne Treffer: Hinweis');
    T.jbxCommand('q:');
    // Overlay: Suche, Klang-Zeile, Equalizer-Vorlagen
    let ov = d.createElement('div'); T.jbxCommand('q:cold'); T.ovRenderMusic(ov);
    assert(ov.querySelectorAll('.ov-jbl-r').length === 1 && ov.querySelector('.ov-jbq').value === 'cold', 'Overlay: Suche zeigt nur Treffer');
    T.jbxCommand('q:'); T.jbxCommand('fxov'); ov = d.createElement('div'); T.ovRenderMusic(ov);
    assert(ov.querySelector('[data-jb="fx:norm"]').getAttribute('aria-pressed') === 'true' && ov.querySelector('[data-jb="eq:klar"]').getAttribute('aria-pressed') === 'true', 'Overlay: Klang & Extras mit Schaltern und EQ-Vorlagen');
    // Playlist: Ziehen + im Overlay löschen
    const x = T.jbxLoad(); x.lists = [{ name: 'PvP', urls: ['file:///m/a.mp3', 'file:///m/b.mp3', 'file:///m/c.mp3'] }]; w.localStorage.setItem('eve-zentrale-jukebox-v1', JSON.stringify(x));
    T.jbxCommand('list:p0');
    assert($('jb-list').rows[0].draggable, 'Playlist-Zeilen lassen sich ziehen');
    T.jbxCommand('plmv:0:2'); assert(T.jbxLoad().lists[0].urls.join() === 'file:///m/b.mp3,file:///m/c.mp3,file:///m/a.mp3', 'Ziehen nach unten: erster Titel ans Ende');
    T.jbxCommand('plmv:2:0'); assert(T.jbxLoad().lists[0].urls.join() === 'file:///m/a.mp3,file:///m/b.mp3,file:///m/c.mp3', 'Ziehen nach oben');
    T.jbxCommand('pldel'); assert(T.jbxLoad().lists.length === 1, 'Löschen: erster Klick fragt nur');
    ov = d.createElement('div'); T.ovRenderMusic(ov); assert(/Wirklich/.test(ov.querySelector('[data-jb="pldel"]').textContent), 'Overlay zeigt „Wirklich löschen?“');
    T.jbxCommand('pldel'); assert(T.jbxLoad().lists.length === 0 && T.jbxLoad().list === '', 'Zweiter Klick löscht die Playlist');
    // JB2: Radio läuft → Alarm macht leiser, ausgeschaltet nicht
    const y = T.jbxLoad(); y.streams = [{ name: 'Radio', url: 'https://radio.example/s' }]; y.vol = 0.8; w.localStorage.setItem('eve-zentrale-jukebox-v1', JSON.stringify(y));
    T.jbxPlay(T.jbxTracks().length - 1); const a = T.getJbxAudio();
    assert(/radio\.example/.test(a.src) && !a.paused, 'Radio spielt über eigenes Audio');
    T.jbxDuck(1); assert(Math.abs(a.volume - 0.2) < 0.01, 'Alarm: Musik auf 25 %');
    await tick(1100); assert(Math.abs(a.volume - 0.8) < 0.01, 'danach wieder volle Lautstärke');
    T.jbxCommand('fx:duck'); T.jbxDuck(1); assert(Math.abs(a.volume - 0.8) < 0.01, 'ausgeschaltet: nicht leiser');
    T.jbxPlay(0); assert(T.getJbxAudio() !== a && a.paused && !a.getAttribute('src'), 'Wechsel zu Datei: Radio-Audio angehalten und geleert');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
