// W6/W7 (26.09.2026): Sicherheitszahl + NPC-Stations-Symbol neben dem Systemnamen, große Karte und Overlay-Karte, gemerkt
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
setTimeout(() => {
  try{
    const T = w.__test;
    const o = T.mpOpts();
    assert(o.sec && o.st, 'W6/W7: Standard an');
    w.localStorage.setItem('eve-zentrale-mapstations-v1', JSON.stringify({ 1: [[60003760, 'Jita IV', 'KM']], 2: [] }));
    const need = []; T.mpStReset();
    const a = T.mpLabelExtra('1', ['Jita', 0, 0, 0.946], o, x => need.push(x));
    const b = T.mpLabelExtra('2', ['Hasmijaala', 0, 0, -0.43], o, x => need.push(x));
    assert(/>0\.9<\/tspan>/.test(a) && /class="si"/.test(a), 'W6/W7: Jita 0.9 in Sicherheitsfarbe + Stations-Symbol: ' + a);
    assert(/>-0\.4<\/tspan>/.test(b) && !/class="si"/.test(b), 'W6: Nullsec als -0.4, ohne Station kein Symbol');
    T.mpLabelExtra('3', ['X', 0, 0, 0.5], o, x => need.push(x)); T.mpLabelExtra('3', ['X', 0, 0, 0.5], o, x => need.push(x));
    assert(need.length === 1, 'W7: fehlende Stationen werden je System nur einmal nachgeladen');
    T.mpOptSet('sec', false); T.mpOptSet('st', false);
    assert(!T.mpOpts().sec && !T.mpOpts().st && T.mpLabelExtra('1', ['Jita', 0, 0, 0.9], T.mpOpts(), () => {}) === '', 'W6/W7: abschaltbar und gemerkt (map-v1)');
    assert(T.mpOpts().font === 11, 'W5b: Kartenschrift Standard 11 px'); T.mpOptSet('font', 30); assert(T.mpOpts().font === 20, 'W5b: A+ gemerkt, höchstens 20 px');
    console.log('\nALL WUENSCHE-W6 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
}, 800);
