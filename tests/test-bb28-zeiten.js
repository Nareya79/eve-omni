// BB28 (30.09.2026): Datenstand-Zeiten („Markt aktualisiert“, „neu ab“ …) nur eine Zone, eigene Einstellung; lange Zeile oben läuft als Laufschrift
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document, t = Date.UTC(2026, 8, 30, 12, 30);
    const loc = new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    w.localStorage.setItem('eve-zentrale-timemode-v1', 'both');
    assert(T.fmtT(t) === loc && T.fmtT(t, false, true) === loc + ' · EVE 12:30', 'BB28: Uhr „beides“, Datenstand trotzdem nur Ortszeit');
    const sel = d.getElementById('set-standtime');
    assert(sel && [...sel.options].map(o => o.value).join() === 'local,eve', 'BB28: Einstellung Datenstand-Zeiten nur Ortszeit oder EVE-Zeit');
    sel.value = 'eve'; sel.dispatchEvent(new w.Event('change'));
    assert(T.fmtT(t) === '12:30 EVE' && w.localStorage.getItem('eve-zentrale-standtime-v1') === 'eve', 'BB28: auf EVE-Zeit umgestellt und gemerkt');
    assert(/header\.top \.esi-stand\.marq>span\{animation:esmarq/.test(html) && /esi-stand\.marq:hover>span\{animation-play-state:paused\}/.test(html), 'BB28: zu lange Zeile oben als Laufschrift (Maus drauf = Stopp)');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
