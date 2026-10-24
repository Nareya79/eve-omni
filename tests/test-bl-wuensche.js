// BL (24.10.2026): BL4 Route per Rechtsklick (löschen, ab hier löschen, meiden + neu), BK Ersatzsymbol für fehlende Typ-Symbole (SKIN),
// BL3 Grün weniger leuchtend, BL1 Amarr kräftiger, BL2 Mikrofon-Schalter für Discord (main.js).
const fs = require('fs');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 50));
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8'), src = fs.readFileSync('/home/claude/EVECore.html', 'utf-8'), main = fs.readFileSync('/home/claude/main.js', 'utf-8');
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(600);
    const d = w.document, T = w.__test;
    const setRoute = () => { const s = T.rtLoad(); s.last = { route: [30000142, 30000144, 30002768, 30002187], pos: 0, time: Date.now(), from: { id: 30000142, name: 'Jita' }, to: { id: 30002187, name: 'Amarr' }, jb: [] }; T.rtSave(s); };
    setRoute();
    assert(/endet jetzt in Perimeter/.test(T.rtCtxRoute('rtcut', 30000144, 'Perimeter')) && T.rtLoad().last.route.join() === '30000142,30000144' && T.rtLoad().last.to.name === 'Perimeter', 'BL4: Route ab hier löschen → endet in Perimeter');
    assert(/nicht auf der Route/.test(T.rtCtxRoute('rtcut', 30002187, 'Amarr')), 'BL4: System nicht auf der Route → Hinweis');
    setRoute();
    assert(/nicht meiden/.test(T.rtCtxRoute('rtavoid', 30000142, 'Jita')), 'BL4: Start lässt sich nicht meiden');
    assert(/gelöscht/.test(T.rtCtxRoute('rtclear', 30000144, 'Perimeter')) && !T.rtLoad().last, 'BL4: Route löschen');
    // Rechtsklick in der Reiseroute
    setRoute(); T.rtRender(); await tick(30);
    const tr = d.querySelector('#rt-table tbody tr:nth-child(2)') || [...d.querySelectorAll('tr')].find(t => typeof t.oncontextmenu === 'function');
    assert(tr && typeof tr.oncontextmenu === 'function', 'BL4: Zeile der Reiseroute hat ein Rechtsklick-Menü');
    tr.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const m = d.getElementById('rt-ctx');
    assert(m && /Route ab hier löschen/.test(m.textContent) && /Meiden und neu berechnen/.test(m.textContent) && /Route löschen/.test(m.textContent), 'BL4: Menü mit allen drei Punkten');
    m.querySelector('[data-rtc="rtclear"]').click(); await tick(20);
    assert(!T.rtLoad().last && !d.getElementById('rt-ctx'), 'BL4: Klick löscht die Route, Menü zu');
    // BK: fehlendes Typ-Symbol → Ersatz; mit eigenem onerror zuerst der eigene Versuch
    const a = d.createElement('img'); a.src = 'https://images.evetech.net/types/12345/icon?size=32'; d.body.appendChild(a);
    a.dispatchEvent(new w.Event('error'));
    assert(/^data:image\/svg\+xml/.test(a.getAttribute('src')), 'BK: kaputtes Typ-Symbol (z. B. SKIN) → Ersatzsymbol');
    const b = d.createElement('img'); b.setAttribute('onerror', "this.onerror=null;this.src=this.src.replace('/icon','/bp')"); b.src = 'https://images.evetech.net/types/1/icon?size=32'; d.body.appendChild(b);
    b.dispatchEvent(new w.Event('error'));
    assert(/\/bp/.test(b.getAttribute('src')), 'BK: eigener Ersatzversuch der Stelle läuft zuerst');
    b.dispatchEvent(new w.Event('error'));
    assert(/^data:image\/svg\+xml/.test(b.getAttribute('src')), 'BK: scheitert auch der → Ersatzsymbol');
    const c = d.createElement('img'); c.src = 'https://images.evetech.net/characters/1/portrait'; d.body.appendChild(c); c.dispatchEvent(new w.Event('error'));
    assert(/characters/.test(c.getAttribute('src')), 'BK: Porträts bleiben unberührt');
    // BL3 / BL1 / BL2
    assert(/text-shadow:0 0 3px rgba\(0,255,0,\.28\)/.test(src) && !/0 0 4px rgba\(0,255,0,\.55\)/.test(src), 'BL3: grüner Schein halbiert');
    assert(/data-scheme="amarr-eve"\]\{ --e0:#07030d; --e1:#d1a54f/.test(src), 'BL1: Amarr kräftiger');
    assert(/function dcMicOk\(perm, types, url\)/.test(main) && /'Mikrofon \(Sprachkanäle\)'/.test(main) && /types\.every\(t => t === 'audio'\)/.test(main), 'BL2: Mikrofon nur mit Schalter, nur Ton, nur discord.com');
    const dm = new Function('S', main.slice(main.indexOf('function dcMicOk('), main.indexOf('\n}', main.indexOf('function dcMicOk(')) + 2) + '; return dcMicOk;');
    const on = dm({ windows: { discord: { mic: true } } }), off = dm({ windows: { discord: {} } });
    assert(on('media', ['audio'], 'https://discord.com/channels/1') && !on('media', ['audio', 'video'], 'https://discord.com/x') && !on('media', ['audio'], 'https://evil.example/') && !off('media', ['audio'], 'https://discord.com/x'), 'BL2: Freigabe-Regeln (an/aus, Kamera, fremde Seite)');
    console.log('\nALL BL TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); console.log('FAILED'); process.exit(1); }
})();
