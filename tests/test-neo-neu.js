// 14.10.2026: NEU-Markierung neuer OmniCom-Symbole (Hauptfenster + OmniCom-Overlay), weg nach dem ersten Klick; erster Start = alles bekannt
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const KEY = 'eve-zentrale-neoseen-v1';
function open(seen){
  return new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ if (seen) w.localStorage.setItem(KEY, JSON.stringify(seen)); w.localStorage.setItem('eve-zentrale-welcome-v1', 'done'); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
}
(async () => {
  try{
    // 1) Erster Start: alles bekannt, nichts markiert
    let w = open(null); await tick(600);
    let T = w.__test, d = w.document, seen = JSON.parse(w.localStorage.getItem(KEY));
    assert(Array.isArray(seen) && seen.includes('neo-btn-wallet') && seen.includes('neo-btn-workbench'), 'Erster Start: alle vorhandenen Symbole gelten als bekannt (' + seen.length + ')');
    assert(!d.querySelector('#neocom .neo-new') && !/neo-new/.test(T.neoOverlayHtml()), 'Erster Start: keine Markierung');
    assert(!seen.includes('neo-btn-discord'), 'Discord (neu in diesem Stand) zählt beim ersten Start als neu (Knopf gibt es nur im Programm, s. test-qq1-discord-neocom.js)');
    w.close();
    // 2) Später kommen Wallet (Hauptleiste) und Workbench (nur Overlay) neu dazu
    w = open(seen.filter(x => x !== 'neo-btn-wallet' && x !== 'neo-btn-workbench')); await tick(600);
    T = w.__test; d = w.document;
    assert(d.getElementById('neo-btn-wallet').classList.contains('neo-new'), 'Hauptleiste: neues Symbol trägt „NEU“');
    const grp = d.getElementById('neo-btn-wallet').closest('.neo-fly');
    if (grp) assert(d.getElementById('neo-grp-' + grp.id.replace('neo-fly-', '')).classList.contains('neo-new'), 'Gruppen-Symbol zeigt ebenfalls „NEU“');
    const ov = d.createElement('div'); ov.innerHTML = T.neoOverlayHtml();
    assert(ov.querySelector('[data-neo="workbench"]').classList.contains('neo-new') && ov.querySelector('[data-neo="wallet"]').classList.contains('neo-new') && ov.querySelectorAll('.neo-new').length === 2, 'OmniCom-Overlay: genau die zwei neuen markiert');
    // 3) Anklicken nimmt die Markierung weg und bleibt gemerkt
    d.getElementById('neo-btn-wallet').click(); await tick(50);
    assert(!d.getElementById('neo-btn-wallet').classList.contains('neo-new') && JSON.parse(w.localStorage.getItem(KEY)).includes('neo-btn-wallet'), 'Klick im Hauptfenster: Markierung weg, gemerkt');
    try{ T.neoOverlayAction('workbench', false, false); }catch(e){}
    ov.innerHTML = T.neoOverlayHtml();
    assert(!ov.querySelector('.neo-new') && !d.querySelector('#neocom .neo-new'), 'Klick im Overlay: Markierung weg, nirgends mehr „NEU“');
    // 4) Englisch: „NEW“
    assert(/html\[lang="en"\] \.neo-new::before\{content:"NEW"\}/.test(html), 'Englisch zeigt „NEW“');
    console.log('\nALL NEO-NEU TESTS PASSED'); process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
