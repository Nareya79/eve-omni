// 14.10.2026: Jukebox-Zeit per Klick umschalten (gelaufen / Länge → −Rest / Länge → gelaufen / −Rest), großer Player, Overlay und Miniplayer
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, a = { currentTime: 72, duration: 220 };
    assert(T.jbxTimes(a).join(' / ') === '1:12 / 3:40', 'Standard: gelaufen / Länge');
    const t = d.getElementById('jb-time');
    assert(t && t.getAttribute('data-jb') === 'time' && /Anzeige wechseln/.test(t.title), 'großer Player: Zeit ist klickbar mit Tooltip');
    t.click(); await tick(20);
    assert(T.jbxLoad().tmode === 1 && T.jbxTimes(a).join(' / ') === '−2:28 / 3:40', 'Klick 1: Restzeit / Länge');
    T.jbxCommand('time');
    assert(T.jbxLoad().tmode === 2 && T.jbxTimes(a).join(' / ') === '1:12 / −2:28', 'Klick 2: gelaufen / Restzeit');
    T.jbxCommand('time');
    assert(T.jbxLoad().tmode === 0, 'Klick 3: wieder gelaufen / Länge');
    assert((html.match(/data-jb="time" class="jb-time"/g) || []).length === 3, 'Overlay/Miniplayer: Kopfzeit und beide Spulzeiten klickbar (laufen über data-jb, auch im Einzelfenster)');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
