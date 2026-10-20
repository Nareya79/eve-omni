// SD-A (30.09.2026): Anschluss für Stream-Tasten in main.js – echter HTTP-Server auf 127.0.0.1 (Schlüssel, Event-Stream, Befehle),
// Installieren kopiert das Plugin mit Port + Schlüssel; Seite: Befehle (Overlay, Timer, Jukebox) und Zustand; Einstellungen › Programm
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { JSDOM } = require('jsdom');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const html = fs.readFileSync('/tmp/eve-zentrale-test14.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const tick = ms => new Promise(r => setTimeout(r, ms || 80));
function req(port, method, p, body){ return new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'Content-Type': 'application/json' } }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ s: x.statusCode, d, h: x.headers })); }); r.on('error', rej); if (body) r.write(body); r.end(); }); }
(async () => {
  try{
    // ---- main.js-Teil mit Platzhaltern für Electron ausführen ----
    const i = main.indexOf('/* ---------------- SD: Stream-Tasten'), j = main.indexOf("ipcMain.on('evecore:ready',");
    assert(i > 0 && j > i, 'SD-A: Anschluss-Block in main.js');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-')), sent = [], ipc = {}, handles = {};
    const env = { S: { deck: { on: true, port: 0, key: 'geheim' } }, sent, calls: { toggle: 0, main: 0, save: 0 } };
    const fn = new Function('require', 'S', 'send', 'saveSettings', 'pushSettings', 'pushSettingsSoon', 'toggleShow', 'hideMain', 'showWin', 'applyWindowState', 'ipcMain', 'app', 'path', 'fs', 'win', 'env', '__dirname',
      main.slice(i, j) + '; env.api = { deckStart, deckStop, get srv(){ return deckSrv; } };');
    const port = 51000 + Math.floor(Math.random() * 1000); env.S.deck.port = port;
    fn(require, env.S, c => sent.push(c), () => env.calls.save++, () => {}, () => {}, () => env.calls.toggle++, () => {}, () => env.calls.main++, () => {},
      { on: (n, f) => ipc[n] = f, handle: (n, f) => handles[n] = f }, { getVersion: () => '9.9.9', getPath: () => tmp }, path, fs, null, env, '/home/claude');
    env.api.deckStart(); await tick(150);
    assert(env.api.srv, 'SD-A: Server läuft auf 127.0.0.1');
    assert(/deckSrv\.listen\(c\.port, '127\.0\.0\.1'\)/.test(main), 'SD-A: lauscht nur auf 127.0.0.1');
    let r = await req(port, 'GET', '/ping?k=falsch');
    assert(r.s === 403, 'SD-A: falscher Schlüssel → 403');
    r = await req(port, 'GET', '/ping?k=geheim');
    assert(r.s === 200 && JSON.parse(r.d).version === '9.9.9' && r.h['access-control-allow-origin'] === '*', 'SD-A: /ping mit Schlüssel, CORS für das Plugin');
    // Event-Stream
    ipc['evecore:deckState']({}, { dt: 1, tm: null });
    const got = []; const sr = http.get({ host: '127.0.0.1', port, path: '/events?k=geheim' }, x => x.on('data', c => got.push(String(c))));
    await tick(150);
    ipc['evecore:deckState']({}, { dt: 2, tm: { n: 'X', at: 5 } }); ipc['evecore:deckState']({}, { dt: 2, tm: { n: 'X', at: 5 } });
    await tick(150);
    const evs = got.join('').split('\n\n').filter(x => /^data:/.test(x));
    assert(evs.length === 2 && /"dt":1/.test(evs[0]) && /"dt":2/.test(evs[1]), 'SD-A: Stream schickt den Stand sofort und danach nur Änderungen');
    sr.destroy();
    // 4.0.21: Symbole nur einmal – neues Plugin bekommt sie, danach nur der kleine Stand; neue Symbolfarbe = einmal neu
    ipc['evecore:deckState']({}, { dt: 3, ic: { trades: '<svg>A</svg>' } });
    const got2 = []; const sr2 = http.get({ host: '127.0.0.1', port, path: '/events?k=geheim' }, x => x.on('data', c => got2.push(String(c))));
    await tick(150);
    ipc['evecore:deckState']({}, { dt: 4, ic: { trades: '<svg>A</svg>' } }); await tick(50);
    ipc['evecore:deckState']({}, { dt: 4, ic: { trades: '<svg>B</svg>' } }); await tick(150);
    const ev2 = got2.join('').split('\n\n').filter(x => /^data:/.test(x)).map(x => JSON.parse(x.slice(5)));
    assert(ev2.length === 3 && ev2[0].ic && ev2[0].dt === 3 && !ev2[1].ic && ev2[1].dt === 4 && ev2[2].ic.trades === '<svg>B</svg>', 'Tempo: Symbole nur beim Verbinden bzw. bei neuer Farbe, sonst nur der kleine Stand: ' + JSON.stringify(ev2.map(e => Object.keys(e))));
    sr2.destroy();
    // Befehle
    await req(port, 'POST', '/cmd?k=geheim', JSON.stringify({ type: 'ov', arg: 'trades' }));
    await req(port, 'POST', '/cmd?k=geheim', JSON.stringify({ type: 'toggleAll' }));
    await req(port, 'POST', '/cmd?k=geheim', JSON.stringify({ type: 'showMain' }));
    r = await req(port, 'POST', '/cmd?k=geheim', 'kaputt');
    assert(sent.length === 1 && sent[0].type === 'satAction' && sent[0].view === 'deck' && sent[0].action.arg === 'trades' && env.calls.toggle === 1 && env.calls.main === 1 && r.s === 400, 'SD-A: Befehle an die Seite (wie Overlay-Klick), alle zeigen/verstecken, Hauptfenster, Unsinn → 400');
    r = await req(port, 'POST', '/cmd?k=falsch', JSON.stringify({ type: 'ov', arg: 'x' }));
    assert(r.s === 403 && sent.length === 1, 'SD-A: Befehl ohne Schlüssel wird abgewiesen');
    // Installieren
    const miss = handles['evecore:deckInstall']({}, 'mirabox');
    assert(/nicht gefunden/.test(miss), 'SD-B: ohne MiraBox-Software klarer Hinweis');
    fs.mkdirSync(path.join(tmp, 'HotSpot', 'StreamDock'), { recursive: true });
    const orig = path.join('/home/claude', 'deck');
    const fn2 = new Function('require', 'S', 'send', 'saveSettings', 'pushSettings', 'pushSettingsSoon', 'toggleShow', 'hideMain', 'showWin', 'applyWindowState', 'ipcMain', 'app', 'path', 'fs', 'win', 'env', '__dirname', 'uiLang',
      'var TEST = false; ' + main.slice(i, j) + '; env.api2 = 1; env.deckLangSync = deckLangSync;');
    const h2 = {}; fn2(require, env.S, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, { on: () => {}, handle: (n, f) => h2[n] = f }, { getVersion: () => '9', getPath: () => tmp }, path, fs, null, env, '/home/claude', () => env.lang || 'de');
    const msg = h2['evecore:deckInstall']({}, 'mirabox'), dst = path.join(tmp, 'HotSpot', 'StreamDock', 'plugins', 'de.eveomni.tasten.sdPlugin');
    const cfg = fs.readFileSync(path.join(dst, 'plugin', 'config.js'), 'utf8');
    assert(/Installiert/.test(msg) && fs.existsSync(path.join(dst, 'manifest.json')) && cfg.indexOf('"key":"geheim"') >= 0 && cfg.indexOf('"port":' + port) >= 0, 'SD-B: Plugin kopiert, Port + Schlüssel ins Plugin geschrieben');
    assert(fs.existsSync(orig), 'SD-B: Plugin-Ordner liegt dem Programm bei');
    // SD-F: Elgato – gleicher Kern, eigenes Manifest (Knöpfe als Encoder mit Touch-Layout)
    fs.mkdirSync(path.join(tmp, 'Elgato', 'StreamDeck'), { recursive: true });
    const msgE = h2['evecore:deckInstall']({}, 'elgato'), dstE = path.join(tmp, 'Elgato', 'StreamDeck', 'plugins', 'de.eveomni.tasten.sdPlugin');
    const mfE = JSON.parse(fs.readFileSync(path.join(dstE, 'manifest.json'), 'utf8')), mfM = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
    assert(/Installiert/.test(msgE) && /Stream-Deck/.test(msgE) && mfE.SDKVersion === 2 && mfE.Actions.length === mfM.Actions.length && mfE.Actions.filter(x => x.Controllers[0] === 'Encoder' && x.Encoder.layout === '$A0').length === 4 &&
      mfM.Actions.filter(x => x.Controllers[0] === 'Knob').length === 4 && /window\.EVEOMNI/.test(fs.readFileSync(path.join(dstE, 'plugin', 'config.js'), 'utf8')), 'SD-F: Elgato-Plugin mit eigenem Manifest (4 Encoder), MiraBox bleibt bei Knob');
    // ZZ3: Sprache – Englisch schreibt englische Namen + lang in config.js; Sprachwechsel zieht installierte Plugins nach
    env.lang = 'en'; env.deckLangSync();
    const mfEn = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8')), mfEnE = JSON.parse(fs.readFileSync(path.join(dstE, 'manifest.json'), 'utf8'));
    assert(mfEn.Actions[0].Name === 'Overlay on/off' && /^Keys for EVE Omni/.test(mfEn.Description) && mfEnE.Actions.find(x => /dialJb$/.test(x.UUID)).Encoder.TriggerDescription.Rotate === 'Volume' && mfEn.Actions.length === mfM.Actions.length,
      'ZZ3: Sprachwechsel → englische Namen in beiden installierten Plugins (MiraBox + Elgato)');
    assert(/"lang":"en"/.test(fs.readFileSync(path.join(dst, 'plugin', 'config.js'), 'utf8')) && /"key":"geheim"/.test(fs.readFileSync(path.join(dst, 'plugin', 'config.js'), 'utf8')), 'ZZ3: config.js mit Sprache, Schlüssel bleibt');
    env.lang = 'de'; env.deckLangSync();
    assert(JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8')).Actions[0].Name === 'Overlay ein/aus', 'ZZ3: zurück auf Deutsch');
    env.api.deckStop();
    // ---- Seite: Befehle + Zustand + Einstellungen ----
    const patches = [], states = []; let cmdCb = null;
    const S = { windows: {}, deck: { on: true, port: 51780, key: 'abc' }, deckRun: true, deckClients: 1 };
    const w = new JSDOM(html, { runScripts:'dangerously', url:'https://claude.ai/artifact/test', pretendToBeVisual:true, beforeParse(x){ x.fetch = () => Promise.reject(new Error('offline'));
      x.evecoreHost = { getSettings: () => Promise.resolve(JSON.parse(JSON.stringify(S))), setSettings: p => { patches.push(p); if (p.windows) Object.keys(p.windows).forEach(k => S.windows[k] = Object.assign({}, S.windows[k], p.windows[k])); return Promise.resolve(JSON.parse(JSON.stringify(S))); },
        publishView(){}, onCommand(cb){ cmdCb = cb; }, ready(){}, setMode(){}, deckState: s => states.push(s), deckInstall: () => Promise.resolve('Installiert nach X') }; } }).window;
    await tick(1500);
    const T = w.__test;
    assert(states.length && states[states.length - 1].ov && states[states.length - 1].dt > Date.now() && 'jb' in states[states.length - 1], 'SD-A: Seite meldet jede Sekunde den Zustand (Overlays, Downtime, Timer, Jukebox)');
    T.ovSatAction('deck', { type: 'ov', arg: 'trades' }); await tick(50);
    assert(patches.some(p => p.windows && p.windows.trades && p.windows.trades.open === true), 'SD-A: Taste öffnet das Trades-Overlay');
    T.ovSatAction('deck', { type: 'timer', arg: 7, name: 'Probe' });
    const tm = JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1'));
    assert(tm.list.some(t => t.name === 'Probe' && t.v === 7 && t.mode === 'min'), 'SD-A: Taste startet Timer (7 Min., Name)');
    T.ovSatAction('deck', { type: 'tmDt' });
    assert(JSON.parse(w.localStorage.getItem('eve-zentrale-timers-v1')).dt.on === false, 'SD-A: Uhr-Taste schaltet den Downtime-Alarm');
    const d = w.document; T.switchTab('settings'); await tick(100);
    assert(d.getElementById('set-pane-program').contains(d.getElementById('hs-deck-on')) && d.getElementById('hs-deck-key').textContent === 'abc' && /1 Plugin verbunden/.test(d.getElementById('hs-deck-status').textContent), 'SD-A: Einstellungen › Programm zeigt an/aus, Schlüssel und „1 Plugin verbunden“');
    d.getElementById('hs-deck-install').click(); await tick(50);
    assert(/Installiert/.test(d.getElementById('hs-deck-status').textContent), 'SD-B: Knopf „Plugin für MiraBox installieren“');
    // SD-C: Aktion öffnet das Overlay zum Ergebnis, Leistungsdaten + Durchklicken im Zustand, sobald ein Plugin verbunden ist
    T.ovSatAction('deck', { type: 'dsClip', open: 'dscan' }); await tick(50);
    assert(patches.some(p => p.windows && p.windows.dscan && p.windows.dscan.open === true), 'SD-C: D-Scan-Taste öffnet das D-Scan-Overlay');
    await tick(1100); const ls = states[states.length - 1];
    assert(ls.pf === null && ls.ct === false && ls.x && Array.isArray(ls.x.chars), 'Tempo: ohne Leistungs-Taste keine Leistungsdaten (kein nvidia-smi/PowerShell im Hintergrund)');
    T.ovSatAction('deck', { type: 'perfWant' }); await tick(1100);
    const lp = states[states.length - 1];
    assert(lp.pf && 'cpu' in lp.pf && 'srvErr' in lp.pf, 'SD-C: mit Leistungs-Taste (Plugin meldet perfWant) kommen CPU/RAM/GPU/Ping/Server');
    // SD-D: Knopf 3 wechselt zwischen offenen Overlays, Knopf 2 ändert deren Deckkraft
    // Nachbesserung nach Test 2: Knopf 3 blättert durch alle Overlays, Knopf 2 gilt für alle, Zustand kommt sofort
    const so = T.getOvSatOpen(); so.trades = true; so.karte = true;
    const o0 = JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1') || '{}'); o0.alpha = 0.9; o0.alphaView = { karte: 0.6 }; w.localStorage.setItem('eve-zentrale-overlay-v1', JSON.stringify(o0));
    let n0 = states.length; T.ovSatAction('deck', { type: 'ovCycle', d: 1 }); await tick(100);
    const c1 = states[states.length - 1].cur;
    assert(states.length > n0 && c1.of > 10 && c1.n && typeof c1.open === 'boolean', 'SD-D: Overlays wechseln blättert durch alle Overlays, Zustand sofort (nicht erst nach 1 s): ' + JSON.stringify(c1));
    T.ovSatAction('deck', { type: 'ovAlpha', d: -2 }); await tick(100);
    let o1 = JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1'));
    assert(Math.abs(o1.alpha - 0.8) < 1e-9 && Math.abs(o1.alphaView.karte - 0.5) < 1e-9 && states[states.length - 1].aAll === 0.8, 'SD-D: Deckkraft −10 % für alle Overlays (eigener Wert der Karte geht mit)');
    T.ovSatAction('deck', { type: 'ovAlpha', set: 1 }); await tick(100);
    o1 = JSON.parse(w.localStorage.getItem('eve-zentrale-overlay-v1'));
    assert(o1.alpha === 1 && !Object.keys(o1.alphaView).length, 'SD-D: drücken = alle Overlays 100 %');
    console.log('ALL PASSED');
  }catch(e){ console.log(e.stack || e.message); process.exit(1); }
  process.exit(0);
})();
