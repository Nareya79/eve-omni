// LL Block D (10.10.2026): OmniCom wie in EVE – Gruppen-Symbole, Feld daneben (Hauptfenster); OmniCom-Overlay bleibt ohne Gruppen (Wunsch 10.10.)
const { JSDOM } = require('jsdom');
const html = require('fs').readFileSync('/tmp/eve-zentrale-test14.html', 'utf8');
let ok = 0, bad = 0; const assert = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
setTimeout(() => {
  const w = dom.window, d = w.document;
  const errs = [];
  const hs = [...d.querySelectorAll('.neo-grp.neo-eve')];
  assert(hs.length === 5, 'D: 5 Gruppen als Symbol (' + hs.length + ')');
  assert(hs.every(h => h.querySelector('svg')), 'D: jede Gruppe hat ein Symbol');
  const fly = d.getElementById('neo-fly-besitz');
  assert(fly && fly.hidden && fly.querySelector('#neo-btn-wallet'), 'D: Wallet steckt zu im Feld „Besitz“');
  d.getElementById('neo-grp-besitz').click();
  assert(!fly.hidden, 'D: Klick öffnet das Feld');
  d.getElementById('neo-btn-wallet').click();
  setTimeout(() => {
    assert(fly.hidden, 'D: Wahl schließt das Feld');
    assert(d.getElementById('neo-grp-besitz').classList.contains('has-sel'), 'D: Gruppe zeigt die offene Seite');
    // Overlay: keine Gruppen (Nutzerwunsch) – Code-Prüfung, Funktionen liegen im Hauptskript-Abschnitt
    assert(!/data-neo="grp:|neo-ov-eve/.test(html), 'D: OmniCom-Overlay ohne Leisten-Gruppen-Knöpfe');   // WW2/WW5 (16./17.10.): Overlay hat eigene Gruppen (neoOvGrp), nicht die der Leiste
    const gs = d.querySelector('[data-neo-grpsel="neo-btn-wallet"]');
    gs.value = '-'; gs.dispatchEvent(new w.Event('change'));
    assert(d.querySelector('#neocom > #neo-btn-wallet') && d.querySelector('#neo-order [data-neo-sgrp=""]'), 'D: „ohne Gruppe“ = direkt in der Leiste, Überschrift in den Einstellungen');
    assert(!/NEO_GRP_COL/.test(html) && /function neoGrpSvg\(gid\)\{ var h = icLine\(\)/.test(html), 'D: Gruppenfarbe = Symbolfarbe des Designs');
    d.getElementById('neo-eve').checked = false; d.getElementById('neo-eve').dispatchEvent(new w.Event('change'));
    assert(!d.querySelector('.neo-grp.neo-eve') && d.querySelector('#neocom > #neo-btn-wallet'), 'D: Leisten-Schalter aus = alte Leiste');
    console.log(bad ? 'FAILED ' + bad : 'ALL ' + ok + ' PASSED'); process.exit(0);
  }, 50);
}, 1500);
