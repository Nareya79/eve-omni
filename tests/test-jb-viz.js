// 14.10.2026: Jukebox-Visualisierung – Stil wählbar (Balken / Welle / Kreise), gemerkt, feste Balkenbreite statt fester Anzahl
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const store = () => JSON.parse(w.localStorage.getItem('eve-zentrale-jukebox-v1') || '{}');
    // Zeichnen mit Zähl-Leinwand
    const mk = (width, vs) => { const cv = d.createElement('canvas'); Object.defineProperty(cv, 'clientWidth', { value: width }); Object.defineProperty(cv, 'clientHeight', { value: 28 }); if (vs) cv.setAttribute('data-vs', vs);
      const c = { rect: 0, arc: 0, stroke: 0, line: 0 }; cv.getContext = () => ({ clearRect(){}, fillRect(){ c.rect++; }, beginPath(){}, arc(){ c.arc++; }, fill(){}, moveTo(){}, lineTo(){ c.line++; }, stroke(){ c.stroke++; }, createLinearGradient(){ return { addColorStop(){} }; } }); cv.c = c; return cv; };
    const v = Array.from({ length: 48 }, (_, i) => (i * 37) % 255);
    let a = mk(120); T.jbxVizDraw(a, v);
    assert(a.c.rect === 20, 'Balken: schmales Fenster (120 px) fasst 48 Bänder zu 20 Balken zusammen (' + a.c.rect + ')');
    a = mk(900); T.jbxVizDraw(a, v);
    assert(a.c.rect === 48, 'Balken: breites Fenster zeigt alle 48, nicht breiter');
    a = mk(300, 'dots'); T.jbxVizDraw(a, v);
    assert(a.c.arc === Math.floor(300 / 9) && !a.c.rect, 'Kreise: ein Kreis je 9 px');
    a = mk(300, 'wave'); T.jbxVizDraw(a, v);
    assert(a.c.stroke === 2 && a.c.line > 100 && !a.c.rect, 'Welle: zwei Linien über die ganze Breite');
    { const sp = mk(300, 'space'), g = sp.getContext(), gx = { clearRect(){}, fillRect(){ c.rect++; }, beginPath(){}, moveTo(){}, lineTo(){ c.line++; }, stroke(){ c.stroke++; }, createLinearGradient(){ return { addColorStop(){} }; }, createRadialGradient(){ c.rad++; return { addColorStop(){} }; } }, c = { rect: 0, line: 0, stroke: 0, rad: 0 };
      sp.getContext = () => gx; sp.id = 'sp-test';
      for (let i = 0; i < 5; i++) T.jbxVizDraw(sp, v);
      assert(c.rad === 15 && c.stroke === 5 && c.rect > 15 + 5 * 15 && c.line > 5, 'SS8 Weltraum: je Bild 3 Nebel, Sterne und eine EKG-Linie (' + c.rad + '/' + c.rect + '/' + c.line + ')');
      c.rect = c.line = c.stroke = c.rad = 0; T.jbxVizDraw(sp, new Array(48).fill(0));
      assert(c.stroke === 1 && c.rad === 3, 'SS8 Weltraum: Stille zeichnet ohne Fehler'); }
    a = mk(300, 'wave'); T.jbxVizDraw(a, new Array(48).fill(0));
    assert(a.c.stroke === 2, 'Stille zeichnet ohne Fehler');
    // Stil wählen: reihum, gemerkt, Overlay-Leinwand + Auswahl in Klang & Extras
    assert(!store().vizStyle && $('jb-viz-st') && $('jb-viz-st').value === 'space', 'TT1: Standard Weltraum, Auswahl unter Klang & Extras vorhanden');
    T.jbxCommand('vizst:bars'); T.jbxCommand('vizst'); assert(store().vizStyle === 'wave' && $('jb-viz-st').value === 'wave', 'Klick: Balken → Welle');
    T.jbxCommand('vizst'); assert(store().vizStyle === 'dots', 'Welle → Kreise');
    T.jbxCommand('vizst'); assert(store().vizStyle === 'space', 'SS8: Kreise → Weltraum');
    T.jbxCommand('vizst'); assert(store().vizStyle === 'bars', 'Weltraum → Balken');
    $('jb-viz-st').value = 'dots'; $('jb-viz-st').onchange();
    assert(store().vizStyle === 'dots' && $('jb-viz').getAttribute('data-vs') === 'dots', 'Aufklappliste speichert, große Leinwand übernimmt den Stil');
    T.jbxSetFiles([{ name: 'Alpha.mp3', url: 'file:///m/a.mp3' }], 'C:\M'); T.jbxPlay(0);
    const box = d.createElement('div'); T.ovRenderMusic ? T.ovRenderMusic(box) : null;
    if (T.ovRenderMusic){ const cv = box.querySelector('.ov-jbviz'); assert(cv && cv.getAttribute('data-vs') === 'dots' && cv.getAttribute('data-jb') === 'vizst', 'Overlay-Leinwand trägt den Stil, Klick schaltet weiter'); }
    // QQ2: weich zeichnen – Werte alle ~70 ms, Bilder mit der Bildrate; steigt schnell, fällt langsamer, hört bei Stille auf
    const frames = []; w.requestAnimationFrame = f => { frames.push(f); return frames.length; };
    const run = (n, t0, dt) => { for (let i = 0; i < n && frames.length; i++) frames.shift()(t0 + i * dt); };
    const sv = mk(240); Object.defineProperty(sv, 'offsetParent', { get(){ return sv.isConnected ? d.body : null; } }); d.body.appendChild(sv);
    const now = w.performance.now();
    T.jbxVizSet(sv, new Array(48).fill(200)); run(1, now, 16); const a1 = sv._vc[0];
    run(5, now + 16, 16); const a2 = sv._vc[0];
    assert(a1 > 0 && a1 < 200 && a2 > a1 && a2 <= 200, 'Steigt über mehrere Bilder weich an (' + Math.round(a1) + ' → ' + Math.round(a2) + ')');
    T.jbxVizSet(sv, new Array(48).fill(0)); const r1 = sv._vc[0]; run(1, now + 112, 16); const fall1 = r1 - sv._vc[0];
    assert(fall1 > 0 && fall1 < r1 * 0.3, 'Fällt langsamer als es steigt (' + Math.round(fall1) + ' von ' + Math.round(r1) + ')');
    run(400, now + 128, 16);
    assert(!frames.length && sv._vc.every(x => x === 0) && !sv._vr, 'Bei Stille: auf 0 und keine weiteren Bilder');
    T.jbxVizSet(sv, new Array(48).fill(100)); T.jbxVizSet(sv, new Array(48).fill(120));
    assert(frames.length === 1, 'Neue Werte während des Laufs starten keine zweite Schleife');
    sv.remove(); run(2, now + 9000, 16);
    assert(!frames.length && !sv._vr, 'Leinwand entfernt → Schleife endet');
    const src = require('fs').readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
    assert(!/jbxVizDraw\((page|c|jv), /.test(src) && (src.match(/jbxVizSet\(/g) || []).length >= 6, 'Hauptfenster, Kompaktansicht und Overlay-Fenster zeichnen über jbxVizSet');
    console.log('\nALL JB-VIZ TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
