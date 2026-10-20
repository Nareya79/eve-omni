// OmniCom als eigenes Overlay-Fenster (Programm): Symbolleiste mit allen Bereichen, Klick = Overlay-Fenster ein/aus,
// Rechtsklick / Bereiche ohne Overlay = grosse Ansicht; Einzelfenster-Modus ?fenster=neocom; Einstellung "Overlays nur ueber EVE".
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(url, host){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url, pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */ w.fetch = () => Promise.reject(new Error('offline')); if (host) w.evecoreHost = host; } }).window;
}
(async () => {
  try{
    let S = { transparent: false, alwaysOnTop: true, overlayOnlyEve: true, fgHelper: 'ok', hotkeys: {}, hotkeyStatus: {}, backup: {}, windows: { neocom: { open: true } } };
    const H = { pub: {}, patches: [], main: 0, modes: [] };
    const host = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))),
      setSettings: p => { H.patches.push(p); Object.keys(p).forEach(k => { if (k === 'windows') Object.keys(p.windows).forEach(v => S.windows[v] = Object.assign({}, S.windows[v], p.windows[v])); else S[k] = p[k]; }); return Promise.resolve(JSON.parse(JSON.stringify(S))); },
      publishView: (id, data) => { H.pub[id] = data; }, onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(m){ H.modes.push(m); }, showMain(){ H.main++; H.vis = true; },
      mainState: () => Promise.resolve({ visible: !!H.vis, mode: 'full' }), quitApp(){ H.quit = (H.quit || 0) + 1; }, toggleBrowser(){ H.br = (H.br || 0) + 1; }, openBrowser(){}, hide(){ H.hidden = (H.hidden || 0) + 1; H.vis = false; } };
    let w = makeWindow('https://claude.ai/artifact/test', host); await tick(700);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    T.ovPublishSatellites(); await tick(80);
    const nc = H.pub.neocom;
    assert(nc && nc.title === 'OmniCom', 'OmniCom-Fenster bekommt seine Symbolleiste');
    const tmp = d.createElement('div'); tmp.innerHTML = nc.html;
    const ids = [...tmp.querySelectorAll('[data-neo]')].map(b => b.getAttribute('data-neo')).filter(x => x !== 'clock' && x !== 'mode');   // X3: Uhr steht davor
    assert(ids.length === 38 && ids.indexOf('fits') >= 0 && ids.indexOf('orders') < 0 && ids.indexOf('timer') < 0 && ids.indexOf('workbench') === ids.indexOf('piplan') + 1 && ids.indexOf('prod') === ids.indexOf('workbench') + 1 && ids.indexOf('game') === ids.indexOf('music') + 1 && ids.indexOf('mail') >= 0 && ids.indexOf('market') >= 0 && ids.indexOf('home') >= 0 && ids.indexOf('wormhole') >= 0 && ids.indexOf('dscan') === ids.indexOf('perf') + 1 && ids.indexOf('scanplan') === ids.indexOf('dscan') + 1 && ids.indexOf('appraisal') >= 0 && ids.indexOf('notes') >= 0 && ids.indexOf('perf') >= 0 && ids.indexOf('main') === ids.length - 3 && ids.indexOf('radar') >= 0 && ids.indexOf('pi') >= 0 && ids.indexOf('report') >= 0 && ids.indexOf('map') >= 0 && ids.indexOf('alarm') >= 0 && ids[0] === 'station' && ids.indexOf('assets') >= 0 && ids.indexOf('intel') >= 0 && ids[ids.length - 2] === 'settings' && ids[ids.length - 1] === 'quit', 'Alle Bereiche in OmniCom-Reihenfolge (mit Assets, Intel, Einstellungen; AL5: Orders steckt unter Trading): ' + ids.join());
    assert(tmp.querySelector('[data-neo="intel"] svg') && /Local Report/.test(tmp.querySelector('[data-neo="intel"]').textContent), 'Gleiche Symbole und Namen wie das OmniCom');
    assert(tmp.querySelector('[data-neo="intel"]').getAttribute('data-name') === 'Local Report' && /große Ansicht/.test(tmp.querySelector('[data-neo="settings"]').getAttribute('data-hint')), 'Jedes Symbol trägt Namen und Hinweis für den Tooltip');
    assert(!ids.includes('account'), 'Konto ist anfangs nicht im OmniCom-Overlay');
    // BB12: jede Overlay-Ansicht hat ein OmniCom-Symbol (Ausnahme: das OmniCom selbst; Gang-Report/Radar/Karte haben eigene)
    const noIcon = Object.keys(T.ovViews()).filter(v => v !== 'neocom' && !T.ovTitleIcon(v));
    assert(!noIcon.length && ids.includes('dscan') && ids.includes('scanplan'), 'BB12: jede Overlay-Ansicht hat ein OmniCom-Symbol (fehlt: ' + noIcon.join() + ')');
    // P2: offen-Markierung auch fuer Browser und die im grossen Fenster gezeigte Seite
    const onOf = id => { const t = d.createElement('div'); t.innerHTML = H.pub.neocom.html; return t.querySelector('[data-neo="' + id + '"]'); };
    T.switchTab('wallet'); await tick(80);
    assert(onOf('wallet').classList.contains('on') && onOf('wallet').getAttribute('data-hint') === 'offen' && !onOf('station').classList.contains('on'), 'P2: offene Seite (Wallet) ist markiert');   // AL5: Orders hat kein Symbol mehr
    H.cmd({ type: 'browserOpen', open: true }); await tick(80);
    assert(onOf('browser').classList.contains('on'), 'P2: Browser offen -> markiert');
    H.cmd({ type: 'browserOpen', open: false }); await tick(80);
    assert(!onOf('browser').classList.contains('on'), 'P2: Browser zu -> nicht markiert');
    T.switchTab('station'); await tick(80);
    // T18/PR2: Ziehen im Overlay = einfügen, die anderen rücken weiter; gilt für Overlay und OmniCom-Leiste
    const ovOrder = () => [...(() => { const t = d.createElement('div'); t.innerHTML = H.pub.neocom.html; return t; })().querySelectorAll('[data-neo]')].map(b => b.getAttribute('data-neo')).filter(x => x !== 'clock' && x !== 'mode');
    const o0 = ovOrder();
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neoIns', a: o0[0], b: o0[3] } }); await tick(80);
    let sw = ovOrder();
    assert(sw.slice(0, 4).join() === [o0[1], o0[2], o0[3], o0[0]].join() && sw.slice(4).join() === o0.slice(4).join() && d.querySelector('#neocom > .neo-btn').id === 'neo-btn-' + o0[1], 'PR2: nach hinten einfügen, Rest rückt auf, hinten bleibt alles gleich | ' + o0.slice(0,8).join() + ' → ' + sw.slice(0,8).join() + ' | erster ' + d.querySelector('#neocom > .neo-btn').id);
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neoIns', a: o0[0], b: o0[1] } }); await tick(80);
    assert(ovOrder().join() === o0.join(), 'PR2: nach vorne einfügen stellt die alte Reihenfolge wieder her');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neoIns', a: 'station', b: 'settings' } }); await tick(80);
    assert(d.querySelector('#neocom > .neo-btn').id === 'neo-btn-station', 'T18: Einstellungen bleiben unten, zurückgetauscht');
    // Auswahl der Symbole (Einstellungen)
    const picks = [...d.querySelectorAll('#neo-order [data-neo-pick]')];
    assert(picks.length === 39 && !picks.find(c => c.getAttribute('data-neo-pick') === 'orders') && !picks.find(c => c.getAttribute('data-neo-pick') === 'account') && picks.find(c => c.getAttribute('data-neo-pick') === 'assets').checked, 'Einstellungen: Liste aller Symbole zum An-/Abwählen');
    const pa = picks.find(c => c.getAttribute('data-neo-pick') === 'assets'); pa.checked = false; pa.onchange();
    // Konto gibt es im OmniCom nicht mehr (Einstellungen › Konto)
    await tick(80);
    const t3 = d.createElement('div'); t3.innerHTML = H.pub.neocom.html;
    const ids3 = [...t3.querySelectorAll('[data-neo]')].map(b => b.getAttribute('data-neo')).filter(x => x !== 'clock' && x !== 'mode');
    assert(!ids3.includes('assets') && !ids3.includes('account') && JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1')).neoHide.indexOf('assets') >= 0, 'Abgewählte Symbole verschwinden sofort aus dem Overlay, gespeichert');
    pa.checked = true; pa.onchange();
    // P1: Overlay-Symbole haben Pfeile, Reihenfolge gilt im Overlay
    const rrow = [...d.querySelectorAll('#neo-order .neo-row')].find(r => r.querySelector('[data-neo-pick="report"]'));
    rrow.querySelector('button[title="nach oben"]').onclick(); await tick(80);
    const t4 = d.createElement('div'); t4.innerHTML = H.pub.neocom.html;
    const ids4 = [...t4.querySelectorAll('[data-neo]')].map(b => b.getAttribute('data-neo')).filter(x => x !== 'clock' && x !== 'mode');
    assert(ids4.indexOf('report') === ids4.indexOf('alarm') - 1 && !d.getElementById('neo-btn-report'), 'P1: Gang-Report per ↑ vor Gang-Alarm, gilt im Overlay, nicht in der Leiste');
    d.getElementById('neo-order-reset').onclick(); await tick(80);
    // Overlay-Stil
    assert(d.documentElement.classList.contains('ov-eve') && $('ovs-style').value === 'eve' && H.pub.neocom.look.style === 'eve', 'Overlay-Stil „EVE“ ist Standard');
    $('ovs-style').value = 'omni'; $('ovs-style').onchange(); await tick(80);
    assert(!d.documentElement.classList.contains('ov-eve') && d.documentElement.classList.contains('ov-omni') && H.pub.neocom.look.style === 'omni', 'UU5: umschaltbar auf den Stil „EVE Omni“ (wie Homepage, auch für Einzelfenster)');
    assert(![...$('ovs-style').options].some(o => o.value === 'core'), 'UU5: alter Stil „EVE Omni (bisheriges Aussehen)“ entfernt');
    $('ovs-style').value = 'eve'; $('ovs-style').onchange(); await tick(80);
    // Klick auf Intel -> Local-Fenster an
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'intel', big: false } }); await tick(150);
    assert(S.windows.local && S.windows.local.open === true, 'Klick auf „Intel“ öffnet das Overlay-Fenster „Local“');
    T.ovPublishSatellites(); await tick(80);
    const tmp2 = d.createElement('div'); tmp2.innerHTML = H.pub.neocom.html;
    assert(tmp2.querySelector('[data-neo="intel"]').classList.contains('on'), 'Symbol leuchtet, solange das Fenster offen ist');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'intel', big: false } }); await tick(150);
    assert(S.windows.local.open === false, 'Nochmal klicken schließt es wieder');
    // U6: Karte genauso auf/zu
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'map', big: false } }); await tick(150);
    assert(S.windows.karte && S.windows.karte.open === true, 'U6: Klick auf „Karte“ öffnet das Karten-Overlay');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'map', big: false } }); await tick(150);
    assert(S.windows.karte.open === false, 'U6: nochmal klicken schließt das Karten-Overlay');
    // Orders -> grosse Ansicht (N6: Assets hat jetzt ein eigenes Overlay)
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'orders', big: false } }); await tick(100);
    assert(H.main === 1 && $('panel-station').classList.contains('active') && !$('orders-view').hidden, 'Orders (ohne Overlay): große Ansicht öffnet sich bei Orders');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'haul', big: true } }); await tick(100);
    assert(H.main === 2 && $('panel-intensiv').classList.contains('active') && !(S.windows.handel && S.windows.handel.open), 'Rechtsklick auf Handel: große Handel-Suche statt Overlay');
    // Einstellungen-Symbol: 1. Klick oeffnet das Hauptfenster bei Einstellungen, 2. Klick schliesst es wieder
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'settings', big: false } }); await tick(100);
    assert(H.vis && $('panel-settings').classList.contains('active'), 'OmniCom-Einstellungen: öffnet das Hauptfenster bei den Einstellungen');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'settings', big: false } }); await tick(100);
    assert(H.hidden === 1 && !H.vis, 'Nochmal klicken: Hauptfenster geht wieder zu');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'browser', big: false } }); await tick(50);
    assert(H.br === 1, 'L5: Browser-Knopf schaltet den Browser um (auf/zu macht das Programm)');
    // Q6: EVECore-Knopf – zu -> Programmfenster auf, offen -> ausblenden
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'main', big: false } }); await tick(80);
    assert(H.vis && H.hidden === 1, 'Q6: EVECore-Knopf öffnet das Programmfenster');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'main', big: false } }); await tick(80);
    assert(!H.vis && H.hidden === 2, 'Q6: nochmal klicken blendet es aus');
    H.hidden = 1;
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'radar', big: false } }); await tick(150);
    assert(S.windows.radar && S.windows.radar.open === true, 'M1: Radar im OmniCom-Overlay öffnet das Radar-Fenster');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'radar', big: false } }); await tick(150);
    assert(S.windows.radar.open === false, 'M1: nochmal klicken schließt es');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'settings', big: false } }); await tick(100);
    assert(H.vis && H.hidden === 1, 'Dritter Klick: wieder offen');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'orders', big: false } }); await tick(100);
    assert(H.vis && H.hidden === 1 && $('panel-station').classList.contains('active') && !$('orders-view').hidden, 'Offen bei Einstellungen, Klick auf Orders: wechselt nur den Bereich');
    // Beenden: erst rot "Wirklich?", zweiter Klick beendet
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'quit', big: false } }); await tick(80);
    const tq = d.createElement('div'); tq.innerHTML = H.pub.neocom.html;
    assert(!H.quit && tq.querySelector('[data-neo="quit"]').classList.contains('arm') && /Wirklich\?/.test(tq.querySelector('[data-neo="quit"]').textContent), 'Beenden: erster Klick fragt nach (Knopf rot „Wirklich?“)');
    H.cmd({ type: 'satAction', view: 'neocom', action: { type: 'neo', target: 'quit', big: false } }); await tick(50);
    assert(H.quit === 1, 'Zweiter Klick beendet EVECore');
    $('neo-quit').onclick();
    assert($('neo-quit').classList.contains('arm') && H.quit === 1, 'Auch im OmniCom der großen Ansicht: Beenden mit Nachfrage');
    await tick(4200);
    assert(!$('neo-quit').classList.contains('arm'), 'Ohne zweiten Klick geht die Nachfrage nach 4 Sekunden weg');
    // Einstellungen
    assert($('hs-neowin').checked && $('hs-onlyeve').checked && /aktiv/.test($('hs-onlyeve-st').textContent), 'Einstellungen › Programm: OmniCom-Fenster und „nur über EVE“ angezeigt');
    $('hs-onlyeve').checked = false; $('hs-onlyeve').onchange(); await tick(50);
    assert(S.overlayOnlyEve === false, '„Overlays nur über EVE“ abschaltbar');
    $('hs-neowin').checked = false; $('hs-neowin').onchange(); await tick(50);
    assert(S.windows.neocom.open === false, 'OmniCom-Fenster abschaltbar');
    assert($('hs-taskbar').checked, 'T21: Taskleisten-Symbol ist anfangs an');
    $('hs-taskbar').checked = false; $('hs-taskbar').onchange(); await tick(50);
    assert(S.taskbar === false && !$('hs-taskbar').checked, 'T21: Schalter „Symbol in der Taskleiste“ geht ans Programm');
    w.close();
    // Einzelfenster-Modus
    const SH = { sat: [] };
    const shost = { getSettings: () => Promise.resolve({ windows: {} }), setSettings: () => Promise.resolve({}), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ SH.sat.push(a); }, satDrag(p){ SH.sat.push({ drag: p }); }, closeSelf(){}, resizeTo(){}, resizeEnd(){} };
    shost.neoLog = t => { SH.log = t; };
    w = makeWindow('https://claude.ai/artifact/test?fenster=neocom', shost); await tick(400);
    d = w.document;
    assert(d.documentElement.classList.contains('sat-neo'), 'Fenster ?fenster=neocom ist die schlanke Symbolleiste');
    SH.cmd({ type: 'view', data: nc }); await tick(50);
    const ib = d.querySelector('#ov-body [data-neo="intel"]');
    ib.click();
    ib.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    assert(SH.sat.length === 2 && SH.sat[0].target === 'intel' && !SH.sat[0].big && SH.sat[1].big, 'Klick und Rechtsklick gehen ans Hauptfenster');
    assert(d.documentElement.classList.contains('ov-eve'), 'Einzelfenster übernimmt den EVE-Stil');
    const ob = d.getElementById('ov-body');
    const lay = (wd, ht) => { Object.defineProperty(ob, 'clientWidth', { configurable: true, value: wd }); Object.defineProperty(ob, 'clientHeight', { configurable: true, value: ht }); w.dispatchEvent(new w.Event('resize'));
      const g = d.querySelector('.neo-ov'); return { cols: Number(/repeat\((\d+)/.exec(g.style.gridTemplateColumns)[1]), s: parseInt(g.style.getPropertyValue('--s'), 10) }; };
    let L1 = lay(50, 950);   // MB: + Markt, EM: + Mail, + OmniBreaker, + Workbench, + Produktion = 40 Symbole mit Uhr
    assert(L1.cols === 1 && L1.s >= 20 && L1.s * 39 + 38 * 3 <= 950, 'Schmal und hoch: eine Spalte, alle 39 Symbole (mit Uhr) passen (' + L1.s + ' px)');
    L1 = lay(740, 40);
    assert(L1.cols === 39 && L1.s * 39 <= 740, 'Breit und flach: eine Reihe (' + L1.cols + ' x ' + L1.s + ')');
    L1 = lay(300, 300);
    assert(L1.cols >= 4 && L1.cols <= 7 && L1.s >= 38, 'Quadratisch: Raster mit ' + L1.cols + ' Spalten, große Symbole (' + L1.s + ' px)');
    L1 = lay(130, 540);
    assert(L1.cols >= 2 && L1.cols <= 3 && L1.s >= 34, 'Etwas breiter gezogen: zwei bis drei Spalten (' + L1.cols + ' x ' + L1.s + ' px)');
    L1 = lay(300, 300);
    const kids = [...d.querySelectorAll('.neo-ov > *')], rest = kids.length % L1.cols;
    assert(rest === 0 || (kids[kids.length - 1].style.translate && !kids[0].style.translate), 'T18: unvollständige letzte Reihe wird mittig gesetzt');
    // T18: lange druecken, ziehen, auf anderem Symbol loslassen = tauschen
    const hb = d.querySelector('#ov-body [data-neo="haul"]'), ev = (t, x) => new w.MouseEvent(t, { bubbles: true, button: 0, clientX: x, clientY: 5 });
    d.elementFromPoint = () => hb;
    SH.sat.length = 0;
    ib.dispatchEvent(ev('pointerdown', 5)); await tick(450);
    assert(ib.classList.contains('drag'), 'T18: nach 0,4 s gedrückt halten wird das Symbol gezogen');
    ib.dispatchEvent(ev('pointermove', 60));
    assert(hb.classList.contains('drop'), 'T18: Ziel-Symbol wird markiert');
    w.dispatchEvent(ev('pointerup', 60)); ib.click();
    assert(SH.sat.length === 1 && SH.sat[0].type === 'neoIns' && SH.sat[0].a === 'intel' && SH.sat[0].b === 'haul' && !ib.classList.contains('drag'), 'T18: Loslassen schickt Einfügen, kein Klick danach');
    ib.dispatchEvent(ev('pointerdown', 5)); ib.dispatchEvent(ev('pointermove', 40)); await tick(450);
    assert(!ib.classList.contains('drag'), 'T18: sofort bewegen = kein Ziehen');
    w.dispatchEvent(ev('pointerup', 40));
    // OmniCom ohne -webkit-app-region (sonst kam der Linksklick manchmal nicht an): freie Flaeche zieht selbst, Symbol nicht
    const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('');
    assert(!/sat-neo[^{]*\{[^}]*app-region:\s*drag/.test(css), 'OmniCom: keine Windows-Zieh-Fläche mehr');
    SH.sat.length = 0;
    ob.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, button: 0 })); ob.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, button: 0 }));
    ib.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, button: 0 })); w.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true }));
    assert(SH.sat.length === 2 && SH.sat[0].drag === 'start' && SH.sat[1].drag === 'end', 'OmniCom: freie Fläche ziehen verschiebt das Fenster, Symbol nicht: ' + JSON.stringify(SH.sat));
    ib.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
    const tipEl = d.querySelector('.neo-tip');
    assert(tipEl && !tipEl.hidden && /^Local Report/.test(tipEl.textContent), 'Maus drüber: Tooltip mit dem Namen des Knopfs');
    ob.dispatchEvent(new w.MouseEvent('mouseleave'));
    assert(tipEl.hidden, 'Tooltip verschwindet wieder');
    // 07.10.: Linksklick löst schon beim Loslassen auf demselben Symbol aus, der folgende click zählt nicht doppelt; Diagnose-Log geht ans Programm
    SH.sat.length = 0;
    ib.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, button: 0 })); ib.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, button: 0 })); ib.click();
    assert(SH.sat.length === 1 && SH.sat[0].type === 'neo' && SH.sat[0].target === 'intel' && !SH.sat[0].big, 'Linksklick: genau eine Aktion schon beim Loslassen: ' + JSON.stringify(SH.sat));
    ib.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, button: 0 })); hb.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, button: 0 }));
    assert(SH.sat.length === 1, 'Loslassen auf einem anderen Symbol löst nichts aus');
    await tick(2100); SH.sat.length = 0;
    hb.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, button: 0 })); hb.click();
    assert(SH.sat.length === 1 && SH.sat[0].target === 'haul', 'Nur Loslassen kommt an (Windows schluckt das Drücken): Symbol löst trotzdem genau einmal aus');
    hb.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true, button: 0 })); await tick(500);
    assert(SH.sat.some(x => x.type === 'neoHeal'), 'Zweimal nur Loslassen: OmniCom-Fenster wird neu aufgebaut');
    await tick(2100);
    assert(/pointerdown Taste 0 intel/.test(SH.log || '') && /aktion intel/.test(SH.log) && /Fokus:/.test(SH.log), 'Diagnose: Maus-Ereignisse gehen ans Programm (neocom-log.txt)');
    // Y10: Maus auf „Leistung“ zeigt die Leistungswerte (Server, Spieler, Downtime …) als Tooltip
    assert(/class="neo-perf-tip" hidden>.*pf-g/.test(nc.html), 'Y10: OmniCom-Overlay bringt die Leistungswerte mit');
    d.querySelector('#ov-body [data-neo="perf"]').dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
    assert(!tipEl.hidden && tipEl.classList.contains('pf') && tipEl.querySelector('.pf-g') && /^Leistung/.test(tipEl.textContent) && /Server/.test(tipEl.textContent), 'Y10: Tooltip an „Leistung“ = Leistungs-Overlay');
    ib.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true }));
    assert(!tipEl.classList.contains('pf') && !tipEl.querySelector('.pf-g'), 'Y10: andere Symbole wieder nur mit Namen');
    console.log('\nALL OMNICOM OVERLAY TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
