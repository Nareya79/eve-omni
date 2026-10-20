// OmniCom selbst sortieren (Einstellungen › Darstellung und per Ziehen in der Leiste) + Overlay-Skalierung.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(extra){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url:'https://claude.ai/artifact/test', pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-neocom-groups-v1', '{"eve":false}'); w.localStorage.setItem('eve-zentrale-overlay-v1', '{"neoEve":false}'); /* LL8: klassische Leiste */ Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k])); w.fetch = () => Promise.reject(new Error('offline')); } }).window;
}
const order = d => [...d.querySelectorAll('#neocom > .neo-btn')].filter(b => b.id !== 'neo-quit').map(b => b.id.replace('neo-btn-', ''));
(async () => {
  try{
    let w = makeWindow(); await tick(500);
    let d = w.document, $ = id => d.getElementById(id);
    const def = order(d);
    assert(def.join(',') === 'station,haul,market,track,sell,orders,contracts,appraisal,courier,wallet,assets,fits,industry,mining,jump,map,intel,radar,wormhole,chars,skills,pi,mail,music,game,home,settings,account', 'Standard-Reihenfolge (BB13: nach Gruppen)');
    let rows = d.querySelectorAll('#neo-order .neo-row');
    assert([...rows].filter(r => r.querySelector('button[title="nach oben"]')).length === 35 && rows.length === 37 && /Trading/.test(rows[0].textContent) && rows[0].querySelector('svg') && /Einstellungen/.test(rows[35].textContent), 'Einstellungen: eine Liste mit Symbol und Namen, Overlay-Symbole mit Pfeilen, Einstellungen/Konto fest unten');
    assert($('panel-settings').contains($('neo-order')), 'Liegt in Einstellungen › Darstellung');
    // Navigation nach oben schieben (3x ↑ vom letzten Platz)
    for (let i = 0; i < 13; i++){ rows = d.querySelectorAll('#neo-order .neo-row'); const idx = [...rows].findIndex(r => /Navi/.test(r.children[1].textContent.replace(/­/g, ''))); rows[idx].querySelector('button[title="nach oben"]').onclick(); }
    assert(order(d)[0] === 'jump' && order(d).slice(-2).join(',') === 'settings,account', 'Navigation ganz oben, Einstellungen/Konto bleiben unten');
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-neocom-v1'))[0] === 'neo-btn-jump', 'Reihenfolge gespeichert');
    // Ziehen in der Leiste: Wallet vor Trading
    const fire = (el, type, y) => { const ev = new w.Event(type, { bubbles: true, cancelable: true }); ev.clientY = y || 0; el.dispatchEvent(ev); };
    const wal = $('neo-btn-wallet'), tr = $('neo-btn-station');
    fire(wal, 'dragstart'); fire(tr, 'dragover'); fire(tr, 'drop', -1000); fire(wal, 'dragend');
    let o = order(d);
    assert(o.indexOf('wallet') === o.indexOf('station') - 1, 'Per Ziehen: Wallet vor Trading abgelegt');
    assert(d.querySelectorAll('#neo-order .neo-row')[1].textContent.indexOf('Wallet') >= 0, 'Einstellungs-Liste folgt dem Ziehen');
    assert($('neo-btn-station').getAttribute('draggable') === 'true' && !$('neo-btn-settings').hasAttribute('draggable'), 'Nur die oberen Symbole sind ziehbar');
    // Klicks funktionieren weiter
    $('neo-btn-wallet').onclick();
    assert($('panel-wallet').classList.contains('active'), 'Bereiche öffnen weiter per Klick');
    const saved = w.localStorage.getItem('eve-zentrale-neocom-v1');
    w.close();

    // Neustart: Reihenfolge bleibt, unbekannte/fehlende IDs werden repariert
    const broken = JSON.parse(saved).filter(id => id !== 'neo-btn-skills').concat(['neo-btn-gibtsnicht']);
    w = makeWindow({ 'eve-zentrale-neocom-v1': JSON.stringify(broken) }); await tick(500);
    d = w.document; $ = id => d.getElementById(id);
    o = order(d);
    assert(o[0] === 'jump' && o[o.indexOf('skills') - 1] === 'chars' && o.length === 28, 'Nach Neustart gleiche Reihenfolge, fehlende Bereiche hinter ihrem Vorgänger eingefügt');
    $('neo-order-reset').onclick();
    assert(order(d).join(',') === def.join(','), 'Standard-Reihenfolge wiederherstellbar');

    // Overlay-Skalierung
    const sc = $('ovs-scale');
    assert(sc.min === '0.6' && sc.max === '2' && /Overlay-Skalierung/.test(sc.parentNode.textContent), 'Regler „Overlay-Skalierung“ 60–200 %');
    sc.value = '1.6'; sc.oninput();
    assert(d.documentElement.style.getPropertyValue('--ov-scale') === '1.6' && $('ovs-scale-v').textContent === '160 %', 'Skalierung wirkt sofort');
    const css = d.querySelector('style').textContent;
    assert(/#ov-root\{[^}]*zoom:var\(--ov-scale, 1\)/.test(css), 'Skaliert das ganze Overlay (Schrift, Knöpfe, Abstände)');
    console.log('\nALL OMNICOM / SCALE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
