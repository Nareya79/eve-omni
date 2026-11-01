// WM3 (30.10.2026, Issue #8 Stufe 1): Wurmloch-Kette als Karte (SVG) auf der großen Seite – Anordnung, Zuklappen, Ziehen, Rechtsklick, Overlay bleibt Text
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const T = w.__test, d = w.document;
    const J = Object.keys(JSON.parse(d.getElementById('wh-data').textContent).s).filter(n => /^J\d{6}$/.test(n)).slice(0, 4);
    const sg = (k, to, extra) => Object.assign({ an: false, k: k, t: '', nm: '', p: 100, f: 1, l: 1, to: to || '' }, extra || {});
    // Heim J0 → J1 (B274) und J0 → J2 (EVE-Scout), J1 → J3; J1 hat eine offene Signatur
    const D = { cur: J[1], sys: {} };
    D.sys[J[0]] = { sg: { 'AAA-111': sg('wh', J[1], { ty: 'B274' }), 'BBB-222': sg('wh', J[2], { src: 'EVE-Scout' }) } };
    D.sys[J[1]] = { sg: { 'CCC-333': sg('wh', J[3]), 'DDD-444': sg('', '') } };
    w.localStorage.setItem('eve-zentrale-whmap-v1', JSON.stringify(D));
    let L = T.wmLayout(T.wmLoad());
    assert(Object.keys(L.n).length === 4 && L.e.length === 3, 'Anordnung: 4 Systeme, 3 Verbindungen');
    assert(L.n[J[0]].x < L.n[J[1]].x && L.n[J[1]].x < L.n[J[3]].x && L.n[J[1]].x === L.n[J[2]].x && L.n[J[1]].y !== L.n[J[2]].y, 'Anordnung: links nach rechts, Geschwister untereinander');
    assert(L.n[J[0]].y > L.n[J[1]].y && L.n[J[0]].y < L.n[J[2]].y, 'Anordnung: Eltern mittig vor den Kindern');
    // Overlay (ohne big) bleibt Text-Baum, große Seite zeigt SVG
    assert(!/wm-map/.test(T.wmHtml()) && /class="wm-map"><svg/.test(T.wmHtml(true)), 'Overlay Text, Seite SVG');
    const panel = d.getElementById('panel-wormhole'); panel.classList.add('active');
    T.wmAction({ type: 'whMapPick', arg: J[1] });
    const box = d.getElementById('wh-page'), nodes = () => [...box.querySelectorAll('.wm-n')], node = s => nodes().find(g => g.getAttribute('data-arg') === s);
    assert(nodes().length === 4 && box.querySelectorAll('.wm-e').length === 3 && node(J[1]).classList.contains('cur'), 'Seite: 4 Knoten, 3 Linien, aktuelles System markiert');
    assert(box.querySelector('.wm-e.wm-sc') && box.querySelector('.wm-e.wm-sc').getAttribute('data-b') === J[2], 'EVE-Scout-Verbindung gestrichelt');
    assert(/AAA-111 B274/.test(box.querySelector('.wm-map svg').textContent) && /1 offen \/ 2/.test(node(J[1]).textContent), 'Beschriftung: Signatur + Typ, offen/gesamt');
    // Klick auf Knoten wählt das System
    node(J[3]).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert(T.wmLoad().cur === J[3] && node(J[3]).classList.contains('cur'), 'Klick wählt System');
    // Zuklappen: J1 hat ein Kind → Knopf; danach J3 weg, Knopf zeigt +1
    node(J[1]).querySelector('.wm-f').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert(T.wmLoad().fold[J[1]] && !node(J[3]) && /\+1/.test(node(J[1]).querySelector('.wm-f').textContent) && T.wmLoad().cur === J[3], 'Ast zuklappen (wählt nicht)');
    node(J[1]).querySelector('.wm-f').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    assert(!T.wmLoad().fold[J[1]] && node(J[3]), 'Ast aufklappen');
    // Ziehen: Knoten wandert, Linie zieht mit, Lage gespeichert, Klick danach wählt nicht
    const ev = (t, x, y, b) => new w.MouseEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0, buttons: b });
    const g2 = node(J[2]); g2.dispatchEvent(ev('pointerdown', 100, 100, 1)); g2.dispatchEvent(ev('pointermove', 160, 140, 1));
    const ed = [...box.querySelectorAll('.wm-e')].find(e => e.getAttribute('data-b') === J[2]);
    assert(/translate\(\d+,\d+\)/.test(g2.getAttribute('transform')) && ed.querySelector('path').getAttribute('d').endsWith((L.n[J[2]].x + 60) + ' ' + (L.n[J[2]].y + 40 + 33)), 'Ziehen: Linie zieht live mit');
    g2.dispatchEvent(ev('pointerup', 160, 140, 0)); await tick(20); node(J[2]).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    let P = T.wmLoad().pos[J[2]];
    assert(P && P[0] === L.n[J[2]].x + 60 && P[1] === L.n[J[2]].y + 40 && T.wmLoad().cur === J[3], 'Ziehen: Lage gespeichert, Klick danach geschluckt');
    assert(T.wmLayout(T.wmLoad()).n[J[2]].x === P[0], 'Lage bleibt beim Neuzeichnen');
    // Rechtsklick Knoten: Lage zurücksetzen
    node(J[2]).dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    let m = d.getElementById('wm-ctx'), btn = t => [...m.querySelectorAll('button')].find(b => b.textContent === t);
    assert(m && btn('Lage zurücksetzen') && btn('Alle Lagen zurücksetzen'), 'Rechtsklick Knoten: Menü');
    btn('Lage zurücksetzen').click(); await tick(20);
    assert(!d.getElementById('wm-ctx') && !(T.wmLoad().pos || {})[J[2]], 'Lage zurückgesetzt');
    // Rechtsklick Linie: Verbindung löschen
    const e3 = [...box.querySelectorAll('.wm-e')].find(e => e.getAttribute('data-b') === J[3]);
    e3.querySelector('path').dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    m = d.getElementById('wm-ctx'); btn('Verbindung löschen').click(); await tick(20);
    assert(!T.wmLoad().sys[J[1]].sg['CCC-333'].to && !node(J[3]) && box.querySelectorAll('.wm-e').length === 2, 'Verbindung gelöscht');
    // ohne Verbindungen keine Karte
    T.wmAction({ type: 'whMapNewOk' });
    assert(!box.querySelector('.wm-map'), 'Kette neu: Karte weg');
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e.message); process.exitCode = 1; }
  finally { w.close(); }
})();
