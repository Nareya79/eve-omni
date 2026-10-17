// BB22 (30.09.2026): Overlay reagiert schlecht auf Klicks – Neuzeichnen zwischen Maus-Drücken und Loslassen ersetzte den Knopf,
// der Klick ging verloren. Jetzt: während die Taste gedrückt ist, wartet das Neuzeichnen und kommt direkt nach dem Loslassen.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(800);
    const T = w.__test, d = w.document;
    const root = d.createElement('div'); d.body.appendChild(root);
    root.innerHTML = '<button type="button" id="k1">alt</button>';
    const ev = (t, type) => t.dispatchEvent(new w.Event(type, { bubbles: true }));
    // gedrückt: Neuzeichnen wartet
    ev(d.getElementById('k1'), 'pointerdown');
    T.ovFormKeep(root, () => { root.innerHTML = '<button type="button" id="k1">neu</button>'; });
    assert(root.textContent === 'alt', 'BB22: bei gedrückter Maustaste bleibt der Knopf stehen');
    // Loslassen: click kommt noch am alten Knopf an, danach wird sofort nachgeholt
    let clicked = false; d.getElementById('k1').addEventListener('click', () => { clicked = true; });
    ev(d.getElementById('k1'), 'pointerup'); d.getElementById('k1').click();
    assert(clicked && root.textContent === 'alt', 'BB22: der Klick landet am gedrückten Knopf');
    await tick(20);
    assert(root.textContent === 'neu', 'BB22: direkt nach dem Loslassen wird neu gezeichnet (nicht erst nach 250 ms)');
    // Druck woanders (anderes Fenster-Teil) hält dieses Overlay nicht auf
    const other = d.createElement('div'); d.body.appendChild(other); ev(other, 'pointerdown');
    T.ovFormKeep(root, () => { root.innerHTML = '<b>3</b>'; });
    assert(root.textContent === '3', 'BB22: Druck außerhalb blockiert nicht');
    ev(other, 'pointerup'); await tick(20);
    // hängengebliebener Druck (Loslassen außerhalb nicht gemeldet) blockiert höchstens 3 s
    ev(root.firstChild, 'pointerdown');
    T.ovFormKeep(root, () => { root.innerHTML = '<b>4</b>'; });
    assert(root.textContent === '3', 'BB22: gedrückt – wartet');
    await tick(3400);
    assert(root.textContent === '4', 'BB22: nach spätestens 3 s wird trotzdem gezeichnet');
    // echtes Einzelfenster (?fenster=…): dort verlässt der Start den Code früh – der Schutz muss trotzdem greifen
    const SH = {};
    const sw = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test?fenster=trades', pretendToBeVisual:true, beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline'));
      x.evecoreHost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ (SH.a = SH.a || []).push(a); }, resizeTo(){}, resizeEnd(){} }; } }).window;
    await tick(400);
    const sd = sw.document, sbody = sd.getElementById('ov-body');
    SH.cmd({ type: 'view', data: { title: 'Trades', html: '<button type="button" data-ova="trUpd" data-arg="all" id="u">Prüfen</button>', foot: {} } });
    const sev = (t, type) => t.dispatchEvent(new sw.Event(type, { bubbles: true }));
    const btn = sd.getElementById('u'); sev(btn, 'pointerdown');
    SH.cmd({ type: 'view', data: { title: 'Trades', html: '<button type="button" data-ova="trUpd" data-arg="all" id="u">Prüfen</button><i>neu</i>', foot: {} } });
    assert(sd.getElementById('u') === btn, 'BB22: Einzelfenster – gedrückter Knopf wird nicht ersetzt');
    sev(btn, 'pointerup'); btn.click(); await tick(30);
    assert((SH.a || []).some(a => a.type === 'trUpd') && /neu/.test(sbody.textContent), 'BB22: Einzelfenster – Klick kommt an, neuer Inhalt danach');
    // BB25: Rechtsklick-Menü (Uhr im OmniCom) liegt im Zieh-Bereich des Fensters – ohne no-drag schluckt Windows die Klicks
    assert(/\.ov-ctx,\.ov-ctx \*\{-webkit-app-region:no-drag\}/.test(html) && !/html\.sat-neo #ov-body\{-webkit-app-region:drag\}/.test(html), 'BB25: Menü-Knöpfe nie im Zieh-Bereich (OmniCom zieht seit 06.10. selbst)');
    // BB32: Enter in mehrzeiligen Feldern (Notizen) = neue Zeile, nicht der Standard-Knopf
    const nf = d.createElement('div'); nf.innerHTML = '<div class="ov-form"><textarea data-ovf="n1"></textarea><button type="button" data-ova="noteRen" data-ova-default>Umbenennen</button><input data-ovf="x"></div>'; d.body.appendChild(nf);
    const got = []; T.ovFormWire(nf, a => got.push(a.type));
    const kd = el => { const e = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    assert(!kd(nf.querySelector('textarea')) && !got.length, 'BB32: Enter im Textfeld bleibt eine neue Zeile');
    assert(kd(nf.querySelector('input')) && got[0] === 'noteRen', 'BB32: Enter im einzeiligen Feld löst weiter den Standard-Knopf aus');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.message); process.exit(1); }
  process.exit(0);
})();
