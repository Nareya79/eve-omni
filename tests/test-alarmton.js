// G1: eigene Sounddatei fuer den Gang-Alarm (gespeichert in EVECore, Groessen-Grenze, Entfernen, Rueckfall auf Piep).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const PLAYED = [];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){
    w.fetch = () => Promise.reject(new Error('offline'));
    w.Audio = function(src){ this.src = src; this.pause = () => {}; this.play = () => { PLAYED.push({ src: this.src, vol: this.volume }); return Promise.resolve(); }; };
  } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const pick = (name, bytes) => { Object.defineProperty($('ga-tone-file'), 'files', { configurable: true, value: [new w.File([new Uint8Array(bytes)], name, { type: 'audio/mpeg' })] }); $('ga-tone-file').onchange(); };
    assert([...$('ga-tone').options].some(o => o.value === 'file') && $('ga-tone-del').hidden, 'Auswahl „Eigene Datei“ vorhanden, noch keine Datei');
    T.gaTone('file');
    assert(PLAYED.length === 0, 'Ohne Datei: kein Audio (Rückfall auf den normalen Piep)');
    pick('riesig.mp3', 2 * 1024 * 1024); await tick(100);
    assert(/zu groß/.test($('ga-status2').textContent) && !w.localStorage.getItem('eve-zentrale-gatone-file-v1'), 'Zu große Datei wird abgelehnt');
    pick('alarm.mp3', 2000); await tick(200);
    const f = JSON.parse(w.localStorage.getItem('eve-zentrale-gatone-file-v1'));
    assert(f && f.name === 'alarm.mp3' && /^data:audio\/mpeg;base64,/.test(f.data), 'Datei in EVECore gespeichert (data-URL)');
    assert($('ga-tone').value === 'file' && JSON.parse(w.localStorage.getItem('eve-zentrale-gangalarm-v1')).tone === 'file', 'Alarmton auf „Eigene Datei“ gestellt');
    assert(/alarm\.mp3/.test($('ga-tone-fname').textContent) && !$('ga-tone-del').hidden, 'Dateiname angezeigt, „Datei entfernen“ sichtbar');
    assert(PLAYED.length === 1 && PLAYED[0].src === f.data && PLAYED[0].vol === 0.25, 'Wird gleich einmal abgespielt, Lautstärke vom Regler');
    $('ga-tone-play').onclick();
    assert(PLAYED.length === 2, '„Anhören“ spielt die eigene Datei');
    $('ga-tone-del').onclick();
    assert(!w.localStorage.getItem('eve-zentrale-gatone-file-v1') && $('ga-tone').value === 'beep' && $('ga-tone-del').hidden, 'Entfernen: Datei weg, zurück auf Doppelpiep');
    console.log('\nALL ALARMTON TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
