// Abschnitt H (Wuensche vom 24.09.2026): H1 Rot im Overlay, weitere Punkte folgen.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
  beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
(async () => {
  try{
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const red = () => d.documentElement.style.getPropertyValue('--ov-red');
    // H1
    assert(!$('ovs-red') && !red(), 'H1/P4: eigene Rot-Einstellung entfällt, Overlay nimmt sonst #ff3b3b');
    assert(/#ov-root\{--loss:var\(--ov-red, ?#ff3b3b/.test(d.querySelector('style').textContent), 'H1: Overlay nutzt das kräftige Rot für --loss');
    // H6: ⤢ in der Kompaktansicht zeigt genau diese Ansicht gross
    const o = T.ovLoad(); o.view = 'wallet'; T.ovSave(o);
    T.ovSetMode('compact'); await tick(50);
    $('ov-full').onclick(); await tick(50);
    assert(T.ovGetMode() === 'full' && $('panel-wallet').classList.contains('active'), 'H6: ⤢ in der Kompaktansicht öffnet die Wallet groß');
    const o2 = T.ovLoad(); o2.view = 'trades'; T.ovSave(o2);
    T.ovSetMode('compact'); await tick(50);
    $('ov-full').onclick(); await tick(50);
    assert(T.ovGetMode() === 'full' && $('panel-station').classList.contains('active'), 'H6: ⤢ bei Trades öffnet Trading groß');
    // H8: Mini-Menue am Zahnrad
    T.ovSetMode('compact'); await tick(50);
    $('ov-settings').onclick();
    assert(!$('ov-mini').hidden && $('ovm-alpha').value === String(T.ovLoad().alpha), 'H8: Zahnrad öffnet das Mini-Menü mit dem aktuellen Hintergrund');
    $('ovm-alpha').value = '0.5'; $('ovm-alpha').oninput.call($('ovm-alpha'));
    assert(T.ovLoad().alpha === 0.5 && $('ovm-alpha-v').textContent === '50 %', 'H8: Regler ändert den Hintergrund sofort');
    d.body.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
    assert($('ov-mini').hidden, 'H8: Klick daneben schließt das Mini-Menü');
    $('ov-settings').onclick(); $('ov-settings').onclick();
    assert($('ov-mini').hidden, 'H8: Zahnrad nochmal = zu');
    // H9: Alarme gebuendelt: Trade (Meldung/Ton) und Gang-Alarm (Meldung/Ton) im Reiter „Alarme“
    const pa = $('set-pane-alarm');
    assert(['ovs-notify', 'ovs-sound', 'ovs-test', 'ga-desk', 'ga-sound'].every(id => pa.contains($(id))), 'H9: Meldung und Ton für Trade- und Gang-Alarm stehen unter „Alarme“');
    assert(d.querySelector('.tab-btn[data-set="alarm"]').textContent === 'Alarme', 'H9: Reiter heißt „Alarme“');
    // H10: Knopf „Marktfenster in EVE“ ruft ESI ui/openwindow/marketdetails fuer den Charakter auf
    w.localStorage.setItem('eve-zentrale-characters', JSON.stringify([
      { access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'111', character_name:'Eins' },
      { access_token:'b', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'222', character_name:'Zwei' }]));
    assert(String(await T.mkChar()) === '111', 'H10: ohne Client vorne/online → erster Charakter');
    const calls = []; w.fetch = (u, o) => { calls.push({ u: String(u), o }); return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) }); };
    const mb = T.mkBtn(34).firstChild; d.body.appendChild(mb); mb.onclick(new w.MouseEvent('click')); await tick(80);
    assert(calls.length === 1 && /\/ui\/openwindow\/marketdetails\/\?type_id=34&/.test(calls[0].u) && calls[0].o.method === 'POST' && calls[0].o.headers.Authorization === 'Bearer a', 'H10: POST marketdetails type_id=34 mit Token: ' + (calls[0] || {}).u);
    assert(mb.classList.contains('ok'), 'H10: Knopf zeigt Erfolg');
    assert(/esi-ui\.open_window\.v1/.test(d.getElementById('set-pane-chars').textContent), 'H10: neue Berechtigung steht in der Scope-Liste');   // UU2: Hilfe steht jetzt oben im Reiter Konto
    // H11 -> T27: OmniCom-Symbole aus EVECore-Symbolpaket/bereiche (alte Masken-Bilder entfernt)
    assert(['station','haul','wallet','assets','sell','orders','contracts','industry','map','intel','pi','music','account','skills','jump','chars','settings'].every(id => $('neo-btn-' + id).querySelector('svg.ic2[data-icl]')), 'T27: neue Symbole in allen OmniCom-Knöpfen');
    assert(!/svg\.ic-browser\{--ic:url/.test(d.querySelector('style').textContent), 'T27: alte Masken-Symbole entfernt');
    console.log('\nALL WUENSCHE-H TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
