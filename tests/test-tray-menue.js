// Fehler 04.10.2026: Rechtsklick aufs Tray-Symbol › „Beenden“ tat nichts – updateTray setzte bei jedem pushSettings ein neues Menue,
// auch waehrend das alte offen war. Prueft aus der echten main.js: gleiches Menue wird nicht neu gesetzt, geaendertes schon.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  let sets = 0, quit = 0, last = null;
  const tray = { setContextMenu: m => { sets++; last = m; }, setToolTip: () => {} };
  const S = { hotkeys: {}, windows: {}, alwaysOnTop: false };
  const Menu = { buildFromTemplate: t => t };
  const noop = () => {};
  const e = new Function('tray', 'S', 'Menu', 'app', 'VIEWS', 'cycleCfg', 'toggleShow', 'launchEve', 'quitEve', 'HOTKEY_ACTIONS', 'shell', 'fs', 'backupDir', 'T',
    "let trayKey = '', quitting = false;\n" + pick('hk') + '\n' + pick('updateTray') + '\nreturn { updateTray };')(
    tray, S, Menu, { quit: () => quit++, getVersion: () => '4.0.67' }, { wallet: 'Wallet' }, () => ({ fwd: { label: 'Tab' } }), noop, noop, noop, {}, {}, {}, noop, s => s);   // T (4.0.73 Übersetzung) – hier Deutsch
  e.updateTray(); e.updateTray(); e.updateTray();
  assert(sets === 1, 'gleiches Menue wird nur einmal gesetzt (offenes Menue bleibt gueltig)');
  S.alwaysOnTop = true; e.updateTray();
  assert(sets === 2, 'geaendertes Häkchen setzt das Menue neu');
  S.windows.wallet = { open: true }; e.updateTray();
  assert(sets === 3, 'Aenderung im Overlay-Untermenue setzt das Menue neu');
  last.find(i => i.label === 'Beenden').click();
  assert(quit === 1, '„Beenden“ ruft app.quit');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
