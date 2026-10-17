// W8 (26.09.2026): Ebenen beider Karten einzeln schaltbar; ⌖ neben Systemnamen öffnet das Karten-Overlay auf dem System
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline'));
    w.localStorage.setItem('eve-zentrale-syssec-v1', JSON.stringify({ sys: { 30000142: { n: 'Jita', s: 0.946, c: 1, r: 10000002 } }, reg: { 10000002: 'The Forge' } }));
    w.localStorage.setItem('eve-zentrale-map-v1', JSON.stringify({ regions: { 10000002: 'The Forge' }, r: { 10000002: { sys: { 30000142: ['Jita', 0, 0, 0.946], 30000144: ['Perimeter', 10, 10, 0.95] }, ext: {}, edges: [] } } })); } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    const o = T.mpOpts();
    assert(o.gr && o.me && o.rt, 'W8: Kämpfe, Charaktere, Route standardmäßig an');
    T.mpOptSet('gr', false); T.mpOptSet('rt', false);
    const o2 = T.mpOpts(); assert(!o2.gr && o2.me && !o2.rt && o2.sec, 'W8: einzeln abschaltbar und gemerkt (map-v1)');
    assert(d.getElementById('mp-o-gr') && d.getElementById('mp-o-me') && d.getElementById('mp-o-rt'), 'W8: große Karte hat die Schalter');
    assert(/data-gosys="30000142"/.test(T.sysGo(30000142)) && T.sysGo(null) === '', 'W8: ⌖ trägt die System-ID');
    const host = d.createElement('div'); host.innerHTML = T.sysGo(30000142); d.body.appendChild(host);
    host.firstElementChild.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tick(300);
    const s = T.ovLoad();
    assert(s.mapReg === 10000002 && s.mapSel === '30000142' && s.mapVb && s.mapVb.r === 10000002, 'W8: Klick auf ⌖ zentriert das Karten-Overlay auf Jita: ' + JSON.stringify({ r: s.mapReg, sel: s.mapSel }));
    console.log('\nALL WUENSCHE-W8 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
