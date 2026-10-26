// 25.10.2026: Waren mit published=false (Typ 97898 „Triglavian Background“) findet der Mehrfachkauf in EVE nicht („Konnte nicht gelesen werden“) –
// sie fliegen aus der kopierten Liste und stehen darunter als „einzeln kaufen“ mit Menge + Markt-Knopf (Overlay und Hauptfenster).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    let asked = [];
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true, beforeParse(win){
      win.localStorage.setItem('eve-zentrale-welcome-v1', 'done');
      win.fetch = u => { const m = /universe\/types\/(\d+)\//.exec(String(u)); if (!m) return Promise.reject(new Error('offline')); asked.push(m[1]);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ type_id: +m[1], name: m[1] === '97898' ? 'Triglavian Background' : 'Ware ' + m[1], published: m[1] !== '97898', volume: 0.1 }) }); };
    } }).window;
    await tick(800);
    const T = w.__test, d = w.document;
    const rows = [{ tid: 34, name: 'Tritanium', q: 300 }, { tid: 97898, name: 'Triglavian Background', q: 2 }, { tid: 35, name: 'Pyerite', q: 200 }];
    T.ovMultibuy(rows); await tick(120);   // erste Anfrage lernt published
    assert(asked.indexOf('97898') >= 0, 'fragt bei EVE nach, ob die Ware veröffentlicht ist');
    const sp = T.mbSplit(rows);
    assert(sp.ok.map(r => r.tid).join() === '34,35' && sp.no.map(r => r.tid).join() === '97898', 'nicht veröffentlichte Ware wird aussortiert');
    const ov = T.ovMultibuy(rows), b = ov.querySelector('.tsc-cp-b');
    assert(b.getAttribute('data-copy') === 'Tritanium 300\nPyerite 200', 'Overlay: kopierte Liste ohne „Triglavian Background 2“');
    assert(/einzeln kaufen/.test(ov.textContent) && /Triglavian Background/.test(ov.querySelector('.mb-np').textContent) && ov.querySelector('.mb-np [data-copy="2"]') && ov.querySelector('.mb-np [data-mk="97898"]'), 'Overlay: „einzeln kaufen“ mit Menge 2 und Markt in EVE');
    const mc = T.slCopyAll(rows); let copied = '';
    w.navigator.clipboard && (w.navigator.clipboard.writeText = t => { copied = t; return Promise.resolve(); });
    assert(/einzeln kaufen/.test(mc.textContent) && mc.querySelector('[data-mk="97898"]'), 'Hauptfenster: Hinweis „einzeln kaufen“ mit Markt-Knopf');
    const n0 = asked.length; T.mbSplit(rows); await tick(50);
    assert(asked.length === n0, 'je Ware nur einmal je Sitzung nachgefragt');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-mb-unpub-v1'))['97898'] === 1, 'gemerkt (auch nach Neustart)');
    console.log('\nALL MB-UNVEROEFFENTLICHT TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
