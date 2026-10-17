// Abschnitt M (Wuensche vom 24.09.2026, 6. Liste): M8 „Verfolgt“ mit M5 Bildern
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const now = Date.now();
const RUNS = [
  { id: 'r1', from: 60003760, fromName: 'Jita IV - Caldari Navy', to: 60011866, toName: 'Dodixie IX - Fed Navy', charId: '111', charName: 'Taron',
    items: [{ tid: 34, name: 'Tritanium', q: 100, sp: 10, p: 500 }, { tid: 35, name: 'Pyerite', q: 10, sp: 10, p: 50 }], created: now - 3600000, status: 'active' },
  { id: 'r2', from: 60003760, fromName: 'Jita IV', to: 60008494, toName: 'Amarr VIII', charId: '111', charName: 'Taron',
    items: [{ tid: 36, name: 'Mexallon', q: 5, sp: 1, p: 1 }], created: now - 86400000, status: 'done', cancelled: true, doneAt: now - 3600000, res: -500 }];
const TRADES = [{ id: 't1', tid: 37, name: 'Veldspar', hub: 'jita', charId: '111', qty: 10, status: 'done', done: now - 86400000, created: now - 2 * 86400000, finalResult: 12000 },
  { id: 't2', tid: 38, name: 'Alt', hub: 'jita', charId: '111', qty: 10, status: 'done', done: now - 40 * 86400000, created: now - 41 * 86400000, finalResult: 1000 }];
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-haulruns-v1', JSON.stringify(RUNS));
    w.localStorage.setItem('eve-zentrale-trades-v1', JSON.stringify(TRADES)); } }).window;
(async () => {
  try{
    await tick(700);
    const d = w.document, $ = id => d.getElementById(id);
    $('neo-btn-track').onclick(); await tick(50);
    assert($('panel-track').classList.contains('active'), 'M8: OmniCom-Knopf öffnet „Verfolgt“');
    const cards = d.querySelectorAll('#trk-body .trk-sm');
    assert(cards.length === 1 && /Jita IV → Dodixie IX/.test(cards[0].textContent) && cards[0].classList.contains('trk-run') && d.querySelector('#trk-body .trk-g'), 'M8/X2: Aktiv zeigt den offenen Lauf als Overlay-Zeile in einer Status-Ebene');
    cards[0].onclick(); await tick(30);
    assert(d.querySelectorAll('#trk-body .tr-card').length === 1, 'X2: Klick auf die Zeile klappt die volle Karte auf');
    const imgs = cards[0].querySelectorAll('.trk-pics img');
    assert(imgs.length === 3 && /characters\/111\/portrait/.test(imgs[0].src) && /types\/34\/icon/.test(imgs[1].src), 'M5: Porträt und Item-Icons auf der Karte');
    d.querySelector('[data-trk="done"]').onclick(); await tick(30);
    assert(d.querySelectorAll('#trk-body .trk-sm').length === 1 && $('trk-range').value === '30', 'BB13: Erledigt zeigt standardmäßig 30 Tage');
    $('trk-range').value = '0'; $('trk-range').onchange(); await tick(30);
    assert(d.querySelectorAll('#trk-body .trk-sm').length === 2, 'M8: Erledigt zeigt beide Trades (alles)');
    $('trk-range').value = '30'; $('trk-range').onchange(); await tick(30);
    assert(d.querySelectorAll('#trk-body .trk-sm').length === 1 && /\+11,5 Tsd/.test($('trk-stats').textContent), 'M8: Zeitraum 30 Tage filtert, Summe im Kopf: ' + $('trk-stats').textContent);
    d.querySelector('[data-trk="cancelled"]').onclick(); await tick(30);
    assert(d.querySelectorAll('#trk-body .trk-sm').length === 1 && /Mexallon|Jita IV → Amarr VIII/.test($('trk-body').textContent) && /-|−/.test(d.querySelector('#trk-body .trk-sm b').textContent), 'M8: Abgebrochen zeigt den abgebrochenen Lauf mit Verlust');
    assert(!/Amarr VIII/.test($('wv-done-body').textContent), 'M8: abgebrochener Lauf fehlt in der Wallet-Erledigt-Liste');
    // BB11: Lauf abbrechen in der Watchlist (Hauling zeigt nur noch den Hinweis)
    d.querySelector('[data-trk="active"]').onclick(); await tick(30);
    d.querySelector('[data-trk-row="Lauf:r1"]').onclick(); await tick(30);
    d.querySelector('#trk-body [data-tk="cancel|Lauf:r1"]').onclick(); await tick(30);
    const r1 = JSON.parse(w.localStorage.getItem('eve-zentrale-haulruns-v1')).find(x => x.id === 'r1');
    assert(r1.status === 'done' && r1.cancelled, 'M8: Lauf lässt sich abbrechen');
    console.log('\nALL WUENSCHE-M TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
