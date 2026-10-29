// WM1 (28.10.2026, Issue #8): Probe Scanner aus der Zwischenablage – Erkennung in main.js, Signaturen je System (neu/geändert/weg), Zuordnung, Kette
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const fn = n => new Function(main.match(new RegExp('function ' + n + '[\\s\\S]*?\\n}\\n'))[0] + 'return ' + n + ';')();
const SCAN = ['DCW-430\tCosmic Anomaly\tCombat Site\tGuristas Hideaway\t100.0%\t23.33 AU', 'DIZ-345\tCosmic Anomaly\tCombat Site\tGuristas Refuge\t100.0%\t3.06 AU',
  'SAT-218\tCosmic Anomaly\tCombat Site\tGuristas Hideaway\t100.0%\t21.72 AU', 'IDM-628\tCosmic Signature\t\t\t0.0%\t27.89 AU', 'IRM-820\tCosmic Signature\t\t\t0.0%\t21.63 AU',
  'ORR-840\tCosmic Signature\t\t\t0.0%\t25.65 AU', 'ZUW-425\tCosmic Signature\t\t\t0.0%\t19.90 AU'];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
  beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    // main.js: Probe-Text erkannt, vor Wertschätzer/Local; D-Scan, Local, Inventar nicht
    const lp = fn('looksLikeProbe'), ld = fn('looksLikeDscan'), la = fn('looksLikeAppraisal');
    assert(lp(SCAN.join('\r\n')) && !ld(SCAN.join('\n')) && !la(SCAN.join('\n')), 'main: Probe-Scanner-Text erkannt, kein D-Scan, kein Wertschätzer');
    assert(!lp('Pilot Eins\nPilot Zwei') && !lp('12345\tRifter\tRifter\t5 km') && !lp('Tritanium\t1000'), 'main: Local, D-Scan, Inventar sind kein Probe-Text');
    assert(main.indexOf("if (looksLikeProbe(t))") > 0 && main.indexOf("if (looksLikeProbe(t))") < main.indexOf("if (looksLikeAppraisal(t))") && /probePaste[\s\S]{0,40}S\.localWatch|S\.localWatch\) send\(\{ type: 'probePaste'/.test(main), 'main: Probe vor Wertschätzer, nur mit „Zwischenablage beobachten“');
    await tick(600);
    const T = w.__test, d = w.document;
    assert(/probePaste[^\n]*wmFromText/.test(html), 'Seite: probePaste → wmFromText');
    // Parser EN + DE
    let r = T.wmParse(SCAN.join('\n'));
    assert(r.length === 7 && r[0].an && r[0].k === 'combat' && r[0].nm === 'Guristas Hideaway' && r[3].k === '' && !r[3].an && r[3].p === 0, 'Parser: Anomalien/Kampf, unbekannte Signaturen');
    r = T.wmParse('ABC-123\tKosmische Signatur\tWurmloch\tInstabiles Wurmloch\t100,0 %\t5,2 AE\nXYZ-999\tKosmische Anomalie\tErzvorkommen\tOmber-Feld\t100,0 %\t1 AE');
    assert(r[0].k === 'wh' && r[0].p === 100 && r[1].an && r[1].k === 'ore', 'Parser: deutscher Client (Wurmloch, Erz, Komma)');
    assert(T.wmLooks(SCAN.join('\n')) && !T.wmLooks('Hallo Welt'), 'wmLooks');
    // ohne Standort und ohne gewähltes System: wartet auf „Übernehmen“
    await T.wmFromText(SCAN.join('\n'), false);
    let D = T.wmLoad();
    assert(D.pend && !Object.keys(D.sys).length && /Standort unbekannt/.test(T.wmHtml()), 'ohne Standort: Scan wartet, Hinweis');
    T.wmAction({ type: 'whMapSys', form: { wmsys: 'j111613' } });
    D = T.wmLoad();
    assert(D.cur === 'J111613' && Object.keys(D.sys.J111613.sg).length === 7 && D.sys.J111613.last.add.length === 7 && !D.pend, 'Übernehmen: 7 Signaturen in J111613, alle neu');
    // zweiter Scan: IDM-628 jetzt Wurmloch, ORR-840 und DCW-430 weg
    const S2 = SCAN.filter(l => !/^(ORR|DCW)/.test(l)).map(l => l.replace('IDM-628\tCosmic Signature\t\t\t0.0%', 'IDM-628\tCosmic Signature\tWormhole\tUnstable Wormhole\t100.0%'));
    await T.wmFromText(S2.join('\n'), false);
    D = T.wmLoad(); let L = D.sys.J111613.last, sg = D.sys.J111613.sg;
    assert(L.add.length === 0 && L.chg.join() === 'IDM-628' && L.gone.sort().join() === 'DCW-430,ORR-840' && sg['IDM-628'].k === 'wh', 'Zweiter Scan: geändert + weg, keine Doppel');
    // nur Signaturen kopiert (Anomalien ausgefiltert) → Anomalien bleiben aktiv
    await T.wmFromText(S2.filter(l => /Signature/.test(l)).join('\n'), false);
    sg = T.wmLoad().sys.J111613.sg;
    assert(!sg['DIZ-345'].gone && !sg['SAT-218'].gone && sg['IDM-628'].k === 'wh', 'Anomalien ausgefiltert ≠ verschwunden');
    let b = d.createElement('div'); b.innerHTML = T.wmHtml();
    assert(/J111613/.test(b.textContent) && /weg/.test(b.textContent) && b.querySelector('input[data-ova-change="whMapTo"][data-arg="IDM-628"]'), 'Ansicht: System, „weg“, Ziel-Feld am Wurmloch');
    // Ziel + Typ → Kette
    const J2 = Object.keys(JSON.parse(d.getElementById('wh-data').textContent).s).find(n => /^J\d{6}$/.test(n) && n !== 'J111613');
    T.wmAction({ type: 'whMapTo', key: 'IDM-628', arg: 'b274 ' + J2.toLowerCase() });
    sg = T.wmLoad().sys.J111613.sg;
    assert(sg['IDM-628'].ty === 'B274' && sg['IDM-628'].to === J2, 'Ziel-Feld: Typ und System erkannt');
    b.innerHTML = T.wmHtml();
    assert(/Kette/.test(b.textContent) && new RegExp('IDM-628 B274 → ' + J2).test(b.textContent), 'Kette: J111613 → IDM-628 B274 → ' + J2);
    // falsches System: Scan umhängen nimmt ihn im alten System zurück
    await T.wmFromText(['QQQ-111\tCosmic Signature\t\t\t0.0%\t1 AU'].join('\n'), false);
    assert(T.wmLoad().sys.J111613.sg['QQQ-111'], 'Scan landet im gewählten System');
    T.wmAction({ type: 'whMapSys', form: { wmsys: J2 } });
    D = T.wmLoad();
    assert(!D.sys.J111613.sg['QQQ-111'] && !D.sys.J111613.sg['IRM-820'].gone && D.sys[J2].sg['QQQ-111'] && D.cur === J2, 'Umhängen: altes System wie vorher, Scan im neuen');
    T.wmAction({ type: 'whMapPick', arg: 'J111613' });
    assert(T.wmLoad().cur === 'J111613', 'Kette: System anklicken wählt es');
    // echtes Overlay-Einzelfenster (?fenster=wurmloch): zeigt das HTML ohne Fehler, Ziel-Feld schickt Typ + Signatur ans Hauptfenster
    T.wmAction({ type: 'whMapPick', arg: 'J111613' }); const SH = {}, errs = [], sent = [], vh = T.wmHtml();
    const shost = { getSettings: () => Promise.resolve({}), setSettings: p => Promise.resolve(p), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ sent.push(a); }, resizeTo(){}, resizeEnd(){} };
    const sw = new JSDOM(html, { runScripts: 'dangerously', url: 'https://claude.ai/artifact/test?fenster=wurmloch', pretendToBeVisual: true,
      beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline')); x.evecoreHost = shost; x.addEventListener('error', e => errs.push(e.message)); } }).window;
    await tick(400);
    SH.cmd({ type: 'view', data: { title: 'wurmloch', html: vh, look: {} } });
    await tick(60);
    const inp = sw.document.querySelector('input[data-ova-change="whMapTo"]');
    assert(inp && !errs.length && !/Fehler beim Zeichnen/.test(sw.document.getElementById('ov-body').textContent), 'Einzelfenster: Ansicht ohne Fehler ' + (errs[0] || ''));
    inp.value = 'C247'; inp.dispatchEvent(new sw.Event('change', { bubbles: true }));
    assert(sent.some(a => a.type === 'whMapTo' && a.key === 'IDM-628' && a.arg === 'C247'), 'Einzelfenster: Ziel-Feld → satAction mit Signatur');
    sw.close();
    // Kette neu: erst nachfragen
    T.wmAction({ type: 'whMapNew' });
    assert(Object.keys(T.wmLoad().sys).length === 2 && /Wirklich alles löschen/.test(T.wmHtml()), 'Kette neu: fragt erst');
    T.wmAction({ type: 'whMapNewOk' });
    assert(!Object.keys(T.wmLoad().sys).length, 'Kette neu: gelöscht');
    // Seite/Overlay: Abschnitt steckt in der Wurmloch-Ansicht
    b = d.createElement('div'); T.ovRenderWormhole(b);
    assert(b.querySelector('[data-ova="whMapClip"]') && /Probe Scanner/.test(b.textContent), 'Wurmloch-Ansicht (Seite + Overlay) zeigt den Abschnitt');
    console.log('ALL TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
