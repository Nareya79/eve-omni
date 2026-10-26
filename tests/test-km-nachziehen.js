// 24.10.2026: OmniMap verschwand nach dem Ziehen (bis zu ~10 s) – ein Update während gedrückter Maustaste wurde nach dem Loslassen
// nachgeholt, die Karte aber nicht eingehängt (leerer Rahmen bis zum nächsten Update). Jetzt hängt der nachgeholte Neuaufbau sie ein
// und behält den zuletzt gezeigten Ausschnitt (kein Rücksprung auf den gespeicherten).
const fs = require('fs');
const { JSDOM } = require('jsdom');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 50));
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(600);
    const d = w.document, T = w.__test;
    T.ovSetMode('compact'); await tick(100);
    const so = T.ovLoad(); so.views = so.views.filter(v => v.id !== 'karte').concat([{ id: 'karte', on: true }]); so.view = 'karte'; T.ovSave(so); T.ovRender(); await tick(100);
    const body = d.getElementById('ov-body'), h0 = body.querySelector('.km');
    assert(h0 && h0.__cv, 'Karte im Overlay eingehängt');
    h0.__vb = [111, 222, 50, 40]; h0.__tl = 0; try{ w.eval('0'); }catch(e){}
    const c = h0.__cv; c.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    const s2 = T.ovLoad(); s2.kmSel = '30000142'; T.ovSave(s2); T.ovRender(); await tick(30);   // Update während gedrückter Taste
    assert(body.querySelector('.km') === h0, 'während gedrückter Taste wird nicht neu gebaut');
    w.dispatchEvent(new w.PointerEvent('pointerup', { bubbles: true, button: 0 })); await tick(80);
    const h1 = body.querySelector('.km');
    assert(h1 && h1 !== h0 && JSON.parse(h1.getAttribute('data-km')).sel === '30000142', 'nach dem Loslassen nachgeholt (neuer Zustand)');
    assert(!!h1.__cv && !!h1.querySelector('canvas'), 'nachgeholte Karte ist eingehängt (Leinwand da, kein leerer Rahmen)');
    // BO: Neuaufbau lange nach dem letzten Zoom (Kills/Standort-Update) → Ausschnitt bleibt, kein Sprung zum Charakter
    h1.__vb = [333, 444, 60, 48]; h1.__hov = 1; h1.__cv.dispatchEvent(new w.PointerEvent('pointermove', { bubbles: true, clientX: -900, clientY: -900 })); await tick(80);   // Hover weg → neu zeichnen (merkt den Ausschnitt)
    const now0 = w.Date.now; w.Date.now = () => now0() + 60000;
    const s3 = T.ovLoad(); s3.kmSel = '30002187'; T.ovSave(s3); T.ovRender(); await tick(80);
    const h2 = body.querySelector('.km'); w.Date.now = now0;
    assert(h2 && h2 !== h1 && h2.__vb.slice(0, 3).join() === '333,444,60', 'Neuaufbau nach 60 s behält den Ausschnitt (' + (h2 && h2.__vb.join()) + ')');
    // BO3: direkt nach eigenem Kippen kommt ein Neuaufbau mit der alten (gespeicherten) Neigung → eigene Neigung/Drehung bleibt
    h2.__tl = 0.9; h2.__rot = 0.5; h2.__tat = Date.now(); h2.__hov = 1; h2.__cv.dispatchEvent(new w.PointerEvent('pointermove', { bubbles: true, clientX: -900, clientY: -900 })); await tick(80);
    const s4 = T.ovLoad(); s4.kmSel = '30000142'; T.ovSave(s4); T.ovRender(); await tick(80);
    const h3 = body.querySelector('.km');
    assert(h3 && h3 !== h2 && Math.abs(h3.__tl - 0.9) < 1e-6 && Math.abs(h3.__rot - 0.5) < 1e-6, 'Neuaufbau direkt nach Kippen behält Neigung/Drehung (' + (h3 && [h3.__tl, h3.__rot]) + ')');
    // BT: System gewählt (Gleiten läuft) → Besitzer baut sofort neu → neues Fenster gleitet weiter zum Ziel
    const q = h3.querySelector('.km-q'); q.value = 'Tama'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick(60);
    q.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); const tv = h3.__tv && h3.__tv.slice();
    const s5 = T.ovLoad(); s5.kmSel = '30002813'; T.ovSave(s5); T.ovRender(); await tick(30);
    const h4 = body.querySelector('.km');
    assert(tv && h4 !== h3 && (h4.__tv || h4.__vb).slice(0, 2).map(x => x.toFixed(1)).join() === tv.slice(0, 2).map(x => x.toFixed(1)).join(), 'Neuaufbau während des Gleitens → gleitet weiter zum gewählten System (' + (h4.__tv || h4.__vb).slice(0, 2) + ' vs ' + (tv && tv.slice(0, 2)) + ')');
    console.log('\nALL KM NACHZIEHEN TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); console.log('FAILED'); process.exit(1); }
})();
