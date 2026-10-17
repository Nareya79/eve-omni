// Wunsch 27.09.2026: Blinken in Watchlist + Trades im Overlay abschaltbar oder nur als Rahmen (⚙-Menü)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: Date.now() - 3600e3, status: 'active' }];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR)); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    const view = id => { const b = d.createElement('div'); T.ovRenderViewInto(id, b); return b; };
    let b = view('track');
    assert(b.querySelector('.ov-blm [data-ova="blinkOpen"]') && !b.querySelector('[data-ova="blink"]') && view('trades').querySelector('.ov-blm [data-ova="blinkOpen"]'), '⚙-Knopf in Watchlist und Trades, Menü zu');
    assert(!b.querySelector('.ov-card[class*="bl-"]'), 'Standard: Blinken wie bisher');
    T.ovSatAction('track', { type: 'blinkOpen' });
    b = view('track');
    assert(b.querySelectorAll('[data-ova="blink"]').length === 3 && b.querySelector('[data-ova="blink"][data-arg="watch:an"][aria-pressed="true"]'), 'Menü offen: Blinken / Nur Rahmen / Aus');
    T.ovSatAction('track', { type: 'blink', arg: 'watch:rand' });
    b = view('track');
    assert(T.blLoad().watch.mode === 'rand' && b.querySelector('.ov-card.trk-sm.bl-rand'), 'Nur Rahmen (Watchlist)');
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(/\.ov-card\.bl-rand,\.ov-card\.bl-aus\{animation:none!important\}/.test(css) && /bl-rand:is\([^)]*trk-ob[^)]*\)\{border-color:var\(--st\)/.test(css), 'CSS: kein Blinken, fester Rahmen in Warnfarbe');
    T.ovSatAction('track', { type: 'blink', arg: 'watch:aus' });
    assert(view('track').querySelector('.ov-card.bl-aus'), 'Aus');
    T.ovSatAction('track', { type: 'blink', arg: 'watch:an' });
    assert(!view('track').querySelector('.ov-card[class*="bl-"]'), 'wieder Blinken');
    console.log('\nALL BLINKEN TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
