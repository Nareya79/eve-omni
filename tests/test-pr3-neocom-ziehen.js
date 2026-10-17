// PR3 (12.10.2026): OmniCom im Hauptfenster wie in EVE – Symbol aus dem Gruppenfeld auf die freie Leiste ziehen = ohne Gruppe,
// zurück auf eine Gruppe ziehen, ganze Gruppen verschieben.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
(async () => {
  try{
    const w = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'https://claude.ai/artifact/test', pretendToBeVisual: true,
      beforeParse(w){ w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
    await tick(400);
    const d = w.document, nav = d.getElementById('neocom');
    const fire = (t, type) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); t.dispatchEvent(e); return e; };
    const grpOrder = () => [...nav.querySelectorAll(':scope > .neo-grp')].filter(h => !h.hidden).map(h => h.getAttribute('data-neo-grp'));
    // Symbol aus „Handel“ auf die freie Leiste
    let m = d.getElementById('neo-btn-market');
    assert(m.parentNode.id === 'neo-fly-handel', 'Markt steht im Feld der Gruppe Handel');
    fire(m, 'dragstart');
    const ov = fire(nav, 'dragover');
    assert(ov.defaultPrevented && nav.classList.contains('neo-drop-bar'), 'freie Leiste ist Ablageziel und leuchtet');
    fire(nav, 'drop'); fire(m, 'dragend');
    m = d.getElementById('neo-btn-market');
    assert(m.parentNode === nav && !nav.classList.contains('neo-drop-bar') && nav.querySelector(':scope > .neo-btn') === m, 'Markt steht ohne Gruppe oben in der Leiste');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-neocom-groups-v1')).grp['neo-btn-market'] === '-', 'gemerkt: ohne Gruppe');
    // zurück: auf den Gruppenkopf ziehen
    fire(m, 'dragstart');
    fire(d.getElementById('neo-grp-handel'), 'drop'); fire(m, 'dragend');
    assert(d.getElementById('neo-btn-market').parentNode.id === 'neo-fly-handel', 'zurück auf die Gruppe Handel gezogen');
    // ganze Gruppe verschieben
    const g0 = grpOrder();
    assert(g0[0] === 'handel' && g0[1] === 'besitz', 'Ausgang: Handel vor Besitz (' + g0 + ')');
    const hb = d.getElementById('neo-grp-besitz'), hh = d.getElementById('neo-grp-handel');
    fire(hb, 'dragstart');
    assert(fire(hh, 'dragover').defaultPrevented && hh.classList.contains('neo-drag-over'), 'Gruppe auf Gruppe: Ziel markiert');
    fire(hh, 'drop'); fire(hb, 'dragend');
    let g1 = grpOrder();
    assert(g1[0] === 'besitz' && g1[1] === 'handel' && g1.slice(2).join() === g0.slice(2).join(), 'Besitz vor Handel, Rest unverändert (' + g1 + ')');
    fire(d.getElementById('neo-grp-besitz'), 'dragstart'); fire(d.getElementById('neo-grp-misc'), 'drop'); fire(d.getElementById('neo-grp-besitz'), 'dragend');
    g1 = grpOrder();
    assert(g1[g1.length - 1] === 'besitz', 'nach unten gezogen: hinter die Zielgruppe (' + g1 + ')');
    assert(!d.getElementById('neo-btn-wallet').hidden && d.getElementById('neo-btn-wallet').parentNode.id === 'neo-fly-besitz', 'Symbole bleiben in ihrer Gruppe');
    console.log('ALL TESTS PASSED');
  }catch(err){ console.error(err.message); process.exit(1); }
  process.exit(0);
})();
