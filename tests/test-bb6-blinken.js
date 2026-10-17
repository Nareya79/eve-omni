// BB6 (27.09.2026): Blinken für Watchlist und Trades getrennt (an/Rahmen/aus, Tempo, Dauer, OmniCom), Hauptfenster + Overlay
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const TR = [{ id: 't1', tid: 34, name: 'Tritanium', hub: 'jita', charId: 111, charName: 'Eins', qty: 100, buy: 5, sell: 6, unit: 0.5, created: Date.now() - 3600e3, status: 'active' }];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TR));
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([{ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 36e5, character_id: '111', character_name: 'Eins' }])); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, T = w.__test;
    T.blSetAlarm({ t1: true });   // t1 ist überboten
    const view = id => { const b = d.createElement('div'); T.ovRenderViewInto(id, b); return b; };
    const obW = () => view('track').querySelector('.ov-card.trk-ob'), obT = () => view('trades').querySelector('.ov-card.alarm');
    const main = () => { T.trRender(); return d.querySelector('#trades-list .tr-card.tr-ob'); };
    // Standard = bisheriges Verhalten
    const d0 = T.blLoad();
    assert(d0.watch.mode === 'an' && d0.trades.mode === 'an' && d0.watch.speed === 'n' && d0.watch.dur === 0 && d0.watch.st.ob && !d0.watch.st.buy, 'Standard: Blinken bei überboten/Problem, normal, dauerhaft');
    assert(obW().classList.contains('blk') && obT().classList.contains('blk') && main().classList.contains('blk'), 'überboten blinkt in Watchlist, Trades-Overlay und Meine Trades');
    // Trades aus → Watchlist blinkt weiter
    T.ovSatAction('trades', { type: 'blink', arg: 'trades:aus' });
    assert(obT().classList.contains('bl-aus') && main().classList.contains('bl-aus') && obW().classList.contains('blk') && !obW().className.includes('bl-'), 'Trades aus → Watchlist blinkt weiter');
    T.ovSatAction('trades', { type: 'blink', arg: 'trades:an' });
    T.ovSatAction('track', { type: 'blink', arg: 'watch:rand' });
    assert(obW().classList.contains('bl-rand') && obT().classList.contains('blk'), 'Watchlist nur Rahmen → Trades blinkt weiter');
    T.ovSatAction('track', { type: 'blink', arg: 'watch:an' });
    // Zustand je Bereich
    T.ovSatAction('trades', { type: 'blinkSt', arg: 'trades:ob' });
    assert(T.blLoad().trades.st.ob === false && T.blLoad().watch.st.ob === true && obT().classList.contains('bl-aus') && obW().classList.contains('blk'), '„überboten“ nur bei Trades abgeschaltet');
    T.ovSatAction('trades', { type: 'blinkSt', arg: 'trades:ob' });
    // Einstellungen: zwei Blöcke, Tempo und Dauer
    T.blSetRender();
    assert(d.getElementById('bl-set-watch') && d.getElementById('bl-set-trades') && d.querySelectorAll('#bl-set-trades [data-bl]').length === 10, 'Einstellungen: Blinken Watchlist + Blinken Trades');
    const sel = (k, v) => { const e = d.querySelector('#bl-set [data-bl="' + k + '"]'); e.value = v; e.onchange(); };
    sel('trades:speed', 'f');
    assert(obT().style.getPropertyValue('--blk') === '.6s' && obW().style.getPropertyValue('--blk') === '1.2s', 'Tempo schnell nur bei Trades');
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(/\.ov-card\.blk\{animation:stBlink var\(--blk,1\.2s\)/.test(css) && /\.tr-card\.tr-ob\{[^}]*skYellow var\(--blk,1\.2s\)/.test(css), 'CSS nutzt --blk');
    sel('watch:dur', '10');
    const realNow = w.Date.now; obW();
    w.Date.now = () => realNow() + 11000;
    assert(obW().classList.contains('bl-rand') && !obW().classList.contains('blk') && obT().classList.contains('blk'), 'Watchlist nach 10 s nur noch Rahmen, Trades blinkt dauerhaft');
    w.Date.now = realNow;
    // OmniCom-Symbol
    assert(!T.blNeo('trades'), 'OmniCom blinkt standardmäßig nicht');
    const neo = d.querySelector('#bl-set [data-bl="trades:neo"]'); neo.checked = true; neo.onchange();
    assert(T.blNeo('trades') && !T.blNeo('watch'), 'OmniCom-Trades-Symbol blinkt bei überboten');
    const nb = d.getElementById('neo-btn-station');
    if (nb) assert(nb.classList.contains('sk-yellow'), 'OmniCom-Knopf Hauptfenster gelb');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-blink-v1')).trades.neo === true, 'gespeichert in eve-zentrale-blink-v1');
    console.log('\nALL BB6 TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
