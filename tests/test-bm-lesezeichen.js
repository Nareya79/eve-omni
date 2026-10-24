// BM (09.10.2026): Browser-Lesezeichen mit Ordnern, Verwalten (Ziehen, umbenennen, Adresse ändern, löschen) und Import aus Chrome/Edge
// main.js mit nachgebautem Electron (wie test-cc7-browser), Leiste/Verwaltung browser.html im echten Browser
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const i = main.indexOf('const BROWSER_BAR_H'), j = main.indexOf('// W12: Hauptfenster wie ein Overlay');
class WC { constructor(){ this.ev = {}; this.url = ''; this.title = ''; this.navigationHistory = { canGoBack: () => false, canGoForward: () => false }; this.session = { setPermissionRequestHandler(){} }; }
  on(e, f){ (this.ev[e] = this.ev[e] || []).push(f); } once(e, f){ this.on(e, f); } emit(e, ...a){ (this.ev[e] || []).forEach(f => f(...a)); }
  getURL(){ return this.url; } getTitle(){ return this.title; } isLoading(){ return false; } reload(){} getZoomFactor(){ return 1; } setZoomFactor(){}
  loadURL(u){ this.url = u; this.title = u.replace(/^https?:\/\//, ''); this.emit('did-navigate'); } setWindowOpenHandler(f){ this.woh = f; } close(){ this.closed = true; } send(c, s){ this.last = s; } }
class View { constructor(){ this.webContents = new WC(); } setBounds(b){ this.b = b; } }
class Win { constructor(o){ this.o = o; this.ev = {}; this.kids = []; const me = this;
    this.contentView = { addChildView(v){ me.kids.push(v); }, removeChildView(v){ me.kids = me.kids.filter(x => x !== v); } };
    this.webContents = { send: (c, s) => { me.st = s; }, on(){}, isDestroyed: () => false }; }
  on(e, f){ (this.ev[e] = this.ev[e] || []).push(f); } once(e, f){ this.on(e, f); } emit(e){ (this.ev[e] || []).forEach(f => f()); }
  isDestroyed(){ return !!this.dead; } getContentSize(){ return [900, 700]; } loadFile(){} setMenu(){} show(){} focus(){} isVisible(){ return true; } isMinimized(){ return false; } isMaximized(){ return false; } getBounds(){ return { x: 0, y: 0, width: 900, height: 700 }; }
  close(){ this.dead = true; this.emit('closed'); } setOpacity(){} setIgnoreMouseEvents(){} setResizable(){} }
const BM = () => [{ name: 'DOTLAN', url: 'https://evemaps.dotlan.net/' }, { name: 'EVE', kids: [{ name: 'zKill', url: 'https://zkillboard.com/' }, { name: 'Tools', kids: [{ name: 'Janice', url: 'https://janice.e-351.com/' }] }] }, { name: 'Wiki', url: 'https://wiki.eveuniversity.org/' }];
const env = { S: { browser: { bookmarks: BM(), tabs: ['https://a.example/'], act: 0 }, windows: {}, alwaysOnTop: true }, saves: 0, menus: [], dlg: [], dlgAnswer: 0 };
// Import-Quelle: nachgebauter Chrome-Ordner unter LOCALAPPDATA
const LA = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-')); process.env.LOCALAPPDATA = LA;
const cr = path.join(LA, 'Google', 'Chrome', 'User Data'); fs.mkdirSync(path.join(cr, 'Default'), { recursive: true }); fs.mkdirSync(path.join(cr, 'Profile 1'), { recursive: true });
fs.writeFileSync(path.join(cr, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Privat' }, 'Profile 1': { name: 'Arbeit' } } } }));
fs.writeFileSync(path.join(cr, 'Default', 'Bookmarks'), JSON.stringify({ roots: {
  bookmark_bar: { children: [{ type: 'url', name: 'Google', url: 'https://www.google.com/' }, { type: 'folder', name: 'EVE', children: [{ type: 'url', name: 'Dotlan', url: 'https://evemaps.dotlan.net/' }, { type: 'url', name: 'Kaputt', url: 'chrome://settings' }] }] },
  other: { children: [{ type: 'url', name: 'Reddit', url: 'https://www.reddit.com/r/Eve/' }] }, synced: { children: [] } } }));
fs.writeFileSync(path.join(cr, 'Profile 1', 'Bookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [] }, other: { children: [] } } }));   // leer → nicht angeboten
fs.writeFileSync(path.join(cr, 'Profile 1', 'AccountBookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', name: 'Konto', url: 'https://konto.example/' }] }, other: { children: [] }, synced: { children: [{ type: 'url', name: 'Handy', url: 'https://handy.example/' }] } } }));
const dialog = { showMessageBoxSync: (w, o) => { env.dlg.push(o); return env.dlgAnswer; }, showMessageBox: (w, o) => { env.dlg.push(o); return Promise.resolve({ response: 0 }); } };
const fn = new Function('S', 'saveSettings', 'send', 'screen', 'visibleOnScreen', 'BrowserWindow', 'WebContentsView', 'winIconPath', 'attachSnap', 'zSet', 'Menu', 'merge', 'pushSettings', 'applyWindowState', 'shell', 'path', '__dirname', 'env', 'satTop', 'uiLang', 'fs', 'dialog', 'eoMenu', 'eoAsk', 'nativeTheme',
  "var extAct = '', extActSet = function(){}; " + main.slice(i, j) + '; env.api = { openBrowser, browserCmd, bmAt, bmMove, bmSources, win: () => bwin, view: () => bview };');
fn(env.S, () => env.saves++, () => {}, { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) }, () => false, Win, View, () => '', () => {}, () => {},
  { buildFromTemplate: t => ({ popup(){ env.menus.push(t); } }) }, (a, b) => Object.assign({}, a, b), () => {}, () => {}, { openExternal(){} }, path, '/x', env, () => true, () => 'de', fs, dialog, (w, t) => env.menus.push(t), (w, o) => { env.dlg.push(o); return Promise.resolve({ response: env.dlgAnswer }); }, {});   // MM3: Menüs/Rückfragen im EVE-Omni-Stil
const A = env.api, B = () => env.S.browser.bookmarks, names = l => l.map(x => x.name).join();
const tick = () => new Promise(r => setTimeout(r, 0));
const lastMenu = () => env.menus[env.menus.length - 1], item = (m, re) => m.find(x => x.label && re.test(x.label));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    A.openBrowser(); const w = A.win(), V = () => A.view();
    // Baum: Pfade, Startseite, Stern findet auch Lesezeichen in Ordnern
    assert(A.bmAt('1/1/0').node.name === 'Janice' && A.bmAt('9') === null, 'Pfad "1/1/0" findet Lesezeichen im Unterordner');
    V().webContents.loadURL('https://janice.e-351.com/'); A.browserCmd('reload');
    assert(w.st.marked === true, 'Stern: Seite in einem Unterordner gilt als gemerkt');
    A.browserCmd('mark'); assert(A.bmAt('1/1').node.kids.length === 0 && w.st.marked === false, 'Stern entfernt das Lesezeichen aus dem Ordner');
    A.browserCmd('mark'); assert(B()[B().length - 1].url === 'https://janice.e-351.com/', 'Stern merkt neu in der Leiste (hinten)');
    // Verschieben: in Ordner, davor/danach, nicht in sich selbst
    assert(A.bmMove('3', '1/1', 'into') && A.bmAt('1/1/0').node.name.startsWith('janice'), 'Lesezeichen in Unterordner ziehen');
    assert(!A.bmMove('1', '1/1', 'into') && !A.bmMove('1', '1', 'into'), 'Ordner nicht in sich selbst oder seinen Unterordner');
    A.browserCmd('bmmove', JSON.stringify({ from: '2', to: '0', mode: 'before' }));
    assert(names(B()) === 'Wiki,DOTLAN,EVE', 'Ziehen vor ein anderes Lesezeichen (Leiste)');
    A.browserCmd('bmmove', JSON.stringify({ from: '0', to: '2/0', mode: 'after' }));
    assert(names(B()) === 'DOTLAN,EVE' && names(A.bmAt('1').node.kids) === 'zKill,Wiki,Tools', 'Ziehen hinter ein Lesezeichen im Ordner');
    A.browserCmd('bmmove', JSON.stringify({ from: '1/1', to: '', mode: 'into' }));
    assert(names(B()) === 'DOTLAN,EVE,Wiki', 'Ziehen auf freie Leiste = ans Ende');
    // Ordner-Menü: Lesezeichen, Unterordner, „Alle in Tabs“
    A.browserCmd('bmfolder', '1'); let m = lastMenu();
    assert(m[0].label === 'zKill' && m[1].label === 'Tools' && m[1].folder && m[1].submenu[0].label.startsWith('janice') && item(m, /Alle 2 in Tabs/), 'Klick auf Ordner: Menü mit Unterordnern und „Alle in Tabs öffnen“');
    assert(m[0].fav === 'https://www.google.com/s2/favicons?sz=32&domain=zkillboard.com' && !m[1].fav, 'ZZ2: Ordner-Menü – Lesezeichen mit Seitensymbol (nur Domain), Ordner ohne');
    m[0].click(); assert(V().webContents.url === 'https://zkillboard.com/', 'Lesezeichen im Ordner-Menü öffnet die Seite');
    // Neuer Ordner → Umbenennen über Pfad, Menü „Verschieben nach“
    A.browserCmd('bmnew', ''); assert(B()[3].name === 'Neuer Ordner' && w.st.edit === '3', 'Neuer Ordner: angelegt und gleich zum Umbenennen');
    A.browserCmd('reload'); assert(w.st.edit === '', 'Umbenennen-Aufforderung kommt nur einmal');
    A.browserCmd('rename', '3\nHandel'); assert(B()[3].name === 'Handel', 'Umbenennen über Pfad');
    A.browserCmd('bmmenu', '0'); m = lastMenu(); const to = item(m, /Verschieben nach/).submenu;
    assert(to.some(x => x.folder && /Handel/.test(x.label)) && to.some(x => x.folder && /EVE/.test(x.label)) && !to.some(x => /Leiste/.test(x.label)), 'Rechtsklick: „Verschieben nach“ listet Ordner (ohne Leiste, liegt schon dort)');
    to.find(x => /Handel/.test(x.label)).click(); assert(names(A.bmAt('2').node.kids) === 'DOTLAN', '„Verschieben nach“ legt es in den Ordner');
    // Bearbeiten in der Verwaltung: Name + Adresse, ungültige Adresse bleibt alt
    A.browserCmd('bmedit', JSON.stringify({ p: '2/0', name: 'Dotlan Maps', url: 'https://evemaps.dotlan.net/map' }));
    assert(A.bmAt('2/0').node.name === 'Dotlan Maps' && A.bmAt('2/0').node.url === 'https://evemaps.dotlan.net/map', 'Verwalten: Name und Adresse ändern');
    A.browserCmd('bmedit', JSON.stringify({ p: '2/0', name: '', url: 'javascript:alert(1)' })); assert(A.bmAt('2/0').node.url === 'https://evemaps.dotlan.net/map' && A.bmAt('2/0').node.name === 'Dotlan Maps', 'Leerer Name / keine http-Adresse ändert nichts');
    // Löschen: voller Ordner fragt, Abbrechen behält ihn
    env.dlgAnswer = 1; A.browserCmd('bmdel', '0'); await tick(); assert(B()[0].name === 'EVE' && /mit 2 Lesezeichen/.test(env.dlg.pop().message), 'Ordner mit Inhalt löschen fragt nach (Abbrechen behält ihn)');
    env.dlgAnswer = 0; A.browserCmd('bmdel', '0'); await tick(); assert(names(B()) === 'Wiki,Handel', 'Bestätigt: Ordner gelöscht');
    // Verwalten: Webseite verschwindet, Seite aufrufen beendet die Verwaltung
    A.browserCmd('manage', '1'); assert(w.st.manage === true && V().b.height === 0, 'Verwalten: Liste statt Webseite');
    A.browserCmd('bmopen', '0'); assert(w.st.manage === false && V().b.height === 610 && V().webContents.url === 'https://wiki.eveuniversity.org/', 'Lesezeichen in der Verwaltung öffnen: zurück zur Seite');
    // Import aus Chrome (zwei Profile, Namen aus Local State)
    const src = A.bmSources(); assert(src.length === 2 && src.map(x => x.label).sort().join() === 'Chrome – Arbeit (Konto),Chrome – Privat', 'Import: Profile mit Namen, Konto-Lesezeichen (AccountBookmarks), leere Datei nicht angeboten');
    A.browserCmd('import'); m = lastMenu(); item(m, /Privat/).click();
    const imp = B().find(x => x.name === 'Aus Chrome');
    assert(imp && names(imp.kids) === 'Google,EVE,Weitere Lesezeichen' && imp.kids[1].kids.length === 1 && imp.kids[2].kids[0].url === 'https://www.reddit.com/r/Eve/', 'Import: Leiste + Ordner + „Weitere Lesezeichen“, chrome://-Adressen weg');
    assert(/3 Lesezeichen importiert/.test(env.dlg.pop().message), 'Import meldet die Anzahl');
    env.dlgAnswer = 1; item(lastMenu(), /Arbeit \(Konto\)/).click(); await tick(); const acc = B().filter(x => x.name === 'Aus Chrome');
    assert(acc.length === 2 && acc[1].kids[0].url === 'https://konto.example/' && acc[1].kids[1].kids[0].url === 'https://handy.example/', 'Konto-Lesezeichen + Mobile importiert, „Zusätzlich“ = zweiter Ordner'); B().pop(); env.dlg.length = 0;
    env.dlgAnswer = 0; item(lastMenu(), /Privat/).click(); await tick(); assert(B().filter(x => x.name === 'Aus Chrome').length === 1, 'Nochmal importieren + „Ersetzen“: kein doppelter Ordner');
    env.dlgAnswer = 2; item(lastMenu(), /Privat/).click(); await tick(); assert(B().filter(x => x.name === 'Aus Chrome').length === 1, 'Abbrechen ändert nichts');
    // Leiste + Verwaltung im echten Browser
    const p = await b.newPage({ viewport: { width: 900, height: 500 } });
    await p.addInitScript(() => { window.browserHost = { cmds: [], cmd(t, a){ this.cmds.push([t, a]); }, onState(cb){ window.__cb = cb; } }; });
    await p.goto('file:///home/claude/browser.html');
    const st = Object.assign({}, w.st, { manage: false, edit: '' });
    await p.evaluate(s => window.__cb(s), st);
    assert(await p.evaluate(() => [...document.querySelectorAll('#bms .bm')].map(e => e.textContent).join('|')) === 'Wiki✕|Handel▾|Aus Chrome▾' && await p.evaluate(() => document.querySelectorAll('#bms .bm.fd svg.fdi').length === 2), 'Leiste: Lesezeichen und Ordner (Ordner-Symbol … ▾)');
    assert(await p.evaluate(() => { const i = document.querySelector('#bms .bm:not(.fd) img.fav'); return !!i && /s2\/favicons\?sz=32&domain=wiki\.eveuniversity\.org/.test(i.src) && !document.querySelector('#bms .bm.fd img.fav'); }), 'ZZ2: Leiste – Lesezeichen mit Seitensymbol, Ordner mit Ordner-Symbol');
    await p.click('#bms .bm:nth-child(2)'); await p.click('#bms .bm:nth-child(1)', { button: 'right' }); await p.click('#mgb');
    assert(JSON.stringify(await p.evaluate(() => window.browserHost.cmds)) === JSON.stringify([['bmfolder', '1'], ['bmmenu', '0'], ['manage', '1']]), 'Leiste: Ordner-Klick, Rechtsklick und 📑 schicken die Befehle');
    await p.evaluate(s => window.__cb(Object.assign({}, s, { manage: true })), st);
    assert(await p.evaluate(() => !document.getElementById('mg').hidden && document.querySelectorAll('#mgl .mr').length === 3), 'Verwalten: Liste mit 3 Einträgen (Ordner zu)');
    await p.click('#mgl .mr:nth-child(3) .tg');
    assert(await p.evaluate(() => document.querySelectorAll('#mgl .mr').length === 6), 'Ordner aufklappen zeigt den Inhalt');
    await p.fill('#mgq', 'reddit');
    assert(await p.evaluate(() => document.querySelectorAll('#mgl .mr').length === 1 && /Weitere Lesezeichen/.test(document.querySelector('#mgl .mr .ur').textContent)), 'Suche findet Lesezeichen in Unterordnern (mit Ordnerpfad)');
    await p.fill('#mgq', ''); await p.dblclick('#mgl .mr:nth-child(1) .nm'); await p.fill('#mgl input.n', 'EVE Uni'); await p.press('#mgl input.n', 'Enter');
    const cmds = await p.evaluate(() => window.browserHost.cmds); const ed = cmds[cmds.length - 1];
    assert(ed[0] === 'bmedit' && JSON.parse(ed[1]).name === 'EVE Uni' && JSON.parse(ed[1]).url === 'https://wiki.eveuniversity.org/', 'Doppelklick: Name ändern, Enter speichert');
    await p.evaluate(s => window.__cb(Object.assign({}, s, { manage: true, en: true })), st);
    assert(await p.evaluate(() => document.getElementById('mgt').textContent === 'Manage bookmarks' && document.getElementById('mgdone').textContent === 'Done'), 'Englisch: Verwaltung übersetzt');
    await p.screenshot({ path: '/tmp/bm-manage.png' });
    console.log('ALL TESTS PASSED');
  }catch(e){ console.log(e.stack || e.message); await b.close(); process.exit(1); }
  await b.close(); process.exit(0);
})();
