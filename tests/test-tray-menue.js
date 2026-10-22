// Fehler 04.10.2026: Rechtsklick aufs Tray-Symbol › „Beenden“ tat nichts – ein neues Menue, waehrend das alte offen war, verschluckte den Klick.
// AT (22.10.2026): das Menue ist jetzt das Menuefenster im Design (eoMenuAt) und wird erst beim Rechtsklick gebaut; Windows-Menue nur als Rueckfall
// (EVE vorne, Menuefenster nicht vorgebaut). Prueft aus der echten main.js.
const fs = require('fs');
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const pick = name => { const i = main.indexOf('function ' + name + '('); if (i < 0) throw new Error(name + ' fehlt'); let d = 0, j = main.indexOf('{', i);
  for (let k = j; k < main.length; k++){ if (main[k] === '{') d++; else if (main[k] === '}' && --d === 0) return main.slice(i, k + 1); } };
try{
  let sets = 0, quit = 0, rel = 0, pops = 0, menu = null, ready = true;
  const tray = { setContextMenu: () => sets++, setToolTip: () => {}, popUpContextMenu: m => { pops++; menu = m; } };
  const S = { hotkeys: {}, windows: {}, alwaysOnTop: false };
  const Menu = { buildFromTemplate: t => t };
  const noop = () => {};
  const e = new Function('tray', 'S', 'Menu', 'app', 'VIEWS', 'cycleCfg', 'toggleShow', 'launchEve', 'quitEve', 'HOTKEY_ACTIONS', 'shell', 'fs', 'backupDir', 'T', 'satPopReady', 'eoMenuAt',
    "let trayTpl = [], quitting = false, applyWindowState = () => {}, saveSettings = () => {}, pushSettings = () => {}, syncSats = () => {};\n" + pick('hk') + '\n' + pick('restartApp') + '\n' + pick('updateTray') + '\n' + pick('trayMenu') + '\nreturn { updateTray, trayMenu };')(
    tray, S, Menu, { quit: () => quit++, relaunch: () => rel++, getVersion: () => '5.1.0' }, { wallet: 'Wallet' }, () => ({ fwd: { label: 'Tab' } }), noop, noop, noop, {}, {}, {}, noop, s => s,
    () => ready, tpl => { menu = tpl; });
  e.updateTray(); e.updateTray(); S.alwaysOnTop = true; e.updateTray();
  assert(sets === 0, 'kein Windows-Kontextmenue gesetzt (sonst meldet Windows keinen Rechtsklick)');
  assert(/tray\.on\('right-click', trayMenu\)/.test(main), 'Rechtsklick aufs Symbol oeffnet trayMenu');
  e.trayMenu();
  assert(pops === 0 && Array.isArray(menu), 'Menuefenster im Design (eoMenuAt), kein Windows-Menue');
  menu.find(i => i.label === 'Beenden').click();
  assert(quit === 1, '„Beenden“ ruft app.quit');
  menu.find(i => i.label === 'EVE Omni neu starten').click();
  assert(rel === 1 && quit === 2, '„EVE Omni neu starten“ ruft app.relaunch + app.quit');
  menu.find(i => i.label === 'Overlays immer im Vordergrund').click();
  assert(S.alwaysOnTop === false, 'Haekchen bekommt beim Klick den neuen Zustand (an → aus)');
  menu.find(i => i.label === 'Overlays').submenu.find(i => i.label === 'Wallet').click();
  assert(S.windows.wallet && S.windows.wallet.open === true, 'Haekchen im Untermenue Overlays (aus → an)');
  ready = false; e.trayMenu();
  assert(pops === 1 && menu.find(i => i.label === 'Beenden'), 'Rueckfall: Windows-Menue, wenn das Menuefenster bei EVE vorne nicht geht');
  console.log('ALL TESTS PASSED');
}catch(err){ console.error(err.message); process.exit(1); }
