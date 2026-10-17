// FF4 (03.10.2026): Watchlist – Ort in der Zeile, nach Ort/Status/Ampel sortieren, mehrere Sortierungen (Umschalt+Klick bzw. „dann“)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, K = T.TRK_SORT;
    const L = [{ name: 'B', where: 'Jita', res: 5, t: 1 }, { name: 'A', where: 'Amarr', res: 9, t: 2 }, { name: 'C', where: 'Jita', res: 20, t: 3 }, { name: 'D', where: '', res: 1, t: 4 }];
    const names = () => T.sortList('track', L, K).map(x => x.name).join('');
    T.sortClick('track:where');
    assert(names() === 'ABCD', 'FF4: nach Ort A–Z, ohne Ort ans Ende');
    T.sortClick('track:profit', true);
    assert(T.sortKeys('track').map(k => k.by).join() === 'where,profit' && names() === 'ACBD', 'FF4: Umschalt+Klick – erst Ort, dann Gewinn groß → klein');
    assert(/<sup>2<\/sup>Gewinn/.test(T.sortBar('track').innerHTML), 'FF4: Leiste zeigt die Reihenfolge 1/2');
    T.sortClick('track:profit', true);
    assert(names() === 'ABCD', 'FF4: nochmal Umschalt+Klick dreht nur die zweite Sortierung um');
    T.sortClick('track:name');
    assert(T.sortKeys('track').length === 1 && names() === 'ABCD', 'FF4: normaler Klick auf eine andere Spalte = nur noch diese');
    T.sortThen('track', 'where');
    assert(T.sortKeys('track').map(k => k.by).join() === 'name,where', 'FF4: „dann nach“ in der großen Ansicht');
    T.sortThen('track', '');
    assert(T.sortKeys('track').length === 1, 'FF4: „dann –“ nimmt die zweite Sortierung weg');
    T.sortClick('track:t');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
