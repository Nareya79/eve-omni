// X4: leiser Ton bei Statuswechsel verfolgter Trades/Laeufe (verkauft, erledigt), abschaltbar
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(700);
    const T = w.__test, ls = w.localStorage;
    ls.setItem('eve-zentrale-trades-v1', JSON.stringify([{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: '', qty: 10, buy: 5, sell: 6, created: Date.now(), status: 'active' }]));
    assert(T.stChime() === '', 'Erstes Sehen: nur merken, kein Ton');
    assert(T.stChime() === '', 'Nichts geändert: kein Ton');
    const k = JSON.parse(ls.getItem('eve-zentrale-stchime-v1')); k['Trade:t1'].s = -1; ls.setItem('eve-zentrale-stchime-v1', JSON.stringify(k));
    assert(T.stChime() === 'stSold', 'Mehr verkauft: leises Pling');
    T.trUpdate('t1', { status: 'done', done: Date.now() });
    assert(T.stChime() === 'stDone', 'Erledigt: Zweiklang');
    assert(T.stChime() === '', 'Erledigt bleibt erledigt: kein zweiter Ton');
    const cb = w.document.getElementById('ovs-stsound');
    assert(cb && cb.checked, 'Einstellung vorhanden, standardmäßig an');
    cb.checked = false; cb.onchange();
    assert(T.ovLoad().stSound === false, 'Abschaltbar (Einstellungen › Alarme)');
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e.message); console.log('FAILED'); process.exit(1); }
  process.exit(0);
})();
