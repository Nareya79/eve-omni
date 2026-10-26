// Einzelfenster (Programm): Hauptfenster schickt Ansichten an die Einzelfenster, neue Ansichten Scanner-Plan/Hauling/Hub-Handel,
// Einzelfenster-Modus (EVECore.html?fenster=...): Anzeige, Kopieren, Standort, Schliessen, Aktualisieren.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
const HUBS = { jita: { label: 'Jita (The Forge)', stationName: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant' }, amarr: { label: 'Amarr (Domain)', stationName: 'Amarr VIII (Oris) - Emperor Family Academy' } };
function makeWindow(url, host, extra){
  return new JSDOM(html, {
    runScripts:'dangerously', resources:'usable', url, pretendToBeVisual:true,
    beforeParse(w){
      Object.keys(extra || {}).forEach(k => w.localStorage.setItem(k, extra[k]));
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip = t; return Promise.resolve(); } } });
      w.__calls = [];
      w.fetch = u => { w.__calls.push(String(u)); return Promise.reject(new Error('offline')); };
      if (host) w.evecoreHost = host;
    }
  }).window;
}
(async () => {
  try{
    // ================= Hauptfenster =================
    let S = { transparent: false, alwaysOnTop: true, hotkeys: {}, hotkeyStatus: {}, backup: {}, windows: { scanner: { open: true }, handel: { open: true }, route: { open: true } } };
    const H = { pub: {}, patches: [] };
    const host = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))),
      setSettings: p => { H.patches.push(p); if (p.windows) Object.keys(p.windows).forEach(k => S.windows[k] = Object.assign({}, S.windows[k], p.windows[k])); return Promise.resolve(JSON.parse(JSON.stringify(S))); },
      publishView: (id, data) => { H.pub[id] = data; }, onCommand(cb){ H.cmd = cb; }, ready(){}, setMode(){} };
    const route = { from:'Jita', to:'Amarr', last:{ from:{id:1,name:'Jita'}, to:{id:3,name:'Amarr'}, pref:'secure', route:[1,2,3], alts:{}, avoidIds:[], autoAvoided:[], time:Date.now(), pos:0 } };
    const syscache = { sys:{ 1:{n:'Jita',s:0.9}, 2:{n:'Perimeter',s:1}, 3:{n:'Amarr',s:1} }, reg:{} };
    let w = makeWindow('https://claude.ai/artifact/test', host, { 'eve-zentrale-esiroute-v1': JSON.stringify(route), 'eve-zentrale-syssec-v1': JSON.stringify(syscache) });
    await tick(600);
    let d = w.document, $ = id => d.getElementById(id), T = w.__test;
    assert(T.getOvSatOpen().scanner && T.getOvSatOpen().handel && !T.getOvSatOpen().trades, 'Geöffnete Einzelfenster aus den Programm-Einstellungen übernommen');
    T.setOvData({ tscRows: [
      { tid: 1001, name: 'Damage Control II', inPlan: true, myBuy: 99510, mySell: 120200, qty: 120, capital: 11941200, unit: 14567.89, profit: 1748146.8, perDay: 400000, margin: 14.6 },
      { tid: 1002, name: 'Nicht im Plan', inPlan: false, myBuy: 1, mySell: 2, qty: 1, capital: 1, unit: 0.5, profit: 0.5, perDay: 0, margin: 1 } ],
      hub: { t: Date.now(), src: HUBS.jita, dst: HUBS.amarr, profit: 25000000, spend: 300000000, volUsed: 250000, cargo: 390000, budget: 450000000, strategy: 'x',
             rows: [{ name: 'Tritanium', q: 1000000, sp: 4000000, p: 500000, vol: 0.01, totalVol: 10000, avgBuy: 4, avgSell: 4.6 }] } });
    T.ovPublishSatellites(); await tick(80);
    assert(Object.keys(H.pub).sort().join(',') === 'handel,route,scanner', 'Nur offene Einzelfenster bekommen Daten: ' + Object.keys(H.pub));
    const sc = H.pub.scanner;
    assert(sc.title === 'Scanner-Plan' && /Damage Control II/.test(sc.html) && !/Nicht im Plan/.test(sc.html), 'Scanner-Plan zeigt nur Items im Plan');
    assert(/data-copy="99510"/.test(sc.html) && /data-copy="120"/.test(sc.html) && /data-copy="120200"/.test(sc.html), 'Kaufpreis, Menge, Verkaufspreis kopierbar (exakt)');
    assert(/Gewinn netto <b class="ov-pf">\+14\.567,89 ISK<\/b>\/Stk · gesamt <b class="ov-pf">\+1,75 <span class="ov-u">Mio\.<\/span> ISK<\/b>/.test(sc.html), 'Gewinn netto pro Stück und gesamt (AG8: grün)');
    assert(/Scan: /.test(sc.foot.age) && sc.look && 'alpha' in sc.look, 'Fußzeile + Aussehen werden mitgeschickt');
    const hb = H.pub.handel;
    assert(/Jita → Amarr/.test(hb.html) && /Tritanium/.test(hb.html) && /data-copy="1000000"/.test(hb.html) && /<b class="ov-pf">\+500 <span class="ov-u">Tsd\.<\/span> ISK/.test(hb.html) && /class="hl-w"/.test(hb.html), 'Hub-Handel: Ladung mit Menge und Gewinn (G1: Warenliste)');
    assert(/data-rt-pos="2"/.test(H.pub.route.html), 'Route: Zeilen tragen die Position');
    // Hauling
    T.setOvData({ haul: { t: Date.now(), origin: 'Jita IV - Moon 4', list: [{ stationName: 'Perimeter - Station', systemName: 'Perimeter', jumps: 1, itemCount: 12, profit: 8000000 }] } });
    const box = d.createElement('div'); T.ovRenderViewInto('hauling', box);
    assert(/→ Perimeter/.test(box.innerHTML) && /⇢ 1 <span>Spr\.<\/span>/.test(box.innerHTML) && /\+8 Mio\./.test(box.textContent), 'Hauling-Ansicht mit Ziel, Sprüngen, Gewinn (K1: Zeile wie Watchlist)');
    // Aktionen aus dem Einzelfenster
    H.cmd({ type: 'satAction', view: 'route', action: { type: 'rtPos', i: 2 } }); await tick(50);
    assert(T.rtLoad().last.pos === 2, 'Standort aus dem Einzelfenster übernommen');
    H.cmd({ type: 'satAction', view: 'handel', action: { type: 'openMain' } }); await tick(50);
    assert($('panel-intensiv').classList.contains('active'), '„In großer Ansicht öffnen“ springt zum passenden Bereich (Hub-Handel)');
    // Abtrennen aus der Kompaktansicht
    T.ovSetMode('compact'); await tick(50);
    const s0 = T.ovLoad(); s0.view = 'wallet'; T.ovSave(s0); T.ovRender();
    $('ov-detach').onclick(); await tick(80);
    assert(H.patches.some(p => p.windows && p.windows.wallet && p.windows.wallet.open === true), '⧉ öffnet die aktuelle Ansicht als eigenes Fenster');
    assert(T.getOvSatOpen().wallet === true, 'Einzelfenster-Liste aktualisiert');
    // Einstellungen: Haken "eigenes Fenster"
    T.ovSetMode('full');
    const wc = $('ovs-w-skills');
    assert(wc && !wc.checked && $('ovs-w-scanner').checked, 'Einstellungen zeigen, welche Ansichten ein eigenes Fenster haben');
    wc.checked = true; wc.onchange(); await tick(50);
    assert(S.windows.skills.open === true, 'Haken öffnet Einzelfenster');
    w.close();

    // ================= Einzelfenster =================
    const SH = { actions: [], closed: 0, ready: 0 };
    const shost = { getSettings: () => Promise.resolve({ transparent: true, clickThrough: false, alwaysOnTop: true }),
      setSettings: p => Promise.resolve(Object.assign({ transparent: true }, p)), onCommand(cb){ SH.cmd = cb; }, ready(){ SH.ready++; },
      satAction: a => SH.actions.push(a), closeSelf: () => SH.closed++, resizeTo(){}, resizeEnd(){} };
    w = makeWindow('https://claude.ai/artifact/test?fenster=scanner', shost, { 'eve-zentrale-characters': JSON.stringify([{ access_token:'a', refresh_token:'r', expires_at:Date.now()+3600000, character_id:'1', character_name:'X' }]) });
    await tick(400);
    d = w.document; $ = id => d.getElementById(id);
    assert(d.documentElement.classList.contains('sat-win') && d.body.classList.contains('ov-mode') && SH.ready === 1, 'Einzelfenster-Modus aktiv, meldet sich beim Programm');
    assert(!w.__test && w.__calls.length === 0, 'Einzelfenster lädt nichts von EVE (keine Logins, keine Abfragen)');
    assert(d.documentElement.classList.contains('host-transparent'), 'Transparenz-Einstellung übernommen');
    SH.cmd({ type: 'view', data: Object.assign({}, sc, { look: { scheme: 'amarr', alpha: 0.5, scale: 1.1 }, badge: 0 }) }); await tick(30);
    assert(/Damage Control II/.test($('ov-body').textContent) && $('ov-tabs').textContent === 'Scanner-Plan', 'Ansicht und Titel angezeigt');
    assert(d.documentElement.getAttribute('data-scheme') === 'amarr' && d.documentElement.style.getPropertyValue('--ov-alpha') === '0.5', 'Farbschema und Deckkraft übernommen');
    d.querySelector('#ov-body .tsc-cp-b[data-copy="99510"]').click(); await tick(30);
    assert(w.__clip === '99510', 'Kopieren im Einzelfenster');
    assert(['ov-refresh','ov-full','ov-detach'].every(i => $(i).closest('.ov-lgrp')) && !['ov-ct','ov-pin','ov-settings','ov-hide'].some(i => $(i).closest('.ov-lgrp')), 'Y2: Inhalt-Knöpfe links, Fenster-Knöpfe rechts');
    $('ov-refresh').onclick(); $('ov-full').onclick(); $('ov-hide').onclick();
    assert(SH.actions.map(a => a.type).join(',') === 'refresh,openMain' && SH.closed === 1, 'Aktualisieren, große Ansicht, Schließen gehen ans Programm');
    SH.cmd({ type: 'view', data: { title: 'Route', html: H.pub.route.html, foot: { age: 'x', next: '' }, look: {} } }); await tick(30);
    d.querySelector('#ov-body [data-rt-pos="1"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(20);
    assert(SH.actions.some(a => a.type === 'rtPos' && a.i === 1), 'Klick auf System = Standort ans Hauptfenster');
    // U2: Kopieren/Markt in einer aufklappbaren Karte klappt nicht zu, Kopieren geht ueber das Programm
    shost.copyText = t => { SH.copied = t; return Promise.resolve(true); };
    SH.cmd({ type: 'view', data: { title: 'Watchlist', html: '<div class="trk-sm" data-ova="trkDet" data-arg="t1"><button class="tsc-cp-b" data-copy="1.234,50">⎘</button><button data-mk="34">↗</button></div>', foot: {}, look: {} } }); await tick(30);
    const nAct = SH.actions.length;
    d.querySelector('#ov-body .tsc-cp-b').click(); d.querySelector('#ov-body [data-mk]').click(); await tick(30);
    assert(SH.copied === '1.234,50' && !SH.actions.slice(nAct).some(a => a.type === 'trkDet') && SH.actions.slice(nAct).some(a => a.type === 'mk' && a.tid === 34), 'U2: Preis kopieren + Markt öffnen, Karte bleibt wie sie ist');
    delete shost.copyText;
    SH.cmd({ type: 'view', data: { title: 'Trades', html: '<div><span data-ov-until="' + (Date.now() + 125000) + '">x</span></div>', foot: {}, look: {}, badge: 2 } });
    await tick(1100);
    assert(/^2:0\d$/.test(d.querySelector('[data-ov-until]').textContent) && /2/.test(d.querySelector('.ov-badge').textContent), 'Countdown läuft im Einzelfenster weiter, Alarm-Zähler sichtbar');
    // L7: Gang-Alarm-Fenster passt die Hoehe dem Inhalt an (Layout in jsdom nachgebaut)
    const AH = { sizes: [] };
    w = makeWindow('https://claude.ai/artifact/test?fenster=alarm', Object.assign({}, shost, { onCommand(cb){ AH.cmd = cb; }, ready(){}, resizeTo(a, b){ AH.sizes.push([a, b]); } }));
    await tick(400);
    d = w.document;
    w.HTMLElement.prototype.getBoundingClientRect = function(){ return this.id === 'ov-body' ? { top: 30, bottom: 500 } : { top: 40, bottom: 120 }; };
    Object.defineProperty(d.getElementById('ov-body'), 'clientHeight', { value: 470 });
    AH.cmd({ type: 'view', data: { title: 'Gang-Alarm', html: '<div class="ov-card">Feind in Jita</div>', foot: {}, look: {} } }); await tick(100);
    const want = w.innerHeight - 470 + 90 + 6;
    assert(AH.sizes.length === 1 && AH.sizes[0][1] === want && AH.sizes[0][0] === w.innerWidth, 'L7: Gang-Alarm-Fenster wird genau so hoch wie die Meldung');
    console.log('\nALL SATELLITE TESTS PASSED');
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
