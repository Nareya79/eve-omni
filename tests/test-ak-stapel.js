// AK Block A (19.10.2026): Overlays stapeln wie in EVE – Stapel-Funktionen aus main.js mit Attrappen-Fenstern ausführen,
// dazu Seite (Reiter zeichnen, Klick, Herausziehen, „Lösen“) und Anschlüsse in preload.js prüfen.
const fs = require('fs'), vm = require('vm');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const pre = fs.readFileSync('/home/claude/preload.js', 'utf-8');
const html = fs.readFileSync('/home/claude/EVECore.html', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
try{
  const a = main.indexOf('const STACK_NO'), b = main.indexOf('\n}', main.indexOf('function stackHover')) + 2;
  assert(a > 0 && b > a, 'Stapel-Code in main.js gefunden');
  function Win(x){ return { b: { x, y: 100, width: 300, height: 400 }, vis: true, op: 1, sent: [], showInactive(){ this.vis = true; }, isDestroyed: () => false, getBounds(){ return Object.assign({}, this.b); }, setBounds(n){ this.b = Object.assign({}, this.b, n); },
    isVisible(){ return this.vis; }, hide(){ this.vis = false; }, webContents: { send(){} } }; }
  const sats = { trades: Win(0), skills: Win(400), wallet: Win(800), karte: Win(1200) };
  const S = { windows: { trades: { open: true }, skills: { open: true }, wallet: { open: true }, karte: { open: true } }, stacks: [] };
  const ctx = { S, sats, VIEWS: { trades: 1, skills: 1, wallet: 1, karte: 1 }, setTimeout: f => f(), console,
    openSat: id => sats[id], soft: 0, satShowSoft: (w, done) => { ctx.soft++; w.vis = true; ctx.applySatState(w); if (done) done(); },
    applySatState: w => { w.op = ctx.f.stackHidden(Object.keys(sats).find(k => sats[k] === w)) ? 0 : 1; }, saveSettings(){}, pushSettings(){}, neoTraceAdd(){},
    clampToWork: b => b, satIdsByZ: () => Object.keys(sats), satZTouch(){}, satActiveSet: w => { ctx.act = Object.keys(sats).find(k => sats[k] === w); },
    closed: [], closeSat: id => { ctx.closed.push(id); ctx.f.stackDrop(id, sats[id].getBounds()); }, sent: [], send: c => ctx.sent.push(c) };
  vm.createContext(ctx);
  vm.runInContext(main.slice(a, b) + '\nthis.f = { stackJoin, stackShow, stackOut, stackDrop, stackTarget, stackHidden, stackClean, stackOf, stackShare, stackCloseAll };', ctx);
  const f = ctx.f;
  const on = w => w.vis && w.op === 1, back = w => w.vis && w.op === 0;   // hinten = sichtbar mit Deckkraft 0 (zeichnet weiter, kein Blinken)
  // Ziehen: skills auf die Kopfleiste von trades
  assert(f.stackTarget(sats.skills, { x: 50, y: 110 }) === 'trades', 'Maus über Kopfleiste von trades = Ziel');
  assert(f.stackTarget(sats.skills, { x: 50, y: 300 }) === null, 'Maus im Inhalt = kein Ziel');
  assert(f.stackTarget(sats.skills, { x: 1250, y: 110 }) === null, 'Karte nimmt nichts an');
  assert(f.stackTarget(sats.karte, { x: 50, y: 110 }) === null, 'Karte lässt sich nicht stapeln');
  f.stackJoin('skills', 'trades');
  assert(JSON.stringify(S.stacks) === '[{"ids":["trades","skills"],"tab":"skills"}]', 'Stapel trades+skills, gezogenes Overlay vorne');
  assert(sats.skills.b.x === 0 && on(sats.skills) && back(sats.trades), 'skills liegt an der Stelle von trades, trades unsichtbar dahinter');
  assert(f.stackHidden('trades') && !f.stackHidden('skills'), 'stackHidden');
  // Reiter wechseln
  ctx.soft = 0; f.stackShow('trades');
  assert(S.stacks[0].tab === 'trades' && on(sats.trades) && back(sats.skills) && ctx.soft === 0, 'Reiter-Klick: nur Deckkraft tauschen, kein Einblenden (Nutzer: Blinken)');
  f.stackShow('skills'); sats.skills.b.x = 20;   // Stapel verschoben
  f.stackShow('trades');
  assert(on(sats.trades) && back(sats.skills) && sats.trades.b.x === 20, 'Reiter-Klick: trades vorne an der neuen Stelle');
  assert(ctx.act === 'trades', 'Reiter-Klick macht trades gleich aktiv (Nutzer: erst nach dem 2. Klick)');
  // dritter dazu, dann Stapel auf Stapel
  f.stackJoin('wallet', 'trades');
  assert(S.stacks[0].ids.join() === 'trades,skills,wallet' && S.stacks[0].tab === 'wallet', 'drittes Overlay als Reiter');
  f.stackJoin('wallet', 'skills');
  assert(S.stacks.length === 1, 'eigenen Stapel nicht auf sich selbst legen');
  // Herauslösen an der Maus
  f.stackOut('wallet', 900, 500);
  assert(S.stacks[0].ids.join() === 'trades,skills' && S.stacks[0].tab === 'trades' && on(sats.trades), 'Lösen: nächster Reiter rückt nach vorne');
  assert(sats.wallet.b.x === 840 && sats.wallet.b.y === 488 && on(sats.wallet), 'gelöstes Fenster an der Maus');
  f.stackOut('skills');
  assert(S.stacks.length === 0 && on(sats.skills) && on(sats.trades), 'zwei → einer: Stapel aufgelöst, Fenster sichtbar');
  // Schließen des vorderen Reiters
  f.stackJoin('skills', 'trades');
  S.windows.skills.open = false; f.stackDrop('skills', { x: 5, y: 6, width: 300, height: 400 });
  assert(S.stacks.length === 0 && on(sats.trades) && sats.trades.b.x === 5, 'vorderen Reiter schließen: anderer an seine Stelle');
  // Schließen über die Einstellungen: syncSats räumt zuerst auf, satPark → stackDrop danach – nächster Reiter muss trotzdem nach vorn
  f.stackJoin('skills', 'trades');
  S.windows.skills.open = false; f.stackClean();
  assert(S.stacks.length === 1 && S.stacks[0].tab === 'skills', 'Aufräumen lässt das noch offene Fenster im Stapel');
  f.stackDrop('skills', { x: 7, y: 6, width: 300, height: 400 });
  assert(S.stacks.length === 0 && on(sats.trades) && sats.trades.b.x === 7, 'danach rückt trades sichtbar an seine Stelle');
  // Neustart: ungültige Stapel aufräumen
  S.windows.skills.open = true;
  S.stacks = [{ ids: ['trades', 'skills', 'karte', 'nix'], tab: 'nix' }, { ids: ['wallet'], tab: 'wallet' }, { ids: ['skills', 'wallet'] }];
  f.stackClean();
  assert(JSON.stringify(S.stacks) === '[{"ids":["trades","skills"],"tab":"trades"}]', 'Neustart: Karte/unbekannte/doppelte raus, Einzel-Stapel weg, Reiter gültig');
  // AK3: Einstellungen für den ganzen Stapel
  S.windows.trades = Object.assign(S.windows.trades, { lock: true, autoClose: 30 }); S.windows.wallet = Object.assign(S.windows.wallet, { lock: false, ct: true });
  ctx.sent.length = 0; f.stackJoin('wallet', 'trades');
  assert(S.windows.wallet.lock === true && S.windows.wallet.autoClose === 30 && S.windows.wallet.ct === true, 'Stapeln: Einstellungen des Ziels gelten für das gezogene Overlay (ct ohne Wert im Ziel bleibt)');
  assert(ctx.sent.some(c => c.action && c.action.type === 'stackLook' && c.view === 'trades'), 'Stapeln: Hintergrund des Ziels an die Seite');
  f.stackShare({ wallet: { top: false, lock: false, zoom: 2 } });
  assert(S.windows.trades.top === false && S.windows.trades.lock === false && S.windows.trades.zoom === undefined && S.windows.skills.top === false, 'Sperren/Vordergrund gelten für alle Reiter, Zoom nicht');
  ctx.closed.length = 0; f.stackCloseAll('trades');
  assert(ctx.closed.join() === 'trades,skills,wallet'.split(',').filter(k => k !== 'wallet').concat(['wallet']).join() && S.stacks.length === 0, '✕ in der Leiste: ganzer Stapel, vorderer Reiter zuletzt');
  ctx.closed.length = 0; f.stackCloseAll('karte');
  assert(ctx.closed.join() === 'karte', 'ohne Stapel: nur das eine Fenster');
  // Einbindung main.js
  assert(/if \(data && data\.html !== undefined\) stackBadge\(id, data\.badge\);/.test(main) && /o\.satBadges = satBadges;/.test(main) && /type: 'stackBadges', badges: satBadges/.test(main), 'Warnzahl je Ansicht gemerkt und an den Stapel gegeben (Nutzer 19.10.)');
  assert(/var bg = \(s\.satBadges \|\| \{\}\)\[id\]; if \(bg\)\{/.test(html) && /cmd\.type === "stackBadges"\)\{ hostS\.satBadges = cmd\.badges \|\| \{\}; stackTabs\(hostS\); \}/.test(html), 'hinterer Reiter zeigt die gelbe Zahl');
  assert(/if \(patch\.windows\) stackShare\(patch\.windows\);/.test(main) && /stackShare\(o\); saveSettings\(\); pushSettings\(\); \};\n  eoMenuAt\(/.test(main), 'Einstellungen aus Seite und Fenstermenü gehen an den ganzen Stapel');
  assert(/if \(sid\)\{ neoClickAt = Date\.now\(\); stackCloseAll\(sid\); \}/.test(main) && /ipcMain\.on\('evecore:stackClose'/.test(main) && /stackClose: id =>/.test(pre), '✕ Leiste = Stapel, ✕ Reiter = eine Ansicht');
  assert(/ipcMain\.on\('evecore:stackFront'/.test(main) && /stackFront: id =>/.test(pre) && /x\.tab !== v; \}\)\)\{ EVH\.stackFront\(v\); return; \}/.test(html), 'OmniCom-Kachel holt hinteren Reiter nach vorn');
  assert(/ovStackIds\(view\)\.forEach\(function\(k\)\{ sa\.alphaView\[k\] = av; \}\)/.test(html) && /a\.type === "stackLook"/.test(html), 'Hintergrund-Deckkraft für den ganzen Stapel');
  assert(/active: function\(\)\{ return !de\.classList\.contains\("stack-back"\); \}/.test(html) && /de\.classList\.toggle\("stack-back", !!st && st\.tab !== view\)/.test(html), 'hintere Reiter schließen nicht nach Zeit');
  assert(/function stackX\(\)\{/.test(html) && /if \(de\.classList\.contains\("sat-stack"\)\) stackX\(\);/.test(html) && /H\.stackClose\(sx\.getAttribute\("data-stx"\)\)/.test(html) && /"Nur diese Ansicht schließen": "Close only this view"/.test(html), '✕ am Reiter, bleibt nach Neuzeichnen, DE/EN');
  assert(/stackFront\(w, b, \(\) => \{ stackBack\(old\); satZTouch\(w\); satActiveSet\(w\); \}\);/.test(main) && /if \(stackHidden\(id\)\)\{ w\.setOpacity\(0\); w\.setIgnoreMouseEvents\(true\); return; \}/.test(main), 'Reiterwechsel: hinten = Deckkraft 0 + durchklickbar, altes erst danach nach hinten');
  assert(/stackSync\(id\); \}, 300\);/.test(main) && /filter\(id => !stackHidden\(id\)\)\.map\(id => sats\[id\]\)/.test(main), 'hintere Reiter ziehen mit, zählen beim Einrasten nicht');
  assert(/stackDrop\(id, w\.getBounds\(\)\);/.test(main), 'Schließen nimmt aus dem Stapel');
  assert(/stackHover\(w, stackTarget\(w, c\)\);/.test(main) && /if \(t && old\)\{ stackJoin\(/.test(main), 'Ziehen: Ziel leuchtet, Loslassen = Reiter');
  assert(/function syncSats\(show, front\)\{\n  stackClean\(\);/.test(main), 'Stapel beim Start wiederherstellen (syncSats räumt auf)');
  assert(/o\.viewNames = VIEWS;/.test(main), 'Reiternamen an die Seite');
  assert(/stackTab: id =>/.test(pre) && /stackOut: \(id, x, y, drag\) =>/.test(pre), 'preload: stackTab + stackOut');
  // Seite
  assert(!/tabs\.firstChild/.test(html) && /var ttl = tabs\.querySelector\("\.sat-title"\);/.test(html), 'Titel landet im eigenen Reiter, nicht im ersten (live gefunden)');
  assert(/const ids = \(stackOf\(id\) \|\| \{ ids: \[id\] \}\)\.ids\.slice\(\);/.test(main) && /type: 'active', id, ids \}/.test(main), 'aktiv = ganzer Stapel (Nutzer 19.10.)');
  assert(/var acts = cmd\.ids \|\| \[cmd\.id\]; de\.classList\.toggle\("ov-active", view === "neocom" \|\| acts\.indexOf\(view\) >= 0\)/.test(html) && /acts\.map\(function\(a\)\{ return 'html\.ov-eve/.test(html), 'Seite + OmniCom: alle Reiter des Stapels aktiv');
  assert(/html\.sat-stack #ov-root \.ov-tab\{white-space:nowrap;cursor:grab;flex:0 1 auto;min-width:26px;overflow:hidden;display:inline-flex;align-items:center;gap:4px\}/.test(html) && !/html\.sat-stack #ov-root \.ov-tab\.sat-title\{flex:none/.test(html) && /tn\.className = "st-n"; tn\.textContent = \(s\.viewNames \|\| \{\}\)\[id\] \|\| id;/.test(html) && /tn\.className = "st-n"; tn\.textContent = d\.title \|\| view; ttl\.appendChild\(tn\);/.test(html), 'AP: aktiver und hinterer Reiter gleich gebaut (gleiche Breite, gleicher Abstand zur gelben Zahl, ✕ hält Platz frei)');
  assert(/tabs\.addEventListener\("pointermove", function\(ev\)\{\s*var d = stDown; if \(!d \|\| d\.out\) return;\s*if \(stOutside\(ev\)\)\{ stMark\(null\); if \(!H\.stackOutEnd\) return; d\.out = true; H\.stackOut\(d\.id, ev\.screenX, ev\.screenY, true\);/.test(html) && /if \(d\.out\)\{ H\.stackOutEnd\(d\.id\); return; \}/.test(html), 'AS: Reiter springt beim Ziehen aus der Leiste heraus (nicht erst beim Loslassen)');
  assert(/if \(drag\) satDrag\(sats\[id\], 'start'\);/.test(main) && /ipcMain\.on\('evecore:stackOutEnd', \(ev, id\) => \{ const w = sats\[String\(id\)\]; if \(w && selfDrags\.has\(w\)\) satDrag\(w, 'end'\); \}\);/.test(main) && /stackOutEnd: id => ipcRenderer\.send\('evecore:stackOutEnd', String\(id\)\)/.test(pre), 'AS: gelöstes Fenster folgt der Maus (satDrag), Loslassen = einrasten oder als Reiter ablegen');
  assert(/function stackTabs\(s\)\{/.test(html) && /de\.classList\.toggle\("sat-stack", !!st\)/.test(html), 'Seite zeichnet Reiter');
  assert(/H\.stackOut\(d\.id, ev\.screenX, ev\.screenY\)/.test(html) && /H\.stackTab\(d\.id\)/.test(html), 'Seite: Herausziehen + Klick');
  assert(/H\.popMenu\(\[\{ label: T\("Lösen"\) \}\]\)/.test(html) && /"Lösen": "Detach"/.test(html), 'Rechtsklick „Lösen“ (DE/EN)');
  assert(/cmd\.type === "stackHover"\) de\.classList\.toggle\("stack-drop"/.test(html) && /html\.stack-drop #ov-root \.ov-bar\{/.test(html), 'Ziel leuchtet auf');
  console.log('\nALL AK STAPEL TESTS PASSED');
}catch(e){ console.error(e); process.exit(1); }
