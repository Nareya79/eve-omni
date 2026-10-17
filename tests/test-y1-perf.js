// Y1 (27.09.2026): Leistung – GPU-Last, VRAM, GPU- und CPU-Temperatur (Werte kommen aus main.js per evecore:perf)
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); w.evecoreHost = { perf: () => Promise.resolve({}) }; } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, d = w.document, box = h => { const b = d.createElement('div'); b.innerHTML = h; return b; };
    T.perfSet({ cpu: 20, ram: 50, ping: 30, cpuTemp: null, gpu: 99, vramUsed: 9416, vramTot: 16303, gpuTemp: 78 });
    let b = box(T.perfHtml());
    assert(/GPU\s*99 %\s*· 78 °C/.test(b.textContent) && b.querySelector('em.warn'), 'GPU-Last + Temperatur (ab 75 °C gelb): ' + b.textContent);
    assert(/VRAM\s*58 %\s*· 9\.2\/16 GB/.test(b.textContent), 'VRAM belegt/gesamt');
    assert(/CPU\s*20 %RAM/.test(b.textContent), 'ohne CPU-Temperatur keine Anzeige');
    assert(/Server\s*Tranquility · /.test(b.textContent), 'Servername Tranquility');
    T.perfSet({ cpu: 20, ram: 50, ping: 30, cpuTemp: 88 });
    b = box(T.perfHtml());
    assert(/CPU\s*20 %\s*· 88 °C/.test(b.textContent) && b.querySelector('em.bad') && !/GPU|VRAM/.test(b.textContent), 'CPU-Temperatur rot ab 85 °C; ohne NVIDIA keine GPU-Zeilen');
    console.log('\nALL Y1 PERF TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
