// BB4 (27.09.2026): grosse Zahlenfelder (ISK, m³) mit Tausenderpunkten + hellblauer Mio./Tsd.-Anzeige, Kurzform "500k"/"1,5 Mio"/"2b",
// im Hauptfenster und in den Overlay-Suchoptionen; Rechnungen lesen dieselbe Zahl wie vorher.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const w = new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
      beforeParse(w){ w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(600);
    const d = w.document, $ = id => d.getElementById(id), T = w.__test;
    const type = (e, v) => { e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); };
    const leave = e => e.dispatchEvent(new w.Event('change', { bubbles: true }));
    const hint = e => e.parentNode.querySelector('.num-hint').textContent;
    try{ d.getElementById('tab-station').click(); }catch(e){}
    await tick(100);
    const ids = ['hl-cargo', 'hl-budget', 'hl-reserve', 'is-cargo', 'is-budget', 'is-reserve', 'tsc-capital', 'tsc-minprice'];
    assert(ids.every(id => $(id) && $(id).type === 'text' && $(id).parentNode.classList.contains('num-wrap') && $(id).parentNode.querySelector('.num-hint')), 'BB4: alle 8 großen Zahlenfelder mit Punkten + hellblauer Anzeige');
    assert($('is-budget').value === '450.000.000' && hint($('is-budget')) === '450 Mio.' && $('is-cargo').value === '390.000', 'BB4: Hub-Handel-Felder zeigen gleich beim Laden Punkte + „450 Mio.“');

    const b = $('is-budget');
    type(b, '1500000');
    assert(b.value === '1.500.000' && hint(b) === '1,5 Mio.', 'BB4: „1500000“ → „1.500.000“ + „1,5 Mio.“');
    // Ziffer in der Mitte einfügen: Cursor bleibt hinter der getippten Ziffer
    b.value = '1.5200.000'; b.setSelectionRange(4, 4); b.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert(b.value === '15.200.000' && b.selectionStart === 4, 'BB4: Cursor bleibt beim Tippen an der richtigen Stelle (' + b.selectionStart + ')');

    const cases = [['500k', '500.000', '500 Tsd.'], ['1,5 Mio', '1.500.000', '1,5 Mio.'], ['2b', '2.000.000.000', '2 Mrd.'], ['2 Mrd', '2.000.000.000', '2 Mrd.'],
                   ['250 Tsd.', '250.000', '250 Tsd.'], ['1.5m', '1.500.000', '1,5 Mio.'], ['3,2 mrd', '3.200.000.000', '3,2 Mrd.']];
    cases.forEach(c => {
      type(b, c[0]);
      const typed = b.value, h = hint(b), n = T.parseGroupedInt('is-budget');
      leave(b);
      assert(typed === c[0] && h === c[2] && b.value === c[1] && n === Number(c[1].replace(/\./g, '')), 'BB4: Kurzform „' + c[0] + '“ → Anzeige „' + h + '“, beim Verlassen „' + b.value + '“');
    });
    type(b, '12.3ab4.000');
    assert(T.parseGroupedInt('is-budget') === 1234000, 'BB4: Tippfehler – nur die Ziffern zählen');
    type(b, '');
    assert(b.value === '' && hint(b) === '' && T.parseGroupedInt('is-budget') === 0, 'BB4: leeres Feld = 0, keine Anzeige');

    // Rechnung: gleiche Zahl egal wie geschrieben
    const vals = ['1000000000', '1.000.000.000', '1 Mrd', '1b', '1000 Mio'].map(v => { type(b, v); return T.parseGroupedInt('is-budget'); });
    assert(vals.every(v => v === 1e9), 'BB4: Rechnung liest immer 1.000.000.000 (' + vals.join(', ') + ')');

    // Reserve: gemeinsam für Hub-Handel + Hauling, gespeichert als reine Zahl
    const r = $('is-reserve'); type(r, '2k'); leave(r);
    assert(r.value === '2.000' && $('hl-reserve').value === '2.000' && w.localStorage.getItem('eve-zentrale-cargo-reserve-v1') === '2000', 'BB4: Reserve „2k“ → 2.000 m³ in beiden Feldern, gespeichert 2000');

    // Umschalten Hub-Handel → Hauling nimmt die Kurzform richtig mit
    type(b, '1,5 Mio');
    d.querySelector('[data-hd="haul"]').click(); await tick(30);
    assert($('hl-budget').value === '1.500.000', 'BB4: „1,5 Mio“ wird beim Umschalten als 1.500.000 mitgenommen (' + $('hl-budget').value + ')');
    d.querySelector('[data-hd="hub"]').click(); await tick(30);

    // Overlay: Suchoptionen im Handel-Overlay (KK7: Laderaum-Feld nur bei „Nur Laderaum eingeben“)
    d.querySelector('#is-sm [data-sm=cargo]').click(); await tick(30);
    T.ovSetMode('compact'); await tick(100);
    const s = T.ovLoad(); s.views = s.views.filter(v => v.id !== 'handel').concat([{ id: 'handel', on: true }]); s.view = 'handel'; s.mirrorOpen = { 'haul-run': true }; T.ovSave(s); T.ovRender();   // 17.10.: ein gemeinsamer Auf/Zu-Zustand für Hauling + Hub-Handel
    await tick(30);
    const ob = $('ov-body'), ob2 = () => ob.querySelector('input[data-ovf="is-budget"]');
    assert(ob2() && ob2().parentNode.classList.contains('num-wrap') && ob.querySelector('input[data-ovf="is-cargo"]').parentNode.querySelector('.num-hint'), 'BB4: Overlay-Felder Budget/Laderaum mit Mio./Tsd.-Anzeige');
    assert(ob2().value === '1.500.000' && hint(ob2()) === '1,5 Mio.', 'BB4: Overlay zeigt denselben Wert wie das Hauptfenster');
    type(ob2(), '750000');
    assert(ob2().value === '750.000' && hint(ob2()) === '750 Tsd.', 'BB4: Tippen im Overlay: „750000“ → „750.000“ + „750 Tsd.“');
    type(ob2(), '3b');
    let runs = 0; const old = $('is-start').onclick; $('is-start').onclick = () => { runs++; };
    ob.querySelector('[data-ova="mirrorRun"]').click(); await tick(30);
    $('is-start').onclick = old;
    assert(runs === 1 && $('is-budget').value === '3.000.000.000' && T.parseGroupedInt('is-budget') === 3e9, 'BB4: „3b“ aus dem Overlay → Hauptfenster 3.000.000.000 (' + $('is-budget').value + ')');
    T.ovRender(); await tick(30);
    assert(ob2().value === '3.000.000.000' && hint(ob2()) === '3 Mrd.', 'BB4: nach dem Neuzeichnen weiter mit Punkten + „3 Mrd.“');
    console.log('\nALL BB4 TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
