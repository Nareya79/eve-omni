// SD-B (30.09.2026): Plugin im echten Browser – meldet sich bei der Tasten-Software an (wie MiraBox/Elgato), zeichnet 4 Tasten
// (Overlay, Timer, Jukebox, Uhr) online/offline, schickt beim Drücken den richtigen Befehl an EVE Omni, Einstellungsfenster
const { chromium } = require('playwright');
const fs = require('fs');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const DIR = '/home/claude/deck/de.eveomni.tasten.sdPlugin/';
const SHOT = '/tmp/sd-keys.png';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    const mf = JSON.parse(fs.readFileSync(DIR + 'manifest.json', 'utf8'));
    assert(mf.CodePath === 'plugin/index.html' && mf.Actions.length === 10 && mf.Actions.filter(a => a.Controllers[0] === 'Knob').length === 4 && mf.Actions.every(a => /^de\.eveomni\.tasten\./.test(a.UUID) && fs.existsSync(DIR + a.Icon) && fs.existsSync(DIR + a.PropertyInspectorPath)), 'SD-B/C/D: Manifest mit 10 Arten (inkl. Aktion, Anzeige, 4 Drehknöpfe), Symbole und Einstellungsfenster vorhanden');
    // echte Symbole aus EVE Omni (Symbolfarbe Gold) holen
    const ep = await b.newPage(); await ep.addInitScript(() => { window.fetch = () => Promise.reject(new Error('x')); });
    await ep.goto('file:///tmp/eve-zentrale-test14.html'); await ep.waitForTimeout(1200);
    const IC = await ep.evaluate(() => window.__test.deckIcons()); const ST = await ep.evaluate(() => window.__test.deckState()); await ep.close();
    assert(IC.trades && IC.musik && IC.uhr && IC.track && /^<svg xmlns=/.test(IC.trades) && /ic-l-/.test(IC.trades) && ST.icc && ST.ic === undefined || (ST.ic && ST.ic.trades), 'SD-B: EVE Omni schickt seine OmniCom-Symbole in der Symbolfarbe mit (' + (ST.icc || '') + ')');
    const p = await b.newPage();
    await p.addInitScript(() => {
      // Tasten-Software nachgebaut: WebSocket-Gegenstelle
      window.__sent = []; window.__cmds = [];
      class FakeWS { constructor(u){ this.u = u; window.__ws = this; setTimeout(() => this.onopen && this.onopen(), 10); } send(d){ window.__sent.push(JSON.parse(d)); } emit(m){ this.onmessage({ data: JSON.stringify(m) }); } }
      window.WebSocket = FakeWS;
      // EVE Omni nachgebaut: Event-Stream + Befehle
      class FakeES { constructor(u){ this.u = u; window.__es = this; } close(){} }
      window.EventSource = FakeES;
      window.fetch = (u, o) => { window.__cmds.push({ u: String(u), body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 204 }); };
    });
    await p.goto('file://' + DIR + 'plugin/index.html'); await p.evaluate(ic => { window.__IC = ic; }, IC);
    await p.evaluate(() => { window.EVEOMNI.key = 'k1'; });
    await p.evaluate(() => window.connectElgatoStreamDeckSocket(28196, 'PLUGINUUID', 'registerPlugin', '{}'));
    await p.waitForTimeout(100);
    let sent = await p.evaluate(() => window.__sent);
    assert(sent[0] && sent[0].event === 'registerPlugin' && sent[0].uuid === 'PLUGINUUID', 'SD-B: meldet sich bei der Tasten-Software an');
    assert(await p.evaluate(() => /127\.0\.0\.1:51780\/events\?k=/.test(window.__es.u)), 'SD-B: verbindet sich mit EVE Omni (127.0.0.1, Schlüssel)');
    // 4 Tasten erscheinen – offline
    await p.evaluate(() => { [['overlay', { view: 'track' }], ['timer', { min: 15 }], ['jukebox', {}], ['clock', {}]].forEach((k, i) => window.__ws.emit({ event: 'willAppear', action: 'de.eveomni.tasten.' + k[0], context: 'c' + i, payload: { settings: k[1] } })); });
    await p.waitForTimeout(100);
    sent = await p.evaluate(() => window.__sent.filter(m => m.event === 'setImage'));
    assert(sent.length === 4 && sent.every(m => /^data:image\/png;base64,/.test(m.payload.image)), 'SD-B: jede Taste bekommt ein Bild (offline)');
    // online: Zustand von EVE Omni
    const now = Date.now();
    await p.evaluate(n => window.__es.onmessage({ data: JSON.stringify({ ov: { track: true }, dt: n + 2 * 3600e3, dtOn: true, tm: { n: 'Extraktor', at: n + 125000 }, own: { n: 'Extraktor', at: n + 125000 }, jb: { t: 'EVE Omni Soundtrack – Titel 1', p: true }, clock: 'eve', icc: '#ffe29a', ic: window.__IC }) }), now);
    await p.waitForTimeout(100);
    const imgs = await p.evaluate(() => { const last = {}; window.__sent.filter(m => m.event === 'setImage').forEach(m => last[m.context] = m.payload.image); return last; });
    assert(Object.keys(imgs).length === 4 && sent.every(m => imgs[m.context] !== m.payload.image), 'SD-B: online neue Bilder für alle 4 Tasten');
    // Tasten drücken
    await p.evaluate(() => ['c0', 'c1', 'c2', 'c3'].forEach(c => window.__ws.emit({ event: 'keyDown', context: c, action: 'x' })));
    await p.waitForTimeout(50);
    const cmds = await p.evaluate(() => window.__cmds.map(c => c.body));
    assert(JSON.stringify(cmds) === JSON.stringify([{ type: 'ov', arg: 'track' }, { type: 'timer', arg: 15, name: '' }, { type: 'ov', arg: 'musik' }, { type: 'ov', arg: 'uhr' }]), 'SD-B: Drücken schickt Overlay/Timer/Jukebox/Uhr-Overlay-Befehl: ' + JSON.stringify(cmds));
    // Einstellungen ändern → neues Bild
    await p.evaluate(() => window.__ws.emit({ event: 'didReceiveSettings', context: 'c0', action: 'de.eveomni.tasten.overlay', payload: { settings: { view: 'karte' } } }));
    await p.evaluate(() => window.__ws.emit({ event: 'keyDown', context: 'c0', action: 'x' })); await p.waitForTimeout(50);
    assert(await p.evaluate(() => window.__cmds[window.__cmds.length - 1].body.arg === 'karte'), 'SD-B: geänderte Taste (Karte) schickt den neuen Befehl');
    // Bilder für den Screenshot nebeneinander
    const all = await p.evaluate(() => { const T = window.EVEOMNI_TEST, out = []; T.setState({ ov: { track: true }, dt: Date.now() + 600000, dtOn: true, tm: { n: 'Extraktor', at: Date.now() + 125000 }, own: { n: 'Extraktor', at: Date.now() + 125000 }, jb: { t: 'EVE Omni Soundtrack', p: true }, clock: 'both', icc: '#ffe29a', ic: window.__IC });
      Object.keys(T.keys).forEach(k => T.render(T.keys[k])); return new Promise(r => setTimeout(() => { Object.keys(T.keys).forEach(k => out.push(T.render(T.keys[k]).toDataURL())); T.setState(null, false); Object.keys(T.keys).forEach(k => out.push(T.render(T.keys[k]).toDataURL())); r(out); }, 300)); });
    const sp = await b.newPage({ viewport: { width: 4 * 152, height: 2 * 152 } });
    await sp.setContent('<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(4,144px);gap:8px">' + all.map(u => '<img src="' + u + '" style="border-radius:14px">').join('') + '</body>');
    await sp.screenshot({ path: SHOT });
    // SD-C: Aktion + Anzeige
    const c = await p.evaluate(n => {
      const T = window.EVEOMNI_TEST, ws = window.__ws, base = window.__cmds.length;
      const K = [['action', { act: 'refresh' }], ['action', { act: 'dscan' }], ['action', { act: 'ct' }], ['action', { act: 'jbNext' }], ['action', { act: 'ov', view: 'radar' }], ['action', { act: 'timer', min: 3 }],
        ['display', { show: 'ob' }], ['display', { show: 'wal', char: '2' }], ['display', { show: 'al' }], ['display', { show: 'sk' }], ['display', { show: 'pfCpu' }], ['display', { show: 'pfSrv', act: 'all' }],
        ['display', { show: 'moon' }], ['display', { show: 'mine' }], ['display', { show: 'loc' }], ['display', { show: 'pfPing' }]];
      Object.keys(T.keys).forEach(k => delete T.keys[k]);
      K.forEach((k, i) => ws.emit({ event: 'willAppear', action: 'de.eveomni.tasten.' + k[0], context: 'd' + i, payload: { settings: k[1] } }));
      T.setState({ ov: { radar: true }, ct: true, dt: n + 5400e3, dtOn: true, jb: { t: 'Titel 2', p: true }, clock: 'eve', icc: '#ffe29a', ic: window.__IC,
        x: { chars: [{ id: '1', n: 'Nareya Mythec' }, { id: '2', n: 'Zweitchar' }], ob: 3, act: { t: 4, l: 1 }, wal: { all: 2.35e9, by: { 1: 2e9, 2: 3.5e8 } },
          al: [{ d: 2, s: 'Uedama', who: 'Nareya Mythec' }], loc: { n: 42, red: 2 }, moon: { n: 'Jita IV - Moon 4', at: n + 3 * 3600e3 }, mine: { all: 1.2e8, by: { 1: 1.2e8 } },
          sk: [{ id: '1', n: 'Nareya Mythec', al: '', end: n + 9 * 86400e3 }, { id: '2', n: 'Zweitchar', al: 'red', end: 0 }] },
        pf: { ping: 31, cpu: 92, cpuTemp: 71, ram: 55, gpu: 40, gpuTemp: 66, srv: { pl: 23456, vip: false } } });
      K.forEach((k, i) => T.render(T.keys['d' + i]));   // Symbole laden (asynchron)
      K.forEach((k, i) => ws.emit({ event: 'keyDown', context: 'd' + i, action: 'x' }));
      return new Promise(r => setTimeout(() => r({ cmds: window.__cmds.slice(base).map(c => c.body).filter(b => b.type !== 'perfWant'), pw: window.__cmds.slice(base).filter(c => c.body.type === 'perfWant').length, imgs: K.map((k, i) => T.render(T.keys['d' + i]).toDataURL()) }), 300));
    }, Date.now());
    const want = [{ type: 'refresh', arg: 'trades' }, { type: 'dsClip', open: 'dscan' }, { type: 'clickThrough' }, { type: 'jb', cmd: 'next' }, { type: 'ov', arg: 'radar' }, { type: 'timer', arg: 3, name: '' },
      { type: 'ov', arg: 'trades' }, { type: 'ov', arg: 'wallet' }, { type: 'ov', arg: 'alarm' }, { type: 'ov', arg: 'skills' }, { type: 'ov', arg: 'leistung' }, { type: 'toggleAll' },
      { type: 'ov', arg: 'mining' }, { type: 'ov', arg: 'mining' }, { type: 'ov', arg: 'local' }, { type: 'ov', arg: 'leistung' }];
    assert(JSON.stringify(c.cmds) === JSON.stringify(want), 'SD-C: Aktionen, Anzeigen (passendes Overlay) und Kombi-Taste schicken die richtigen Befehle: ' + JSON.stringify(c.cmds));
    assert(new Set(c.imgs).size === c.imgs.length, 'SD-C: jede Aktion/Anzeige hat ein eigenes Bild');
    assert(c.pw === 1, 'Tempo: Plugin meldet Leistungs-Anzeigen einmal (perfWant), nicht je Taste: ' + c.pw);
    const sp2 = await b.newPage({ viewport: { width: 8 * 152, height: 2 * 152 } });
    await sp2.setContent('<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(8,144px);gap:8px">' + c.imgs.map(u => '<img src="' + u + '" style="border-radius:14px">').join('') + '</body>');
    await sp2.screenshot({ path: '/tmp/sd-c-keys.png' });
    // SD-D: Drehknöpfe – drehen, drücken, Touch-Streifen
    const dd = await p.evaluate(n => {
      const T = window.EVEOMNI_TEST, ws = window.__ws, base = window.__cmds.length, sent0 = window.__sent.length;
      ['dialJb', 'dialAlpha', 'dialOv', 'dialTimer'].forEach((k, i) => ws.emit({ event: 'willAppear', action: 'de.eveomni.tasten.' + k, context: 'k' + i, payload: { settings: i === 3 ? { min: 10 } : {}, controller: 'Knob' } }));
      T.setState({ ov: { trades: true, karte: true }, cur: { v: 'karte', n: 'Karte', i: 7, of: 23, open: true }, aAll: 0.7, dt: n + 5400e3, own: { n: 'Probe', at: n + 95000 }, jb: { t: 'EVE Omni Soundtrack – Titel 1', p: true, vol: 0.6 }, icc: '#ffe29a', ic: window.__IC });
      ['k0', 'k1', 'k2', 'k3'].forEach(c => T.strip(T.keys[c]));   // Symbole laden
      ws.emit({ event: 'dialRotate', context: 'k0', payload: { ticks: 2 } }); ws.emit({ event: 'dialRotate', context: 'k1', payload: { ticks: -1 } });
      ws.emit({ event: 'dialRotate', context: 'k2', payload: { ticks: 1 } }); ws.emit({ event: 'dialRotate', context: 'k3', payload: { ticks: 5 } });
      ['k0', 'k1', 'k2', 'k3'].forEach(c => ws.emit({ event: 'dialDown', context: c, payload: {} }));
      ws.emit({ event: 'touchTap', context: 'k1', payload: {} });
      return new Promise(r => setTimeout(() => r({ cmds: window.__cmds.slice(base).map(c => c.body).filter(b => b.type !== 'perfWant'), saved: window.__sent.slice(sent0).filter(m => m.event === 'setSettings').map(m => m.payload.min),
        imgs: ['k0', 'k1', 'k2', 'k3'].map(c => T.strip(T.keys[c]).toDataURL()) }), 300));
    }, Date.now());
    const wantD = [{ type: 'jb', cmd: 'volup' }, { type: 'jb', cmd: 'volup' }, { type: 'ovAlpha', d: -1 }, { type: 'ovCycle', d: 1 },
      { type: 'jb', cmd: 'toggle' }, { type: 'ovAlpha', set: 1 }, { type: 'ov', arg: 'karte' }, { type: 'timer', arg: 15, name: '' }, { type: 'ovAlpha', set: 1 }];
    const srt = x => x.map(c => JSON.stringify(c)).sort().join();   // 4.0.32: Dreh-Befehle kommen gesammelt (50 ms) – Reihenfolge egal
    assert(srt(dd.cmds) === srt(wantD) && dd.saved.join() === '15', 'SD-D: Knöpfe drehen/drücken (Lautstärke, Deckkraft, Overlay wechseln/vorne, Timer 10→15 Min. gemerkt): ' + JSON.stringify(dd.cmds));
    const sp3 = await b.newPage({ viewport: { width: 4 * 204, height: 104 } });
    await sp3.setContent('<body style="margin:0;background:#333;display:grid;grid-template-columns:repeat(4,200px);gap:4px">' + dd.imgs.map(u => '<img src="' + u + '">').join('') + '</body>');
    await sp3.screenshot({ path: '/tmp/sd-d-strip.png' });
    // Einstellungsfenster
    const pi = await b.newPage();
    await pi.addInitScript(() => { window.__pis = []; window.WebSocket = class { constructor(){ setTimeout(() => this.onopen && this.onopen(), 5); } send(d){ window.__pis.push(JSON.parse(d)); } }; });
    await pi.goto('file://' + DIR + 'pi/index.html');
    await pi.evaluate(() => window.connectElgatoStreamDeckSocket(1, 'PIUUID', 'registerPropertyInspector', '{}', JSON.stringify({ action: 'de.eveomni.tasten.overlay', context: 'c0', payload: { settings: { view: 'radar' } } })));
    await pi.waitForTimeout(50);
    assert(await pi.evaluate(() => !document.getElementById('f-view').hidden && document.getElementById('f-min').hidden && document.getElementById('view').value === 'radar'), 'SD-B: Einstellungen einer Overlay-Taste zeigen die Auswahl (Radar)');
    await pi.selectOption('#view', 'mining'); await pi.waitForTimeout(30);
    const ps = await pi.evaluate(() => window.__pis);
    assert(ps[0].event === 'registerPropertyInspector' && ps.some(m => m.event === 'setSettings' && m.context === 'PIUUID' && m.payload.view === 'mining'), 'SD-B: Auswahl wird in der Tasten-Software gespeichert');
    // SD-C: Einstellungsfenster einer Anzeige-Taste (Anzeige, Charakter nur wo sinnvoll, Drücken = Kombi)
    const pd = await b.newPage();
    await pd.addInitScript(() => { window.__pis = []; window.WebSocket = class { constructor(){ setTimeout(() => this.onopen && this.onopen(), 5); } send(d){ window.__pis.push(JSON.parse(d)); } };
      window.EventSource = class { constructor(){ setTimeout(() => this.onmessage({ data: JSON.stringify({ x: { chars: [{ id: '7', n: 'Nareya Mythec' }] } }) }), 5); } close(){} }; });
    await pd.goto('file://' + DIR + 'pi/index.html');
    await pd.evaluate(() => window.connectElgatoStreamDeckSocket(1, 'PD', 'registerPropertyInspector', '{}', JSON.stringify({ action: 'de.eveomni.tasten.display', context: 'd0', payload: { settings: { show: 'ob' } } })));
    await pd.waitForTimeout(60);
    assert(await pd.evaluate(() => !document.getElementById('f-show').hidden && document.getElementById('f-char').hidden && !document.getElementById('f-act').hidden && document.getElementById('act').value === ''), 'SD-C: Anzeige-Taste: Auswahl Anzeige + Drücken, kein Charakter bei „überbotene Trades“');
    await pd.selectOption('#show', 'wal'); await pd.waitForTimeout(30);
    assert(await pd.evaluate(() => !document.getElementById('f-char').hidden && document.getElementById('char').options.length === 2), 'SD-C: Wallet: Charakter wählbar (alle + Charaktere aus EVE Omni)');
    await pd.selectOption('#char', '7'); await pd.selectOption('#act', 'timer'); await pd.waitForTimeout(30);
    const pds = await pd.evaluate(() => window.__pis.filter(m => m.event === 'setSettings').pop().payload);
    assert(pds.show === 'wal' && pds.char === '7' && pds.act === 'timer' && await pd.evaluate(() => !document.getElementById('f-min').hidden), 'SD-C: Auswahl gespeichert, Timer-Minuten erscheinen bei Kombi „Timer“');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.stack || e.message); await b.close(); process.exit(1); }
  await b.close(); process.exit(0);
})();
