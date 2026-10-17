// Abschnitt P (Wuensche vom 25.09.2026, 9. Liste: Einstellungen aufraeumen)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.__notes = [];
    w.Notification = function(t, o){ w.__notes.push({ t, o }); }; w.Notification.permission = 'granted'; w.Notification.requestPermission = () => Promise.resolve('granted');
    w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ notify: true, sound: false })); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    // P3: Alarme – Trade und Planeten je eigene Zeile mit Ton und Lautstaerke
    assert($('set-pane-alarm').contains($('ovs-refresh')) && $('tra-tone').options.length >= 6 && $('tra-tonevol') && $('pia-tone') && $('pia-tonevol'), 'P3: Trade-Alarm mit Prüf-Intervall, Ton-Auswahl und Lautstärke; Planeten-Alarm eigene Zeile');
    assert($('pia-notify').checked && !$('pia-sound').checked, 'P3: Planeten übernehmen anfangs die Trade-Haken');
    $('tra-tone').value = 'gong'; $('tra-tone').onchange();
    $('pia-tonevol').value = '0.6'; $('pia-tonevol').onchange();
    let s = T.ovLoad();
    assert(s.tone === 'gong' && s.piToneVol === 0.6 && s.piTone === undefined, 'P3: Ton und Lautstärke je Alarm gespeichert');
    $('pia-test').onclick();
    assert(w.__notes.length === 1 && /Planeten/.test(w.__notes[0].t), 'P3: Planeten-Test meldet sich');
    $('pia-notify').checked = false; $('pia-notify').onchange();
    $('pia-test').onclick();
    assert(w.__notes.length === 1 && T.ovLoad().notify === true, 'P3: Planeten-Meldung einzeln aus, Trade-Meldung bleibt an');
    console.log('\nALL WUENSCHE-P TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
