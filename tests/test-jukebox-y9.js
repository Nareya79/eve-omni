// Y9 (27.09.2026): Jukebox – Dauer je Titel + Gesamtzeit, Autostart-Knopf im Overlay, Laufschrift-Titel
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLMediaElement.prototype.play = function(){ this.__p = true; Object.defineProperty(this, 'paused', { configurable: true, get: () => !this.__p }); this.dispatchEvent(new w.Event('play')); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function(){ this.__p = false; this.dispatchEvent(new w.Event('pause')); };
    w.HTMLMediaElement.prototype.load = function(){};
    w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-jbdur-v1', JSON.stringify({ 'file:///m/a.mp3': 225, 'file:///m/b.mp3': 3500 }));
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    T.jbxSetFiles([{ name: 'Alpha.mp3', url: 'file:///m/a.mp3' }, { name: 'Beta.mp3', url: 'file:///m/b.mp3' }, { name: 'Gamma.mp3', url: 'file:///m/c.mp3' }], 'C:\\M');
    assert($('jb-list').rows[0].cells[3].textContent === '3:45' && $('jb-list').rows[2].cells[3].textContent === '–', 'Dauer je Titel, unbekannt = –');
    assert($('jb-total').textContent === 'Gesamt: 3 Titel · 1:02:05 (noch 1 ohne Dauer)', 'Gesamtzeit mit Stunden: ' + $('jb-total').textContent);
    const b = d.createElement('div'); T.ovRenderMusic(b);
    assert(/3:45/.test(b.querySelector('.ov-jbl-r .s').textContent) && /Gesamt: 3 Titel · 1:02:05/.test(b.querySelector('.ov-jbt').textContent), 'Overlay: Dauer je Zeile + Gesamt');
    const ap = () => { const x = d.createElement('div'); T.ovRenderMusic(x); return x.querySelector('[data-jb="autoplay"]').getAttribute('aria-pressed'); };
    assert(ap() === 'true' && $('jb-autoplay').checked, 'Autostart-Knopf im Overlay, Standard an');
    T.jbxCommand('autoplay');
    assert(ap() === 'false' && !$('jb-autoplay').checked && !$('set-jb-autoplay').checked && T.jbxLoad().autoplay === false, 'Knopf schaltet „beim Start abspielen“ aus, Häkchen im Hauptfenster folgen');
    T.jbxCommand('autoplay');
    assert(T.jbxLoad().autoplay === true && $('jb-autoplay').checked, '… und wieder an');
    T.jbxPlay(1);
    assert($('jb-title').classList.contains('jb-mq') && $('jb-title').querySelector('span').textContent === 'Beta', 'Laufschrift: Titel steckt im wandernden span');
    const o = d.createElement('div'); T.ovRenderMusic(o);
    assert(o.querySelector('.ov-name.jb-mq.jb-on > span[style*="animation-delay"]').textContent === 'Beta', 'Overlay-Titel mit Laufschrift, läuft beim Neuzeichnen weiter');
    assert($('jb-title').classList.contains('jb-on'), 'Lauftext läuft beim Abspielen');
    T.jbxCommand('toggle');
    const p2 = d.createElement('div'); T.ovRenderMusic(p2);
    assert(!$('jb-title').classList.contains('jb-on') && !p2.querySelector('.jb-on'), 'Pause: Titel steht (Hauptfenster + Overlay)');
    console.log('\nALL JUKEBOX Y9 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
