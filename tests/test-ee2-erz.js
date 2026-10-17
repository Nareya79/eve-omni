// EE2 (03.10.2026): Erz-Tabelle (Mineralien je m³, beste Quelle) + Umkehrrechner Mineralien → günstigster Erz-Mix
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
const book = p => ({ d: { buy: [], sell: [{ location_id: 60003760, price: p }] } });
(async () => {
  try{
    await tick(600);
    const T = w.__test, d = w.document;
    const P = T.miNeedParse('Tritanium 1.000.000\nPyerite\t250000\n500 Mexallon\nQuatsch 5');
    assert(P.need[34] === 1e6 && P.need[35] === 25e4 && P.need[36] === 500 && P.bad.length === 1, 'EE2: Mineralliste lesen (Leerzeichen, Tab, Menge vorn), Unbekanntes melden');
    // Preise: Plagioclase (18: 175 Trit + 70 Mex je 100) günstig, Mineralien teurer
    T.vcOrdSet('10000002:18', book(5)); T.vcOrdSet('10000002:34', book(4)); T.vcOrdSet('10000002:36', book(60)); T.vcOrdSet('10000002:35', book(8));
    const D = T.miLoad2(); D.cls = { high: true }; D.tax = 0;
    const X = T.miMix(D, { 34: 10000 });
    assert(X.mix.length && X.mix[0].o[0] === 18 && !X.miss.length && X.got[34] >= 10000 * 0.99, 'EE2: Erz-Mix deckt 10.000 Tritanium mit Plagioclase');
    assert(X.direct === 40000 && X.cost > 0 && X.m3 > 0, 'EE2: Vergleich mit Mineralien direkt kaufen');
    T.miTSet(Date.now());
    D.need = 'Tritanium 10000'; D.view = 'table';
    const b = d.createElement('div'); T.miTableView(b, D, true);
    assert(b.querySelector('table.mi-tab') && b.querySelector('td.mi-best') && /Erz-Mix/.test(b.textContent) && /Plagioclase|Plagioklas/.test(b.textContent), 'EE2: Tabelle mit bester Quelle + Ergebnis des Umkehrrechners');
    const s = d.createElement('div'); T.miTableView(s, D, false);
    assert(/Beste Quelle je Mineral/.test(s.textContent) && !s.querySelector('table'), 'EE2: Overlay zeigt die Kurzfassung');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
