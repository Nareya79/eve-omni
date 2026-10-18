// Eigener Bereich "Einstellungen" (getrennt von Konto), Umbenennung Suche -> Hub-Handel,
// durchsichtige Hauptansicht im Programm (Hintergrund-Deckkraft, Schrift bleibt deckend).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(host, extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      w.fetch = () => Promise.reject(new Error('offline'));
      if (host) w.evecoreHost = host;
    }
  }).window;
}
(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let d = w.document, $ = id => d.getElementById(id);
    const set = $('panel-settings'), acc = $('panel-account');
    assert(set && $('neo-btn-settings'), 'Neuer Bereich „Einstellungen“ mit eigenem OmniCom-Knopf');
    ['ui-schemes', 'ui-scale', 'ovs-views', 'ovs-refresh', 'hs-ontop', 'hs-hotkeys', 'dx-export', 'dx-file'].forEach(id =>
      assert(set.contains($(id)) && !acc.contains($(id)), id + ' liegt in Einstellungen, nicht im Konto-Teil'));
    ['sso-login-box', 'sso-client-id', 'skills-panel'].forEach(id => assert($('set-pane-chars').contains($(id)), id + ' bleibt im Konto'));   // UU2
    assert(/Einstellungen/.test($('neo-btn-settings').textContent.replace(/­/g, '')) && $('neo-btn-settings').classList.contains('neo-bottom'), 'Knopf unten in der Leiste');
    assert(set.contains(acc) && $('set-pane-chars').contains(acc), 'Konto steckt in Einstellungen › Konto');
    $('neo-btn-settings').onclick();
    assert(set.classList.contains('active') && !acc.classList.contains('active') && $('neo-btn-settings').getAttribute('aria-selected') === 'true', 'Einstellungen öffnen');
    $('neo-btn-account').onclick(); await tick(30);
    assert(set.classList.contains('active') && !$('set-pane-chars').hidden, 'alter Konto-Aufruf öffnet Einstellungen › Konto');
    // Zahnrad in der Kompaktansicht oeffnet das Mini-Menue (H8), von dort „Alle Einstellungen …“
    w.__test.ovSetMode('compact'); await tick(50);
    $('ov-settings').onclick(); await tick(50);
    assert(!$('ov-mini').hidden && d.body.classList.contains('ov-mode'), 'Zahnrad in der Kompaktansicht öffnet das Mini-Menü');
    $('ovm-all').onclick(); await tick(50);
    assert(!d.body.classList.contains('ov-mode') && set.classList.contains('active') && $('ov-mini').hidden, '„Alle Einstellungen …“ führt zu Einstellungen');

    // --- Handel (O2: Hub-Handel + Hauling in einem Knopf) ---
    const hb = $('neo-btn-haul');
    assert(!$('neo-btn-intensiv') && /Hauling/.test(hb.textContent) && !/\bSuche\b/.test(hb.textContent), 'OmniCom: ein Knopf „Hauling“ (SS5) statt Hub-Handel + Hauling');
    assert(/zu festem Hub\/Station oder im Umkreis/.test(hb.title), 'Tooltip erklärt den Bereich');
    hb.onclick();
    assert($('panel-intensiv').classList.contains('active') && hb.getAttribute('aria-selected') === 'true', 'Handel öffnet anfangs „Zu festem Hub/Station“');
    assert($('panel-intensiv').contains($('hr-box')), '„Meine Hauling-Läufe“ auch unter „Zu festem Hub/Station“');
    $('panel-intensiv').querySelector('[data-hd="haul"]').onclick();
    assert($('panel-haul').classList.contains('active') && hb.getAttribute('aria-selected') === 'true' && $('panel-haul').querySelector('[data-hd="haul"]').getAttribute('aria-selected') === 'true', 'Umschalter: „Im Umkreis“ zeigt die Umkreissuche');
    assert($('panel-haul').contains($('hr-box')) && $('hr-box').nextElementSibling.classList.contains('status-line'), '… und unter „Im Umkreis“ an alter Stelle');
    $('neo-btn-wallet').onclick(); hb.onclick();
    assert($('panel-haul').classList.contains('active') && w.localStorage.getItem('eve-zentrale-handel-mode-v1') === 'haul', 'Handel merkt die zuletzt gewählte Suche');
    assert($('is-start').textContent === 'Beste Ladung berechnen' && !/Intensiv/.test($('panel-intensiv').textContent) && !/Intensiv/.test($('panel-haul').textContent), 'Keine „Intensiv-Suche“ mehr in der Oberfläche');
    // Im Browser: keine Transparenz-Eingriffe
    assert($('ovs-mainalpha').closest('.host-only'), 'Regler Hauptansicht nur im Programm');
    assert(d.querySelector('.app-shell').style.getPropertyValue('--surface') === '', 'Browser: Hauptansicht bleibt deckend');
    w.close();

    // --- Programm mit transparentem Fenster ---
    let S = { transparent: true, opacity: 0.9, opacityFull: 0.8, alwaysOnTop: true, hotkeys: {}, hotkeyStatus: {}, backup: {} };
    const H = { patches: [] };
    const host = { getSettings: () => Promise.resolve(Object.assign({}, S)), setSettings: p => { H.patches.push(p); Object.assign(S, p); return Promise.resolve(Object.assign({}, S)); },
      onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(){} };
    w = makeWindow(host, { 'eve-zentrale-overlay-v1': JSON.stringify({ mainAlpha: 0.6 }), 'eve-zentrale-ui-v1': JSON.stringify({ scheme: 'photon' }) }); await tick(500);   // Farbwerte unten = Photon (Standard seit 17.10. Caldari)
    d = w.document; $ = id => d.getElementById(id);
    const shell = d.querySelector('.app-shell');
    assert(d.documentElement.classList.contains('host-transparent'), 'Programm meldet transparentes Fenster');
    assert(shell.style.getPropertyValue('--surface') === 'rgba(13,17,22,0.6)' && shell.style.getPropertyValue('--bg') === 'rgba(5,7,10,0.6)', 'Hauptansicht: Hintergründe durchsichtig (60 %): ' + shell.style.getPropertyValue('--surface'));
    assert(shell.style.getPropertyValue('--text') === '', 'Schriftfarben bleiben deckend');
    assert($('ovs-mainalpha').value === '0.6' && $('ovs-mainalpha-v').textContent === '60 %', 'Regler zeigt 60 %');
    $('ovs-mainalpha').value = '0.4'; $('ovs-mainalpha').oninput();
    assert(shell.style.getPropertyValue('--surface') === 'rgba(13,17,22,0.4)', 'Regler wirkt sofort');
    d.querySelector('#ui-schemes [data-scheme="caldari-eve"]').onclick();
    assert(shell.style.getPropertyValue('--surface') === 'rgba(15,24,27,0.4)', 'Farbschema-Wechsel: neue Farben, gleiche Durchsichtigkeit (Caldari (EVE))');
    d.querySelector('#ui-schemes [data-scheme="amarr-eve"]').onclick();
    assert(/^color-mix\(in srgb, .*40%, transparent\)$/.test(shell.style.getPropertyValue('--surface')), '18.10.: gemischte EVE-Flächen (Amarr (EVE)) bekommen dieselbe Durchsichtigkeit: ' + shell.style.getPropertyValue('--surface'));
    $('ovs-mainalpha').value = '1'; $('ovs-mainalpha').oninput();
    assert(shell.style.getPropertyValue('--surface') === '', '100 % = deckend');
    assert($('hs-opacity-full').value === '0.8' && $('hs-opacity-full-v').textContent === '80 %', 'Fenster-Deckkraft Hauptansicht angezeigt');
    $('hs-opacity-full').value = '0.7'; $('hs-opacity-full').oninput();
    assert(H.patches.some(p => p.opacityFull === 0.7), 'Fenster-Deckkraft Hauptansicht geht ans Programm');
    // H4: Abstand zum Bildschirmrand
    assert($('hs-snapgap').value === '1', 'H4: Abstand zum Rand zeigt Standard 1 Pixel');
    $('hs-snapgap').value = '99'; $('hs-snapgap').onchange(); await tick(30);
    assert(H.patches.some(p => p.snapGap === 50) && $('hs-snapgap').value === '50', 'H4: Abstand geht ans Programm (höchstens 50)');
    // Transparenz aus -> deckend
    $('ovs-mainalpha').value = '0.5'; $('ovs-mainalpha').oninput();
    H.cmd({ type: 'settings', settings: Object.assign({}, S, { transparent: false }) }); await tick(30);
    assert(!d.documentElement.classList.contains('host-transparent') && shell.style.getPropertyValue('--surface') === '', 'Ohne transparentes Fenster bleibt alles deckend');
    H.cmd({ type: 'settings', settings: Object.assign({}, S, { transparent: true }) }); await tick(30);
    assert(/^color-mix\(in srgb, .*50%, transparent\)$/.test(shell.style.getPropertyValue('--surface')), 'Wieder an: Durchsichtigkeit zurück');   // 18.10.: Amarr (EVE) mischt seine Flächen

    console.log('\nALL SETTINGS-TAB TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
