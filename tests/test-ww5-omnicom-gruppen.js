// WW5 (17.10.2026): OmniCom-Overlay – Symbole wie auf dem Handy in Gruppen hinein- und wieder herausziehen (Aufbauten Favoriten+Ordner, Gruppen aufklappen, wächst).
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function makeWindow(url, host, mode){
  return new JSDOM(html, { runScripts:'dangerously', resources:'usable', url, pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify({ neoMode: mode })); w.fetch = () => Promise.reject(new Error('offline')); if (host) w.evecoreHost = host; } }).window;
}
(async () => {
  try{
    const S = { windows: { neocom: { open: true } } }, H = { pub: {} };
    const host = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))), setSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))),
      publishView: (id, data) => { H.pub[id] = data; }, onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(){}, showMain(){}, mainState: () => Promise.resolve({ visible: true, mode: 'full' }), hide(){} };
    let w = makeWindow('https://claude.ai/artifact/test', host, 'acc'); await tick(700);
    let d = w.document; w.__test.ovPublishSatellites(); await tick(80);
    const ov = () => { const t = d.createElement('div'); t.innerHTML = H.pub.neocom.html; return t; };
    const gOf = id => { const b = ov().querySelector('[data-neo="' + id + '"]'); return b && b.getAttribute('data-g'); };
    assert(gOf('wallet') === 'besitz' && gOf('intel') === 'nav', 'Standard: Wallet in Besitz, Local Report in Navi & Intel');
    const sat = a => H.cmd({ type: 'satAction', view: 'neocom', action: a });
    sat({ type: 'neoGrp', a: 'wallet', g: '-' }); await tick(80);
    assert(gOf('wallet') === '', 'herausziehen: Wallet steht ohne Gruppe oben');
    sat({ type: 'neoGrp', a: 'wallet', g: 'nav' }); await tick(80);
    assert(gOf('wallet') === 'nav', 'in eine andere Gruppe ziehen: Wallet in Navi & Intel');
    sat({ type: 'neoGrp', a: 'wallet', g: 'besitz', b: 'mining' }); await tick(80);
    const bes = [...ov().querySelectorAll('[data-g="besitz"]')].map(b => b.getAttribute('data-neo'));
    assert(gOf('wallet') === 'besitz' && bes.indexOf('wallet') === bes.indexOf('mining') - 1, 'auf ein Symbol einer Gruppe = in die Gruppe, davor eingefügt (' + bes.join() + ')');
    sat({ type: 'neoGrp', a: 'wallet', g: 'gibtsnicht' }); sat({ type: 'neoGrp', a: '"><x', g: '-' }); await tick(80);
    assert(gOf('wallet') === 'besitz' && !/<x/.test(H.pub.neocom.html), 'falsche Gruppe/Name wird ignoriert');
    ['wallet', 'assets', 'industry', 'mining', 'workbench', 'prod'].forEach(a => sat({ type: 'neoGrp', a, g: '-' })); await tick(80);
    assert(ov().querySelector('.neo-g[data-neo-g="besitz"]') && !ov().querySelector('[data-g="besitz"]'), 'leere Gruppe bleibt als Ablageziel sichtbar');
    const ls = JSON.parse(w.localStorage.getItem('eve-zentrale-neocom-groups-v1') || '{}');
    assert(!ls.grp || !ls.grp['neo-btn-wallet'], 'die Gruppen der großen Leiste bleiben unverändert');
    const nc = H.pub.neocom; w.close();
    // Overlay-Fenster: Ziehen schickt die richtige Aktion
    const SH = { sat: [] };
    const shost = { getSettings: () => Promise.resolve({ windows: {} }), setSettings: () => Promise.resolve({}), onCommand(cb){ SH.cmd = cb; }, ready(){}, satAction(a){ SH.sat.push(a); }, satDrag(){}, closeSelf(){}, resizeTo(){}, resizeEnd(){}, satGrow(){} };
    w = makeWindow('https://claude.ai/artifact/test?fenster=neocom', shost, 'acc'); await tick(400); d = w.document;
    SH.cmd({ type: 'view', data: nc }); await tick(50);
    const ev = (t, x) => new w.MouseEvent(t, { bubbles: true, button: 0, clientX: x, clientY: 5 });
    const drag = async (src, dst) => { SH.sat.length = 0; d.elementFromPoint = () => dst; src.dispatchEvent(ev('pointerdown', 5)); await tick(450); src.dispatchEvent(ev('pointermove', 60)); w.dispatchEvent(ev('pointerup', 60)); return SH.sat[0]; };
    const q = s => d.querySelector('#ov-body ' + s);
    let a = await drag(q('[data-neo="wallet"]'), q('.neo-g[data-neo-g="handel"]'));
    assert(a && a.type === 'neoGrp' && a.a === 'wallet' && a.g === 'handel', 'auf Gruppen-Symbol loslassen = hinein (' + JSON.stringify(a) + ')');
    a = await drag(q('[data-neo="intel"]'), q('[data-neo="wallet"]'));
    assert(a && a.type === 'neoGrp' && a.a === 'intel' && a.g === '-' && a.b === 'wallet', 'aus der Gruppe auf ein Symbol oben = heraus, dort eingefügt');
    a = await drag(q('[data-neo="intel"]'), null);
    assert(a && a.type === 'neoGrp' && a.g === '-', 'aus der Gruppe auf freie Fläche = heraus');
    a = await drag(q('[data-neo="wallet"]'), null);
    assert(!a, 'Symbol ohne Gruppe auf freie Fläche = nichts');
    a = await drag(q('[data-neo="map"]'), q('[data-neo="intel"]'));
    assert(a && a.type === 'neoIns' && a.a === 'map', 'innerhalb derselben Gruppe = nur Reihenfolge');
    a = await drag(q('[data-neo="map"]'), q('.neo-g[data-neo-g="nav"]'));
    assert(!a, 'auf die eigene Gruppe = nichts');
    w.close();
    // Raster: weiter nur Reihenfolge
    w = makeWindow('https://claude.ai/artifact/test?fenster=neocom', shost, 'grid'); await tick(400); d = w.document;
    SH.cmd({ type: 'view', data: Object.assign({}, nc, { html: nc.html.replace(' data-mode="acc"', '') }) }); await tick(50);
    a = await drag(q('[data-neo="intel"]'), null);
    assert(!a, 'Raster: freie Fläche ändert keine Gruppe');
    w.close();
    console.log('ALL TESTS PASSED');
  }catch(e){ console.error(e); console.log('WW5 FAILED'); process.exit(1); }
})();
