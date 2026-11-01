// WM5 (30.10.2026, Issue #8 Stufe 5): Status je Loch (EOL/Masse), Restzeit nur geschätzt, „vermutlich zu“, Suche, Overlay-Pfad Heim → hier
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
    const T = w.__test, d = w.document, H = 3600000, now = Date.now();
    const J = Object.keys(JSON.parse(d.getElementById('wh-data').textContent).s).filter(n => /^J\d{6}$/.test(n)).slice(0, 4);
    const sg = (k, to, extra) => Object.assign({ an: false, k: k, t: '', nm: '', p: 100, f: now, l: now, to: to || '' }, extra || {});
    // Schätzung: Typ-Lebensdauer ab erstem Scan, EOL = 4 Std., EVE-Scout-Ablauf geht vor, abgelaufen = vermutlich zu, ohne Typ = nichts
    const B = T.wmLife({ ty: 'B274', f: now - 2 * H }, now);
    assert(B && !B.zu && /noch ≤ ~22 Std\. \(geschätzt\)/.test(B.txt), 'Restzeit aus Typ: ' + B.txt);
    assert(T.wmLife({ ty: 'B274', f: now - 25 * H }, now).zu, 'älter als Lebensdauer: vermutlich zu');
    assert(/~3 Std/.test(T.wmLife({ ty: 'B274', f: now, st: 'eol', stT: now - 1.5 * H }, now).txt), 'EOL: 4 Std. ab Markierung');
    assert(/~2 Std/.test(T.wmLife({ ex: new Date(now + 1.2 * H).toISOString(), ty: 'B274', f: now }, now).txt), 'EVE-Scout-Ablauf geht vor');
    assert(T.wmLife({ f: now }, now) === null, 'ohne Typ keine Schätzung');
    // Kette J0 → J1 → J2, dazu J0 → J3
    const D = { cur: J[1], sys: {} };
    D.sys[J[0]] = { sg: { 'AAA-111': sg('wh', J[1], { ty: 'B274' }), 'BBB-222': sg('wh', J[3]) } };
    D.sys[J[1]] = { sg: { 'CCC-333': sg('wh', J[2], { ty: 'C247' }), 'DDD-444': sg('data', '', { nm: 'Unsecured Frontier Server' }), 'EEE-555': sg('', '') } };
    w.localStorage.setItem('eve-zentrale-whmap-v1', JSON.stringify(D));
    assert(T.wmPath(T.wmLoad()).map(x => x[0] + ':' + x[1]).join(' ') === J[0] + ': ' + J[1] + ':AAA-111', 'Pfad Wurzel → hier');
    // Status setzen (wie aus dem Overlay: key = Signatur, arg = Wert)
    T.wmAction({ type: 'whMapSt', key: 'CCC-333', arg: 'crit' });
    const o = T.wmLoad().sys[J[1]].sg['CCC-333'];
    assert(o.st === 'crit' && o.stT >= now, 'Status gespeichert mit Zeit');
    const b = d.createElement('div'); b.innerHTML = T.wmHtml(true);
    const sel = b.querySelector('select[data-ova-change="whMapSt"][data-arg="CCC-333"]');
    assert(sel && sel.value === 'crit' && /Masse kritisch/.test(sel.selectedOptions[0].textContent), 'Liste: Status-Auswahl zeigt Masse kritisch');
    assert(/noch ≤ ~24 Std\. \(geschätzt\)/.test(b.textContent) && !b.querySelector('select[data-arg="DDD-444"]'), 'Liste: Schätzung am Loch, keine Auswahl an Daten-Signatur');
    assert([...b.querySelectorAll('.wm-e')].find(e => e.getAttribute('data-b') === J[2]).classList.contains('wm-crit'), 'Karte: kritische Linie markiert');
    T.wmAction({ type: 'whMapSt', key: 'CCC-333', arg: '' });
    assert(!T.wmLoad().sys[J[1]].sg['CCC-333'].st && !T.wmLoad().sys[J[1]].sg['CCC-333'].stT, 'Status zurück auf ?');
    // Suche
    T.wmAction({ type: 'whMapQ', arg: 'frontier' });
    b.innerHTML = T.wmHtml(true);
    assert(b.textContent.includes('DDD-444') && !b.textContent.includes('EEE-555') && /3<\/b> aktiv/.test(T.wmHtml(true)), 'Suche filtert die Liste, Zähler bleiben');
    T.wmAction({ type: 'whMapQ', arg: 'gibtsnicht' });
    assert(/Keine Signatur passt/.test(T.wmHtml(true)), 'Suche ohne Treffer: Hinweis');
    T.wmAction({ type: 'whMapQ', arg: '' });
    // Overlay: Pfad statt Baum, ganze Kette auf Knopf
    b.innerHTML = T.wmHtml();
    const path = b.querySelector('.wm-path');
    assert(path && /AAA-111/.test(path.textContent) && !b.textContent.includes('BBB-222 →') && b.querySelector('[data-ova="whMapTree"]').textContent === 'ganze Kette', 'Overlay: nur Pfad, Knopf „ganze Kette“');
    T.wmAction({ type: 'whMapTree' });
    b.innerHTML = T.wmHtml();
    assert(b.textContent.includes('BBB-222') && b.querySelector('[data-ova="whMapTree"]').textContent === 'nur Pfad', 'Overlay: ganze Kette');
    T.wmAction({ type: 'whMapTree' });
    // abgelaufenes Loch: im Pfad markiert, Liste rot „vermutlich zu“
    const D2 = T.wmLoad(); D2.sys[J[0]].sg['AAA-111'].f = now - 30 * H; w.localStorage.setItem('eve-zentrale-whmap-v1', JSON.stringify(D2));
    b.innerHTML = T.wmHtml();
    assert(b.querySelector('.wm-path .wm-zu'), 'Pfad: abgelaufenes Loch markiert');
    T.wmAction({ type: 'whMapPick', arg: J[0] }); b.innerHTML = T.wmHtml(true);
    assert([...b.querySelectorAll('.neg')].some(x => x.textContent === 'vermutlich zu') && b.querySelector('.wm-e.wm-zu'), 'Liste + Karte: vermutlich zu');
    // echtes Overlay-Einzelfenster: Status-Auswahl schickt Signatur + Wert
    const SH = {}, errs = [], sent = [], vh = T.wmHtml();
    const shost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ sent.push(a); }, resizeTo(){}, resizeEnd(){} };
    const sw = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=wurmloch', pretendToBeVisual: true,
      beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline')); x.evecoreHost = shost; x.addEventListener('error', e => errs.push(e.message)); } }).window;
    await tick(400);
    SH.cmd({ type: 'view', data: { title: 'wurmloch', html: vh, look: {} } });
    await tick(60);
    const s2 = sw.document.querySelector('select[data-ova-change="whMapSt"]');
    assert(s2 && !errs.length && !/Fehler beim Zeichnen/.test(sw.document.getElementById('ov-body').textContent), 'Einzelfenster: ohne Fehler ' + (errs[0] || ''));
    s2.value = 'eol'; s2.dispatchEvent(new sw.Event('change', { bubbles: true }));
    assert(sent.some(a => a.type === 'whMapSt' && a.key === s2.getAttribute('data-arg') && a.arg === 'eol'), 'Einzelfenster: Status → satAction');
    sw.close();
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e.message); process.exitCode = 1; }
  finally { w.close(); }
})();
