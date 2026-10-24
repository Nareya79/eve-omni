// CC7 (01.10.2026): Browser mit Tabs (+, ✕, Links in neuem Tab, nach Neustart wieder offen) und wie ein Overlay
// (Deckkraft, Sperren, Durchklicken) – main.js mit nachgebautem Electron, Leiste browser.html im echten Browser
const fs = require('fs');
const { chromium } = require('playwright');
function assert(c, m){ if(!c) throw new Error('ASSERTION FAILED: ' + m); console.log('OK:', m); }
const main = fs.readFileSync('/home/claude/main.js', 'utf-8');
const i = main.indexOf('const BROWSER_BAR_H'), j = main.indexOf('// W12: Hauptfenster wie ein Overlay');
class WC { constructor(){ this.ev = {}; this.url = ''; this.title = ''; this.navigationHistory = { canGoBack: () => false, canGoForward: () => false }; this.session = { setPermissionRequestHandler(){} }; }
  on(e, f){ (this.ev[e] = this.ev[e] || []).push(f); } once(e, f){ this.on(e, f); } emit(e, ...a){ (this.ev[e] || []).forEach(f => f(...a)); }
  getURL(){ return this.url; } getTitle(){ return this.title; } isLoading(){ return false; }
  loadURL(u){ this.url = u; this.title = u.replace(/^https?:\/\//, ''); this.emit('did-navigate'); } setWindowOpenHandler(f){ this.woh = f; } close(){ this.closed = true; } send(){} }
class View { constructor(){ this.webContents = new WC(); } setBounds(b){ this.b = b; } }
class Win { constructor(o){ this.o = o; this.ev = {}; this.kids = []; this.sent = []; const me = this;
    this.contentView = { addChildView(v){ me.kids.push(v); }, removeChildView(v){ me.kids = me.kids.filter(x => x !== v); } };
    this.webContents = { send: (c, s) => me.sent.push(s), on(){}, isDestroyed: () => false }; }
  on(e, f){ (this.ev[e] = this.ev[e] || []).push(f); } once(e, f){ this.on(e, f); } emit(e){ (this.ev[e] || []).forEach(f => f()); }
  isDestroyed(){ return !!this.dead; } getContentSize(){ return [900, 700]; } loadFile(){} setMenu(){} show(){} focus(){} isVisible(){ return !this.dead; } isMinimized(){ return !!this.min; } minimize(){ this.min = true; } restore(){ this.min = false; } isMaximized(){ return false; } getBounds(){ return { x: 0, y: 0, width: 900, height: 700 }; }
  close(){ this.dead = true; this.emit('closed'); } setOpacity(a){ this.op = a; } setIgnoreMouseEvents(c){ this.ct = c; } setResizable(r){ this.rs = r; } }
const env = { S: { browser: { bookmarks: [{ name: 'DOTLAN', url: 'https://evemaps.dotlan.net/' }], tabs: ['https://a.example/', 'https://b.example/'], act: 1 }, windows: {}, alwaysOnTop: true }, saves: 0, menus: [] };
const merge = (a, b) => { const o = Object.assign({}, a); Object.keys(b).forEach(k => { o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; }); return o; };
const fn = new Function('S', 'saveSettings', 'send', 'screen', 'visibleOnScreen', 'BrowserWindow', 'WebContentsView', 'winIconPath', 'attachSnap', 'zSet', 'Menu', 'merge', 'pushSettings', 'applyWindowState', 'shell', 'path', '__dirname', 'env', 'satTop', 'uiLang', 'eoMenu', 'nativeTheme',
  "var extAct = '', extActSet = function(){}; " + main.slice(i, j) + '; env.api = { openBrowser, browserCmd, browserLook, tabs: () => btabs, act: () => bact, win: () => bwin, view: () => bview };');
fn(env.S, () => env.saves++, () => {}, { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) }, () => false, Win, View, () => '', () => {}, (w, t) => { if (w) w.top = t; },
  { buildFromTemplate: t => ({ popup(){ env.menus.push(t); } }) }, merge, () => {}, () => {}, { openExternal(){} }, require('path'), '/x', env, new Function('S', main.match(/function satTop\(id\)\{[^\n]*\}/)[0] + '; return satTop;')(env.S), () => 'de', (w, t) => env.menus.push(t), env.theme = {});   // MM3
const A = env.api;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try{
    // gemerkte Tabs kommen wieder, der zuletzt aktive ist sichtbar
    A.openBrowser(); let w = A.win();
    assert(A.tabs().length === 2 && A.act() === 1 && w.kids.length === 1 && w.kids[0] === A.tabs()[1] && A.view().b.y === 90, 'CC7: gemerkte Tabs wieder offen, nur der aktive sichtbar (unter der 90-px-Leiste)');
    // Link aus EVE Omni → neuer Tab statt die Seite zu ersetzen
    A.openBrowser('zkillboard.com');
    assert(A.tabs().length === 3 && A.act() === 2 && A.view().webContents.url === 'https://zkillboard.com' && A.tabs()[1].webContents.url === 'https://b.example/', 'CC7: Link von EVE Omni öffnet einen neuen Tab');
    // Link mit „neuem Fenster“ auf einer Seite → neuer Tab
    const r = A.tabs()[0].webContents.woh({ url: 'https://evewho.com/' });
    assert(r.action === 'deny' && A.tabs().length === 4 && A.act() === 3, 'CC7: Links in neuem Tab');
    assert(JSON.stringify(env.S.browser.tabs) === JSON.stringify(['https://a.example/', 'https://b.example/', 'https://zkillboard.com', 'https://evewho.com/']) && env.S.browser.act === 3, 'CC7: Tabs + aktiver Tab gemerkt');
    // wechseln, schließen, +, Zustand für die Leiste
    assert(env.theme.themeSource === 'dark', 'PR4: Seiten mit eigenem Dunkelmodus dunkel');
    A.browserCmd('min'); assert(w.min, 'PR4: Minimieren'); A.openBrowser(); assert(!w.min, 'PR4: OmniCom-Klick holt den minimierten Browser zurück');
    A.browserCmd('tab', '0'); assert(A.act() === 0 && w.kids.length === 1 && w.kids[0] === A.tabs()[0], 'CC7: Klick auf einen Tab wechselt');
    const t0 = A.tabs()[0]; A.browserCmd('closetab', '0');
    assert(A.tabs().length === 3 && t0.webContents.closed && A.act() === 0 && w.kids[0] === A.tabs()[0] && env.S.browser.tabs[0] === 'https://b.example/', 'CC7: ✕ schließt den Tab, der nächste wird aktiv');
    A.browserCmd('tab', '2'); A.browserCmd('closetab', '0'); assert(A.act() === 1 && A.tabs().length === 2, 'CC7: Tab links vom aktiven schließen – aktiver bleibt');
    A.browserCmd('newtab', ''); assert(A.tabs().length === 3 && A.view().webContents.url === 'https://evemaps.dotlan.net/', 'CC7: + öffnet einen neuen Tab (erstes Lesezeichen)');
    const st = w.sent[w.sent.length - 1];
    assert(st && st.tabs.length === 3 && st.act === 2 && st.tabs[2].t === 'evemaps.dotlan.net/', 'CC7: Leiste bekommt Tabs + aktiven Tab');
    // Strg+W in der Seite
    A.view().webContents.emit('before-input-event', { preventDefault(){} }, { type: 'keyDown', control: true, key: 'w' });
    assert(A.tabs().length === 2, 'CC7: Strg+W schließt den Tab');
    // wie ein Overlay
    env.S.windows.browser = { alpha: 0.6, ct: true, lock: true }; A.browserLook();
    assert(w.op === 0.6 && w.ct === true && w.rs === false && w.top === true, 'CC7: Deckkraft, Durchklicken, Sperren, Vordergrund');
    A.browserCmd('menu', ''); const m = env.menus[0];
    assert(m && m.some(x => /sperren/.test(x.label)) && m.some(x => x.label === 'Deckkraft' && x.submenu.length === 8) && m.some(x => /Durchklicken/.test(x.label)), 'CC7: ⚙-Menü wie bei den Overlays');
    m.find(x => /sperren/.test(x.label)).click(); assert(env.S.windows.browser.lock === false && w.rs === true, 'CC7: Sperren im Menü umschalten');
    // Fenster zu → Tabs bleiben gemerkt, beim nächsten Öffnen wieder da
    const keep = env.S.browser.tabs.slice(); w.close();
    assert(!A.win() && A.tabs().length === 0 && JSON.stringify(env.S.browser.tabs) === JSON.stringify(keep), 'CC7: Schließen behält die Tabs');
    A.openBrowser(); assert(A.tabs().length === keep.length && A.tabs().map(v => v.webContents.url).join() === keep.join(), 'CC7: nach Neustart dieselben Tabs');
    // Leiste im echten Browser
    const p = await b.newPage({ viewport: { width: 900, height: 90 } });
    await p.addInitScript(() => { window.browserHost = { cmds: [], cmd(t, a){ this.cmds.push([t, a]); }, onState(cb){ window.__cb = cb; } }; });
    await p.goto('file:///home/claude/browser.html');
    await p.evaluate(() => window.__cb({ url: 'https://zkillboard.com/', title: 'zKillboard', back: true, fwd: false, loading: false, bookmarks: [{ name: 'DOTLAN', url: 'https://evemaps.dotlan.net/' }],
      tabs: [{ t: 'DOTLAN EveMaps' }, { t: 'zKillboard – Killmails', l: false }, { t: 'EVE University Wiki', l: true }], act: 1 }));
    assert(await p.evaluate(() => document.querySelectorAll('.tab').length === 3 && document.querySelector('.tab.on .tt').textContent === 'zKillboard – Killmails'), 'CC7: Leiste zeigt die Tabs, aktiver hervorgehoben');
    await p.click('.tab:nth-child(1)'); await p.click('.tab:nth-child(3) .tx'); await p.click('#newtab'); await p.click('#ov'); await p.click('#min');
    assert(JSON.stringify(await p.evaluate(() => window.browserHost.cmds)) === JSON.stringify([['tab', 0], ['closetab', 2], ['newtab', ''], ['menu', undefined], ['min', undefined]]), 'CC7: Leiste schickt tab/closetab/newtab/menu');
    await p.screenshot({ path: '/tmp/cc7-bar.png' });
    console.log('ALL PASSED');
  }catch(e){ console.log(e.stack || e.message); await b.close(); process.exit(1); }
  await b.close(); process.exit(0);
})();
