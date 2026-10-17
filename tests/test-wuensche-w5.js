// W5 (26.09.2026): Mausover über ein System – Sicherheit, Region, Stationen mit Diensten, eigene Assets, eigene Charaktere
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-syssec-v1', JSON.stringify({ sys: { 30000142: { n: 'Jita', s: 0.946, c: 1, r: 10000002 }, 30000144: { n: 'Perimeter', s: 0.95, c: 1, r: 10000002 } }, reg: { 10000002: 'The Forge' } }));
    w.localStorage.setItem('eve-zentrale-mapstations-v1', JSON.stringify({ 30000142: [[60003760, 'Jita IV - Moon 4', 'KM']], 30000144: [] })); } }).window;
setTimeout(() => {
  try{
    const T = w.__test; T.mpStReset();
    w.localStorage.setItem('eve-zentrale-listcache-v1', JSON.stringify({ assets: { d: { g: [{ cid: 91, name: 'Alice', locs: [{ id: 60003760, sys: 30000142, rows: [{ qty: 10, estValue: 2e6 }, { qty: 5, estValue: 1e6 }] }, { id: 1, sys: 30000144, rows: [{ qty: 1 }] }] }] } } }));   // erst nach dem Start: nur die Kartenhilfe liest sie
    const h = T.mpSysTip('30000142');
    assert(/<b>Jita<\/b>/.test(h) && />0\.9<\/span>/.test(h) && /The Forge/.test(h), 'W5: Name, Sicherheit farbig, Region: ' + h);
    assert(/Jita IV - Moon 4/.test(h) && /Klonbank · Markt/.test(h), 'W5: Station mit Diensten inkl. Klonbank');
    assert(/portrait\?size=32/.test(h) && /Alice: 15 Stück/.test(h), 'W5: eigene Assets je Charakter mit Bild und Anzahl');
    assert(/keine NPC-Station/.test(T.mpSysTip('30000144')) && T.mpSysTip('1') === '', 'W5: System ohne Station, unbekanntes System ohne Fenster');
    console.log('\nALL WUENSCHE-W5 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
}, 800);
