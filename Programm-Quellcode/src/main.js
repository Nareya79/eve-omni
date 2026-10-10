// EVE-Omni.exe (frueher EVECore.exe) - Programmhuelle um EVE-Omni.html (Electron).
// Das Programm steuert nur das eigene Fenster (Overlay, Transparenz, Durchklicken, Tastenkuerzel, Taskleistensymbol,
// Sicherungen, Einstellungs-Sync). Es liest nichts aus EVE aus und sendet nichts an EVE.
'use strict';
const { app, BrowserWindow, WebContentsView, session, desktopCapturer, ipcMain, globalShortcut, Tray, Menu, nativeImage, shell, dialog, screen, Notification, clipboard } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const { execFile, execFileSync } = require('child_process');
const sync = require('./sync');
const evesave = require('./evesave');   // EVE-Client-Einstellungen sichern/Profile (04.10.2026)
const umzug = require('./umzug');

const APP_ID = 'de.eveomni.app', OLD_APP_ID = 'de.evecore.app';   // BB0
const SSO_REDIRECTS = ['https://claude.ai/artifact/SCXYB3dGYrVf9XaTZcQW7U', 'https://omni.nareya79.com/callback.html'];   // V2: eigene App (alt) + gemeinsame App
const isSsoReturn = u => typeof u === 'string' && SSO_REDIRECTS.some(p => u.indexOf(p) === 0);
const IS_WIN = process.platform === 'win32';
const TEST = process.env.EVECORE_TEST === '1';

let oldRunning = false;
if (process.env.EVECORE_USERDATA) app.setPath('userData', process.env.EVECORE_USERDATA);
else {
  // BB0: Daten liegen jetzt in %APPDATA%\EVE Omni – beim ersten Start einmal aus %APPDATA%\EVECore kopieren (localStorage, Browser-Anmeldungen, Einstellungen)
  const ud = path.join(app.getPath('appData'), 'EVE Omni'), old = path.join(app.getPath('appData'), 'EVECore');
  // laeuft das alte EVECore noch, waeren seine Dateien halb geschrieben -> erst nach dem Beenden umziehen (Hinweis beim Start)
  if (IS_WIN && !TEST && fs.existsSync(old) && !fs.existsSync(path.join(ud, umzug.MARK))) try{ oldRunning = /evecore\.exe/i.test(execFileSync('tasklist', ['/FI', 'IMAGENAME eq EVECore.exe', '/NH'], { encoding: 'utf8', windowsHide: true })); }catch(e){}
  if (!oldRunning) try{ umzug.moveOnce(old, ud); }catch(e){}
  // beim Hinweis "EVECore laeuft noch" den neuen Ordner nicht anlegen (sonst leer und der Umzug klemmt)
  app.setPath('userData', oldRunning ? path.join(app.getPath('temp'), 'EVE Omni Hinweis') : ud);
}
app.setAppUserModelId(APP_ID);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/* ---------------- Einstellungen ---------------- */
const DEFAULTS = {
  mode: 'full',               // W12: nur noch 'full' (Kompaktansicht gibt es nicht mehr, alte Einstellung wird beim Laden umgestellt)
  alwaysOnTop: true,          // Overlays immer im Vordergrund
  alwaysOnTopFull: false,     // Hauptfenster auch
  transparent: false,
  opacity: 1,
  opacityFull: 1,             // Fenster-Deckkraft des Hauptfensters
  clickThrough: false,
  snap: true,                 // Overlay-Fenster rasten aneinander und am Bildschirmrand ein
  snapGap: 1,                 // H4: Abstand zum Bildschirmrand in Pixeln (0–50)
  snapEdge: 'screen',         // 'screen' = echter Bildschirmrand (EVE Vollbild-Fenster), 'work' = ueber der Taskleiste
  snapMatch: true,            // D1: seitlich angedockt = Hoehe des Nachbarn, oben/unten angedockt = Breite
  hotkeys: { clickThrough: 'CommandOrControl+Shift+E', toggleShow: 'CommandOrControl+Shift+O', localPaste: 'CommandOrControl+Shift+L', musicToggle: '', musicNext: '', musicPrev: '' },
  autostart: false,
  eveAutoShow: true,
  startMain: true,            // BB26: Hauptfenster beim Start zeigen (aus = nur Overlays + Symbol unten rechts)
  eveAutoHide: false,
  closeToTray: true,
  taskbar: true,              // T21: EVECore-Symbol auch in der Taskleiste (Verstecken = minimieren)
  htmlPath: '',
  backup: { on: true, logins: false, dir: '', last: 0, lastFile: '' },
  bounds: { full: null, compact: null },
  windows: {},                 // Einzelfenster: { trades: { open, bounds }, ... }
  maximized: false,
  minimized: false,           // H7: beim Beenden in der Taskleiste -> so wieder starten
  shortcutDone: false,
  musicDir: '',                // Jukebox: alter Einzel-Ordner (wird in musicDirs uebernommen)
  musicDirs: [],               // T24: Jukebox – alle freigegebenen Musikordner
  localWatch: true,            // Zwischenablage beobachten: kopierte Local-Liste oeffnet das Local-Fenster
  overlayOnlyEve: true,        // Overlays nur ueber EVE: ist ein anderes Programm vorne, liegen sie dahinter
  // EVE-Clients mit einer Taste durchschalten (wie EVE-X-Preview). vk = Windows-Tastencode, mods: 1 Strg, 2 Umschalt, 4 Alt
  cycle: { on: false, fwd: { vk: 9, mods: 0, label: 'Tab' }, back: { vk: 9, mods: 2, label: 'Umschalt+Tab' }, skipLogin: true, order: [] },
  // E1: eigenes Browser-Fenster
  // Client-Vorschau: float = Stufe 3 (schwebende Fenster je Client), fps/width auch fuer die Kacheln in den Einstellungen, pos je Charaktername
  deck: { on: false, port: 51780, key: '' },   // SD: Stream-Tasten (lokaler Anschluss)
  preview: { float: false, fps: 10, width: 280, fit: 'crop', border: '#e0b84a', pos: {}, engine: 'dwm' },   // I4: engine dwm = Windows-Spiegelbild, video = alte Version   // H5: fit crop = 16:9 aus der Mitte, full = ganzes Bild
  browser: { bookmarks: [{ name: 'DOTLAN', url: 'https://evemaps.dotlan.net/' }, { name: 'zKillboard', url: 'https://zkillboard.com/' }, { name: 'EVE-Wiki', url: 'https://wiki.eveuniversity.org/' }], last: '', bounds: null }
};
let S = null, wasCompact = false;
function settingsFile(){ return path.join(app.getPath('userData'), 'einstellungen.json'); }
function merge(a, b){
  const out = Array.isArray(a) ? a.slice() : Object.assign({}, a);
  Object.keys(b || {}).forEach(k => {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) out[k] = merge(a[k], b[k]);
    else out[k] = b[k];
  });
  return out;
}
function loadSettings(){
  let saved = {};
  try{ saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); }catch(e){}
  S = merge(DEFAULTS, saved);
  // W12: Kompaktansicht entfaellt. Wer sie benutzt hat, bekommt ihre Reiter einmal als Einzelfenster (macht die Seite, wasCompact).
  // windows.main galt bisher nur fuer die Kompaktansicht (Sperren/Durchklicken) – nicht aufs grosse Fenster uebertragen.
  if (!S.w12){ S.w12 = true; wasCompact = S.mode === 'compact'; delete S.windows.main; }
  S.mode = 'full';
  delete S.hotkeys.toggleMode; delete S.hotkeys.nextView;
}
let saveTimer = null;
function saveSettings(now){
  clearTimeout(saveTimer);
  const doSave = () => { try{ fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(S, null, 2)); }catch(e){} };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 400);
}

/* ---------------- Pfade ---------------- */
function bundledHtml(){ return path.join(__dirname, 'evecore', 'EVE-Omni.html'); }
function besideExeHtml(){ return path.join(path.dirname(app.getPath('exe')), 'EVE-Omni.html'); }
// V1: Demo-Modus – Start mit --demo oder Hauptfenster läuft gerade mit ?demo=1 → Einzelfenster bekommen demo=1 mit
const DEMO_ARG = process.argv.includes('--demo');
function demoOn(){ try{ return DEMO_ARG || (!!win && !win.isDestroyed() && /[?&]demo=1(&|$)/.test(win.webContents.getURL())); }catch(e){ return DEMO_ARG; } }
function satQuery(id){ return demoOn() ? { fenster: id, demo: '1' } : { fenster: id }; }
function effectiveHtml(){
  if (S.htmlPath && fs.existsSync(S.htmlPath)) return S.htmlPath;
  if (!TEST && fs.existsSync(besideExeHtml())) return besideExeHtml();
  return bundledHtml();
}
function backupDir(){ return S.backup.dir || path.join(app.getPath('documents'), 'EVE-Omni-Sicherungen'); }
function iconPath(){ return path.join(__dirname, 'icon.png'); }
// BB12: Windows nimmt aus der .ico (16–256) die Groesse passend zur Skalierung – scharf im Infobereich und an Fenstern
function winIconPath(){ return process.platform === 'win32' ? path.join(__dirname, 'icon.ico') : iconPath(); }

/* ---------------- Fenster ---------------- */
let win = null, tray = null, quitting = false, eveRunning = false;
// T21: mit Taskleisten-Symbol wird das Hauptfenster nicht versteckt, sondern minimiert; ein Klick darauf holt die grosse Ansicht
let trayMin = false;
function hideMain(){
  if (!win) return;
  if (!S.taskbar){ win.hide(); return; }
  trayMin = true; win.setSkipTaskbar(false);
  if (!win.isVisible()) win.showInactive();
  win.minimize();
}
function mainHidden(){ return !win || !win.isVisible() || win.isMinimized(); }
const MIN = [760, 480];
function defaultBounds(){
  const wa = screen.getPrimaryDisplay().workArea;
  const w = Math.min(1500, wa.width - 60), h = Math.min(980, wa.height - 60);
  return { width: w, height: h, x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + Math.round((wa.height - h) / 2) };
}
function visibleOnScreen(b){
  if (!b || !(b.width > 50) || !(b.height > 50)) return false;
  return screen.getAllDisplays().some(d => {
    const a = d.workArea;
    const ix = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const iy = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return ix > 80 && iy > 40;
  });
}
function boundsFor(){
  const b = S.bounds.full;
  return visibleOnScreen(b) ? b : defaultBounds();
}
function send(cmd){ if (win && !win.isDestroyed()) win.webContents.send('evecore:cmd', cmd); }
function publicSettings(){
  const o = JSON.parse(JSON.stringify(S));
  o.htmlPathEffective = effectiveHtml();
  o.backup.dirEffective = backupDir();
  o.hotkeyStatus = hotkeyStatus;
  o.eveRunning = eveRunning;
  o.platform = process.platform;
  o.fgHelper = fg.status;
  o.eveClients = fg.clients.map(c => ({ hwnd: c.hwnd, name: c.name, title: c.title }));
  o.cycleStatus = fg.cycle;
  o.wasCompact = wasCompact;
  o.deck = deckCfg(); o.deckClients = deckClients.length; o.deckErr = S.deckErr || ''; o.deckRun = !!deckSrv;   // SD
  return o;
}
function pushSettings(){
  const ps = publicSettings();
  send({ type: 'settings', settings: ps });
  Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()) w.webContents.send('evecore:cmd', { type: 'settings', settings: ps }); });
  updateTray();
}

/* ---------------- Einrasten (magnetisch wie in EVE) ----------------
   Beim Verschieben (Windows: will-move waehrend des Ziehens) und beim Groesse-Aendern werden Kanten, die naeher als
   SNAP Pixel an einer Kante eines anderen Overlay-Fensters oder am Bildschirmrand liegen, bündig angelegt. */
const SNAP = 14;       // so nah muss eine Kante kommen, damit das Fenster einrastet
const BREAK = 45;     // so weit muss man weiterziehen, damit es sich wieder loesst (wie in EVE)
function overlayWindowsExcept(w){
  const list = Object.keys(sats).map(id => sats[id]).filter(o => o && !o.isDestroyed() && o.isVisible());
  if (win && !win.isDestroyed() && win.isVisible() && !win.isMaximized() && !win.isMinimized()) list.push(win);   // W12: Hauptfenster rastet mit ein
  if (bwin && !bwin.isDestroyed() && bwin.isVisible()) list.push(bwin);
  Object.keys(pvWins).forEach(h => { const o = pvWins[h]; if (o && !o.isDestroyed() && o.isVisible()) list.push(o); });
  return list.filter(o => o !== w);
}
function snapPick(cur, cands, radius){
  let best = null, bd = (radius || SNAP) + 1;
  cands.forEach(c => { const d = Math.abs(c - cur); if (d < bd){ bd = d; best = c; } });
  return best;
}
// Moegliche Einrast-Positionen (links/rechts daneben, darueber/darunter, Kanten buendig, Bildschirmrand)
function snapCands(w, nb, margin){
  const x = nb.x, y = nb.y, W = nb.width, H = nb.height;
  const wa = snapArea(nb);
  const cx = [wa.x, wa.x + wa.width - W], cy = [wa.y, wa.y + wa.height - H];
  overlayWindowsExcept(w).forEach(o => {
    const t = o.getBounds();
    const vOverlap = y < t.y + t.height + margin && y + H > t.y - margin;
    const hOverlap = x < t.x + t.width + margin && x + W > t.x - margin;
    if (vOverlap){ cx.push(t.x + t.width, t.x - W); }
    if (hOverlap){ cy.push(t.y + t.height, t.y - H); }
    if (vOverlap || hOverlap){ cx.push(t.x, t.x + t.width - W); cy.push(t.y, t.y + t.height - H); }
  });
  return { cx, cy };
}
// ohne Gedaechtnis (nach dem Loslassen, Tests)
function snapBounds(w, nb){
  if (S.snap === false) return null;
  const c = snapCands(w, nb, SNAP);
  const sx = snapPick(nb.x, c.cx), sy = snapPick(nb.y, c.cy);
  if (sx === null && sy === null) return null;
  const out = clampToWork({ x: sx === null ? nb.x : sx, y: sy === null ? nb.y : sy, width: nb.width, height: nb.height }, nb);
  return (out.x === nb.x && out.y === nb.y) ? null : out;
}
// Waehrend des Ziehens mit Gedaechtnis: eingerastete Kante haelt, bis man mehr als BREAK Pixel weiterzieht.
// Entlang der Kante gleiten geht dabei weiter (die andere Richtung bleibt frei).
const snapHold = new Map();
function snapDrag(w, nb){
  if (S.snap === false) return null;
  let st = snapHold.get(w);
  if (!st || Date.now() - st.t > 600) st = { x: null, y: null };
  st.t = Date.now();
  const snapIn = snapCands(w, nb, SNAP), keep = snapCands(w, nb, BREAK);
  function axis(cur, hold, inList, keepList){
    if (hold !== null && keepList.indexOf(hold) >= 0 && Math.abs(cur - hold) <= BREAK) return hold;
    return snapPick(cur, inList);
  }
  st.x = axis(nb.x, st.x, snapIn.cx, keep.cx);
  st.y = axis(nb.y, st.y, snapIn.cy, keep.cy);
  snapHold.set(w, st);
  const out = { x: st.x === null ? nb.x : st.x, y: st.y === null ? nb.y : st.y, width: nb.width, height: nb.height };
  return (out.x === nb.x && out.y === nb.y) ? null : out;
}
function snapEnd(w){ snapHold.delete(w); }
// Groesse aendern (rechte/untere Kante) ebenfalls einrasten
function snapSize(w, b){
  if (S.snap === false) return b;
  const wa = snapArea(b);
  const rx = [wa.x + wa.width], by = [wa.y + wa.height];
  overlayWindowsExcept(w).forEach(o => { const t = o.getBounds(); rx.push(t.x, t.x + t.width); by.push(t.y, t.y + t.height); });
  const r = snapPick(b.x + b.width, rx), btm = snapPick(b.y + b.height, by);
  const out = { x: b.x, y: b.y, width: r === null ? b.width : r - b.x, height: btm === null ? b.height : btm - b.y };
  // beim Groesser-Ziehen nicht unter die Taskleiste / aus dem Bildschirm
  if (out.y + out.height > wa.y + wa.height) out.height = Math.max(60, wa.y + wa.height - out.y);
  if (out.x + out.width > wa.x + wa.width) out.width = Math.max(36, wa.x + wa.width - out.x);
  return out;
}
// D1: Nach dem Loslassen: liegt das Fenster darueber/darunter buendig an einem anderen, uebernimmt es dessen Breite (und linke Kante).
// LL4 (10.10.2026): links/rechts daneben wird die Hoehe NICHT mehr uebernommen (Nutzer: Fenster sprang auf die Hoehe des Nachbarn).
function snapMatchBounds(w, b){
  if (S.snap === false || S.snapMatch === false) return null;
  for (const o of overlayWindowsExcept(w)){
    const t = o.getBounds();
    const side = (b.x === t.x + t.width || b.x + b.width === t.x) && b.y < t.y + t.height && b.y + b.height > t.y;
    const stack = (b.y === t.y + t.height || b.y + b.height === t.y) && b.x < t.x + t.width && b.x + b.width > t.x;
    if (!side && stack && (b.x !== t.x || b.width !== t.width)) return { x: t.x, y: b.y, width: t.width, height: b.height };
  }
  return null;
}
function snapMatch(w){
  if (!w || w.isDestroyed() || selfDrags.has(w) || pvHwndOf(w.webContents)) return;   // Vorschau-Fenster behalten ihre Groesse
  const nb = snapMatchBounds(w, w.getBounds());
  if (nb) w.setBounds(nb);
}
// Ein Zieh-Vorgang: Die gewuenschte Position kommt aus dem Mauszeiger (Abstand zum Fenster beim Anfassen),
// NICHT aus der von Windows vorgeschlagenen Position. Sonst "klebt" ein eingerastetes Fenster fest, weil Windows
// nach jedem Einrasten vom eingerasteten Platz aus weiterrechnet.
const drags = new Map();
function dragStep(w, nb, cursor){
  let d = drags.get(w);
  const now = Date.now();
  if (!d || now - d.t > 3000){
    const b = w.getBounds();
    d = { ox: cursor.x - b.x, oy: cursor.y - b.y };
    snapEnd(w);
  }
  d.t = now;
  drags.set(w, d);
  // Groesse immer vom Fenster selbst nehmen: Windows meldet beim Ziehen teils das Fenster samt unsichtbarem Rand,
  // dann lag die untere Kante nach dem Einrasten unter dem Bildschirmrand (1.3.4).
  const cur = w.getBounds();
  if (!d.w){ d.w = cur.width; d.h = cur.height; }
  const free = { x: Math.round(cursor.x - d.ox), y: Math.round(cursor.y - d.oy), width: d.w, height: d.h };
  // Sicherheitsnetz: passt die Mausposition gar nicht zum Vorschlag (z. B. Bildschirm-Skalierung), dem Vorschlag folgen
  if (Math.abs(free.x - nb.x) > 250 || Math.abs(free.y - nb.y) > 250){ free.x = nb.x; free.y = nb.y; }
  const sn = snapDrag(w, free);
  return sn ? clampToWork(sn, free) : free;
}
// Bildschirmkante zum Einrasten: ganzer Bildschirm (EVE im randlosen Vollbild-Fenster ueberdeckt die Taskleiste)
// oder nur der Arbeitsbereich ohne Taskleiste (Einstellung snapEdge)
function snapArea(b){
  const d = screen.getDisplayMatching(b), a = S.snapEdge === 'work' ? d.workArea : d.bounds;
  const g = Math.max(0, Math.min(50, Math.round(Number(S.snapGap)) || 0));   // H4: Abstand zum Rand
  return { x: a.x + g, y: a.y + g, width: a.width - 2 * g, height: a.height - 2 * g };
}
// Eingerastete Position nie ueber den Arbeitsbereich (ohne Taskleiste) hinaus schieben
function clampToWork(b, ref){
  const wa = snapArea(ref || b);
  const out = Object.assign({}, b);
  if (out.y + out.height > wa.y + wa.height && (ref ? ref.y + ref.height >= wa.y + wa.height - BREAK : true)) out.y = Math.max(wa.y, wa.y + wa.height - out.height);
  if (out.x + out.width > wa.x + wa.width && (ref ? ref.x + ref.width >= wa.x + wa.width - BREAK : true)) out.x = Math.max(wa.x, wa.x + wa.width - out.width);
  if (out.y < wa.y && (ref ? ref.y <= wa.y + BREAK : true)) out.y = wa.y;
  if (out.x < wa.x && (ref ? ref.x <= wa.x + BREAK : true)) out.x = wa.x;
  return out;
}
function dragEnd(w){ drags.delete(w); snapEnd(w); }
// H8: Position gesperrt: Hauptfenster = windows.main (Schloss in der Titelleiste), Einzelfenster = windows.<Ansicht>
function winLocked(w){
  if (pvHwndOf(w.webContents)) return !!(S.preview && S.preview.lock);
  const id = w === win ? 'main' : w === bwin ? 'browser' : satIdOf(w.webContents);   // CC7
  return !!(id && S.windows[id] && S.windows[id].lock);
}
function attachSnap(w){
  let dragged = false;
  w.on('will-move', (ev, nb) => {
    if (w.isMaximized()) return;
    if (winLocked(w)){ ev.preventDefault(); return; }
    if (S.snap === false) return;
    dragged = true;
    const s = dragStep(w, nb, screen.getCursorScreenPoint());
    if (s.x !== nb.x || s.y !== nb.y){ ev.preventDefault(); w.setBounds(s); }
  });
  // T6: gesperrt = auch Groesse fest (Rand/Ecke ziehen)
  w.on('will-resize', ev => { if (winLocked(w)) ev.preventDefault(); });
  // Ende des Ziehens (Windows/macOS). Ohne will-move (Linux) wird erst nach dem Loslassen angelegt.
  w.on('moved', () => {
    dragEnd(w);
    if (w.isMaximized()){ dragged = false; return; }
    if (dragged){ dragged = false; snapMatch(w); return; }
    const s = snapBounds(w, w.getBounds());
    if (s) w.setBounds(s);
    snapMatch(w);
  });
  w.on('closed', () => { drags.delete(w); snapHold.delete(w); });
}
if (TEST) global.__evecoreTest = {
  snapBounds: (id, nb) => snapBounds(id === 'main' ? win : sats[id], nb),
  satDrag: (id, phase) => satDrag(sats[id], phase),
  selfDragging: id => selfDrags.has(sats[id]),
  snapDrag: (id, nb) => snapDrag(id === 'main' ? win : sats[id], nb),
  snapEnd: id => snapEnd(id === 'main' ? win : sats[id]),
  dragStep: (id, nb, cursor) => dragStep(id === 'main' ? win : sats[id], nb, cursor),
  dragEnd: id => dragEnd(id === 'main' ? win : sats[id]),
  clampToWork: (b, ref) => clampToWork(b, ref),
  snapArea: b => snapArea(b),
  snapSize: (id, b) => snapSize(id === 'main' ? win : sats[id], b),
  snapMatchBounds: (id, b) => snapMatchBounds(id === 'main' ? win : sats[id], b),
  hotkey: id => HOTKEY_ACTIONS[id](),
  looksLikeLocal: t => looksLikeLocal(t),
  looksLikeDscan: t => looksLikeDscan(t),
  clipSent: () => clipSent,
  fgEvent: (h, n) => fgEvent(h, n),
  fgLine: l => fgLine(l),
  activateClient: h => activateClient(h),
  handleClip: f => handleClip(f),
  kfOn: () => kf.on,
  satMini: id => satMiniToggle(id),
  zState: () => { const o = {}; Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()) o[id] = { top: w.isAlwaysOnTop(), below: !!w.__below }; }); o.main = { top: win.isAlwaysOnTop(), below: !!win.__below }; return o; },
  setMusicDir: d => { S.musicDir = ''; S.musicDirs = [d]; },
  helperSent: () => fg.sent.slice(),
  helperScript: () => helperScript(),
  cycleCfg: () => cycleCfg(),
  browserUrl: s => browserUrl(s),
  openBrowser: u => openBrowser(u),
  browserCmd: (t, a) => browserCmd(t, a),
  setClients: list => { fg.clients = list; pvSync(); },
  setFg: (h, n) => { fg.hwnd = h; fg.name = n; pvSync(); },
  pvState: () => Object.keys(pvWins).map(h => ({ hwnd: h, bounds: pvWins[h].getBounds(), top: pvWins[h].isAlwaysOnTop(), focusable: pvWins[h].isFocusable(), resizable: pvWins[h].isResizable() })),
  pvResize: (h, W) => { const w = pvWins[h], b = w.getBounds(); w.setBounds({ x: b.x, y: b.y, width: W, height: Math.round(W * 9 / 16) }); },
  pvAspect: (h, r) => pvAspect(pvWins[h], r),
  pvBig: h => pvToggleBig(pvWins[h]),
  winCmd: c => { if (['minimize', 'restore', 'maximize', 'unmaximize'].indexOf(c) >= 0) win[c](); },
  pvCfg: () => pvCfg(),
  pvDefaultPos: (i, W, H) => pvDefaultPos(i, W, H),
  capRequest: (pid, h) => capRequest(pid, h),
  capQueue: pid => (capPick.get(pid) || []).slice(),
  browserInfo: () => bwin && !bwin.isDestroyed() ? Object.assign(browserState(), { top: bwin.isAlwaysOnTop(), bounds: bwin.getBounds(), view: bview.getBounds() }) : null
};

/* ---------------- Einzelfenster (eine Ansicht je Fenster, frei platzierbar) ---------------- */
const VIEWS = { trades: 'Trades', route: 'Navigation', skills: 'Skills', wallet: 'Wallet', scanner: 'Scanner-Plan', handel: 'Handel', track: 'Watchlist',
                local: 'Local', chars: 'Charaktere', pi: 'Planeten', musik: 'Jukebox', neocom: 'Neocom', karte: 'Karte', alarm: 'Alert', gangreport: 'Gang-Report', radar: 'Radar', appraisal: 'Wertschätzer', courier: 'Kurier', mining: 'Mining', dscan: 'D-Scan', piplan: 'PI-Planer', wurmloch: 'Wurmlöcher', assets: 'Assets', industrie: 'Industrie', notiz: 'Notizen', leistung: 'Leistung', uhr: 'Uhr & Timer' };
/* 4.0.73: Englisch auch außerhalb der Seite – Tray, Rechtsklick-Menüs, Dialoge, Vorschau-Beschriftung.
   Sprache meldet die Seite (setSettings lang); bis dahin bzw. bei Neuinstallation die Windows-Sprache. */
const MAIN_EN = {
  'Position und Größe sperren': 'Lock position and size', 'Deckkraft': 'Opacity', 'Durchklicken (nur Browser)': 'Click-through (browser only)',
  'Ausschalten: Einstellungen › Programm › Durchklicken': 'Turn off: Settings › App › Click-through', 'Immer im Vordergrund': 'Always on top',
  'Startseite': 'Home page', 'Aktuelle Seite als Startseite': 'Current page as home page', 'Startseite öffnen': 'Open home page',
  'Zurücksetzen (erstes Lesezeichen)': 'Reset (first bookmark)', 'Neuer Tab öffnet': 'New tab opens', 'Leere Seite': 'Blank page',
  'Zuletzt besuchte Seite': 'Last visited page', 'Zoom': 'Zoom', 'Suchmaschine (Adressleiste)': 'Search engine (address bar)',
  'Als Startseite': 'As home page', 'In neuem Tab öffnen': 'Open in new tab', '◀ Nach links': '◀ Move left', 'Nach rechts ▶': 'Move right ▶',
  'Umbenennen: Doppelklick auf das Lesezeichen': 'Rename: double-click the bookmark', 'Löschen': 'Delete',
  'Alle beenden': 'Quit all', 'Abbrechen': 'Cancel', 'Wirklich den EVE-Client beenden?': 'Really quit the EVE client?',
  'Erst normal schließen – was nach 5 Sekunden noch läuft, wird hart beendet. Der Launcher bleibt offen.': 'Closes normally first – whatever still runs after 5 seconds is killed. The launcher stays open.',
  'Es läuft kein EVE-Client.': 'No EVE client is running.', 'Charakterauswahl': 'Character selection', 'Nicht eingeloggt': 'Not logged in',
  'EVE Omni anzeigen / ausblenden': 'Show / hide EVE Omni', 'EVE starten (Launcher)': 'Start EVE (launcher)', 'Alle EVE-Clients beenden …': 'Quit all EVE clients …',
  'Hauptfenster immer im Vordergrund': 'Main window always on top', 'Overlays immer im Vordergrund': 'Overlays always on top', 'Durchklicken': 'Click-through',
  'Transparenter Hintergrund': 'Transparent background', 'Einrasten': 'Snap windows', 'Overlays': 'Overlays', 'Browser-Fenster': 'Browser window', 'Fensterposition zurücksetzen': 'Reset window position',
  'Einstellungen …': 'Settings …', 'Neocom-Einstellungen …': 'Neocom settings …', 'Alle Einstellungen …': 'All settings …', 'Sicherungsordner öffnen': 'Open backup folder',
  'Beenden': 'Quit', 'Schließen': 'Close', 'Hintergrund': 'Background', 'Durchsichtigkeit': 'Transparency',
  'nie (immer offen)': 'never (always open)', '10 s nach der Maus': '10 s after the mouse', '30 s nach der Maus': '30 s after the mouse',
  '1 Min nach der Maus': '1 min after the mouse', '2 Min nach der Maus': '2 min after the mouse', '5 Min nach der Maus': '5 min after the mouse',
  'Musikordner hinzufügen': 'Add music folder', 'Ordner für Sicherungen': 'Folder for backups', 'EVE-Omni.html wählen': 'Choose EVE-Omni.html',
  'EVE läuft noch – erst alle EVE-Clients schließen.': 'EVE is still running – close all EVE clients first.', 'EVECore läuft noch.': 'EVECore is still running.',
  'EVECore heißt jetzt EVE Omni und übernimmt beim ersten Start alle Daten. Bitte EVECore zuerst beenden (Symbol unten rechts › Beenden) und EVE Omni dann neu starten.': 'EVECore is now called EVE Omni and takes over all data on the first start. Please quit EVECore first (icon bottom right › Quit) and then restart EVE Omni.',
  // Overlay-Namen (Tray › Overlays)
  'Navigation': 'Navigation', 'Scanner-Plan': 'Scanner plan', 'Handel': 'Trade', 'Charaktere': 'Characters', 'Planeten': 'Planets', 'Karte': 'Map',
  'Wertschätzer': 'Appraisal', 'Kurier': 'Courier', 'PI-Planer': 'PI planner', 'Wurmlöcher': 'Wormholes', 'Industrie': 'Industry', 'Notizen': 'Notes',
  'Leistung': 'Performance', 'Uhr & Timer': 'Clock & timers',
  'Neuer Ordner': 'New folder', 'Neuer Ordner darin': 'New folder inside', 'Lesezeichen verwalten …': 'Manage bookmarks …', 'Lesezeichen importieren': 'Import bookmarks',
  'Kein Chrome, Edge oder Brave gefunden': 'No Chrome, Edge or Brave found', 'Keine Lesezeichen in Chrome, Edge oder Brave gefunden': 'No bookmarks found in Chrome, Edge or Brave', 'Alle in Tabs öffnen': 'Open all in tabs', 'Verschieben nach': 'Move to', 'Umbenennen': 'Rename',
  'Leiste (oben)': 'Bar (top level)', '(kein Ordner – „Neuer Ordner“ anlegen)': '(no folder – create a „New folder“)', '(leer)': '(empty)', 'Ersetzen': 'Replace', 'Zusätzlich': 'Add as well',
  'Lesezeichen konnten nicht gelesen werden.': 'Could not read the bookmarks.', 'Ersetzen = alten Import-Ordner durch den neuen ersetzen · Zusätzlich = zweiten Ordner anlegen': 'Replace = swap the old import folder for the new one · Add as well = create a second folder'
};
// Teilstücke in zusammengesetzten Texten (längste zuerst)
const MAIN_EN_PH = [[/^Wirklich alle (\d+) EVE-Clients beenden\?$/, 'Really quit all $1 EVE clients?'], [/^EVE-Clients umschalten mit /, 'Cycle EVE clients with '],
  [/ nicht eingeloggt$/, ' not logged in'], [/ \(Konto\)$/, ' (account)'], [/^Alle (\d+) in Tabs öffnen$/, 'Open all $1 in tabs'], [/^In (.+) sind keine Lesezeichen\.$/, 'There are no bookmarks in $1.'],
  [/^Ordner „(.+)“ mit (\d+) Lesezeichen löschen\?$/, 'Delete folder „$1“ with $2 bookmarks?'], [/^Ordner „(.+)“ gibt es schon\.$/, 'Folder „$1“ already exists.'],
  [/^(\d+) Lesezeichen importiert\.$/, '$1 bookmarks imported.'], [/^Ordner „(.+)“ in der Lesezeichen-Leiste – sortieren unter „Lesezeichen verwalten“\.$/, 'Folder „$1“ in the bookmark bar – sort it under „Manage bookmarks“.'], [/ – Durchklicken aktiv$/, ' – click-through active'], [/\bUmschalt\b/g, 'Shift'], [/\bStrg\b/g, 'Ctrl'], [/\bTaste$/, 'key']];
function uiLang(){ return S.lang === 'en' || S.lang === 'de' ? S.lang : (/^de\b/i.test(app.getLocale() || '') ? 'de' : 'en'); }
function T(x){
  if (typeof x !== 'string' || uiLang() !== 'en') return x;
  if (Object.prototype.hasOwnProperty.call(MAIN_EN, x)) return MAIN_EN[x];
  return MAIN_EN_PH.reduce((r, p) => r.replace(p[0], p[1]), x);
}
function tMenu(tpl){ return (tpl || []).map(it => { if (!it || typeof it !== 'object') return it; const o = Object.assign({}, it);
  if (o.label) o.label = T(o.label); if (o.sublabel) o.sublabel = T(o.sublabel); if (o.toolTip) o.toolTip = T(o.toolTip);
  if (Array.isArray(o.submenu)) o.submenu = tMenu(o.submenu); return o; }); }
function tDlg(o){ if (!o || typeof o !== 'object') return o; o = Object.assign({}, o); ['title', 'message', 'detail', 'buttonLabel'].forEach(k => { if (o[k]) o[k] = T(o[k]); });
  if (Array.isArray(o.buttons)) o.buttons = o.buttons.map(T); return o; }
try{ const bft = Menu.buildFromTemplate.bind(Menu); Menu.buildFromTemplate = tpl => bft(tMenu(tpl));
  ['showMessageBox', 'showMessageBoxSync', 'showOpenDialog', 'showOpenDialogSync', 'showSaveDialog'].forEach(f => { const o = dialog[f].bind(dialog);
    dialog[f] = (a, b) => b === undefined ? o(tDlg(a)) : o(a, tDlg(b)); }); }catch(e){ console.error('i18n main', e); }
const SAT_MIN = id => id === 'neocom' ? [36, 60] : (id === 'musik' ? [180, 60] : [180, 100]);
const JB_MINI_H = 84;   // Jukebox-Miniplayer: Startwert, danach meldet die Seite die echte Hoehe (BB12, satFitH)
// Doppelklick auf die Titelleiste der Jukebox: Miniplayer an/aus (Breite bleibt, Hoehe wird klein)
// Z5: alle anderen Einzelfenster klappen auf die Titelleiste ein (barH = Hoehe der Leiste laut Seite), nochmal = alte Hoehe
const SAT_NOROLL = ['neocom', 'alarm'];
function satMiniToggle(id, barH){
  const w = sats[id]; if (!w || w.isDestroyed() || SAT_NOROLL.includes(id)) return;
  const st = S.windows[id] = Object.assign({}, S.windows[id]);
  const b = w.getBounds();
  if (id !== 'musik'){
    if (!st.rolled){ st.normalH = b.height; st.rolled = true; st.rollH = Math.max(20, Math.min(60, Math.round(barH) || 30)); }
    else st.rolled = false;
    satRollApply(w, id, st);
    w.setBounds({ x: b.x, y: b.y, width: b.width, height: st.rolled ? st.rollH : Math.max(SAT_MIN(id)[1], st.normalH || 380) });
  }
  else if (!st.mini){ st.normalH = b.height; st.mini = true; w.setBounds({ x: b.x, y: b.y, width: b.width, height: st.miniH || JB_MINI_H }); }
  else { st.mini = false; w.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(160, st.normalH || 380) }); }
  st.bounds = w.getBounds();
  saveSettings(); pushSettings();
}
// Z5: eingeklappt = kleine Mindesthoehe und nicht mit der Maus aufziehbar (sonst leere Flaeche unter der Leiste)
function satRollApply(w, id, st){
  const r = !!(st && st.rolled && !SAT_NOROLL.includes(id) && id !== 'musik');
  w.setMinimumSize(SAT_MIN(id)[0], r ? st.rollH : SAT_MIN(id)[1]);
  w.setResizable(!r);
}
const sats = {};
let satClosingAll = false;
function satIdOf(wc){ return Object.keys(sats).find(id => sats[id] && !sats[id].isDestroyed() && sats[id].webContents === wc) || null; }
function satDefaultBounds(id){
  const wa = screen.getPrimaryDisplay().workArea, i = Object.keys(VIEWS).indexOf(id);
  if (id === 'neocom') return { width: 66, height: Math.min(640, wa.height - 160), x: wa.x + 8, y: wa.y + 120 };
  if (id === 'piplan') return { width: 1000, height: Math.min(760, wa.height - 160), x: wa.x + wa.width - 1020, y: wa.y + 100 };   // DD3: 6 Spalten passen
  return { width: 320, height: 380, x: wa.x + wa.width - 340 - (i % 4) * 30, y: wa.y + 120 + (i % 4) * 40 };
}
function applySatState(w){
  if (!w || w.isDestroyed()) return;
  zSet(w, satTop(Object.keys(sats).find(k => sats[k] === w)));
  w.setOpacity(Math.max(0.3, Math.min(1, Number(S.opacity) || 1)));
  w.setIgnoreMouseEvents(satCt(w), satCt(w) ? { forward: true } : undefined);
}
// 09.10.: Vordergrund je Overlay merken (S.windows[id].top) – ohne eigenen Wert gilt der allgemeine Schalter
function satTop(id){ const t = id && (S.windows[id] || {}).top; return typeof t === 'boolean' ? t : !!S.alwaysOnTop; }
// S2: Durchklicken fuer alle Overlays oder nur fuer einzelne (S.windows[id].ct). Das Neocom bleibt klickbar – dort schaltet man es um.
function satCt(w){
  const id = Object.keys(sats).find(k => sats[k] === w);
  return !!S.clickThrough || !!(id && id !== 'neocom' && (S.windows[id] || {}).ct);
}
function openSat(id, show){
  if (!VIEWS[id] || quitting) return null;   // 4.0.67: beim Beenden keine Fenster mehr oeffnen – sonst bricht app.quit ab
  if (sats[id] && !sats[id].isDestroyed()) return sats[id];
  const cfg = S.windows[id] || {};
  const b = visibleOnScreen(cfg.bounds) ? cfg.bounds : satDefaultBounds(id);
  // 4.0.51: fertig geladenes Reserve-Fenster nehmen (Klick → sofort da), nur das Neocom braucht eigene Fenster-Art (nicht fokussierbar)
  const sp = id !== 'neocom' && satSpareTake(), w = sp || satWin(b, id !== 'neocom');
  if (sp){ w.setBounds(b); w.setTitle('EVE Omni – ' + VIEWS[id]); }
  w.setMinimumSize(SAT_MIN(id)[0], SAT_MIN(id)[1]);
  sats[id] = w;
  w.setMenu(null);
  if (cfg.rolled){ satRollApply(w, id, cfg); w.setBounds({ x: b.x, y: b.y, width: b.width, height: cfg.rollH }); }
  if (id === 'neocom') w.on('system-context-menu', ev => { ev.preventDefault(); satMenu(id); });   // T8: Rechtsklick auf den Ziehbereich (Windows)
  attachSnap(w);
  applySatState(w);
  let t = null;
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (w.isDestroyed()) return; S.windows[id] = Object.assign({}, S.windows[id], { bounds: w.getBounds() }); saveSettings(); }, 300); };
  w.on('move', remember); w.on('resize', remember);
  // N5: zKillboard aus dem Overlay im EVECore-Browser, alles andere im normalen Browser
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/zkillboard\.com\//.test(url)) openBrowser(url);
    else if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', ev => ev.preventDefault());
  w.on('closed', () => {
    if (sats[id] === w) delete sats[id];
    if (!quitting && !satClosingAll){ S.windows[id] = Object.assign({}, S.windows[id], { open: false }); saveSettings(); pushSettings(); }
  });
  if (sp){ w.webContents.executeJavaScript('window.__satBecome && window.__satBecome(' + JSON.stringify(id) + ')').catch(() => {}); if (show !== false) setTimeout(() => { if (!w.isDestroyed()) w.showInactive(); }, 30); }
  else w.once('ready-to-show', () => { if (show !== false) w.showInactive(); });
  setTimeout(satSpareMake, 1500);
  // Doppelklick auf die Zieh-Leiste wuerde unter Windows maximieren: bei Overlay-Fenstern nie maximieren, bei der Jukebox = Miniplayer
  let preMax = null;
  w.on('will-resize', () => { preMax = null; });
  w.on('maximize', () => { const cfg = S.windows[id] || {}; w.unmaximize(); if (cfg.bounds) w.setBounds(cfg.bounds); if (!SAT_NOROLL.includes(id)) satMiniToggle(id); });
  if (!sp) w.loadFile(effectiveHtml(), { query: satQuery(id) });
  return w;
}
function satWin(b, focusable){
  return new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    frame: false, transparent: !!S.transparent, backgroundColor: S.transparent ? '#00000000' : '#05070a',
    show: false, title: 'EVE Omni', icon: winIconPath(), thickFrame: !S.transparent, hasShadow: !S.transparent, skipTaskbar: true,
    focusable: focusable,   // 4.0.39: Neocom nie aktivieren (WS_EX_NOACTIVATE) – EVE bleibt vorne, Taskleiste blitzt nicht
    type: 'toolbar',   // 4.0.40: WS_EX_TOOLWINDOW – neues Overlay ist für Windows kein App-Fenster, EVE bleibt „Vollbild“ (sonst Taskleiste)
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false }
  });
}
// 4.0.51: ein unsichtbares Reserve-Fenster mit fertig geladener Seite (?fenster=spare) – sonst liest jedes Overlay erst die ganze Seite (~0,2–0,3 s)
let satSpare = null;
function satSpareMake(){
  if (quitting || (satSpare && !satSpare.isDestroyed())) return;
  const w = satSpare = satWin({ x: -32000, y: -32000, width: 320, height: 380 }, true);
  w.__key = effectiveHtml() + '|' + !!S.transparent + '|' + demoOn() + '|' + S.lang;
  w.setMenu(null);
  w.webContents.once('did-finish-load', () => { w.__ready = true; });
  w.on('closed', () => { if (satSpare === w) satSpare = null; });
  w.loadFile(effectiveHtml(), { query: satQuery('spare') });
}
function satSpareTake(){
  const w = satSpare;
  if (!w || w.isDestroyed() || !w.__ready) return null;
  satSpare = null;
  if (w.__key !== effectiveHtml() + '|' + !!S.transparent + '|' + demoOn() + '|' + S.lang){ w.destroy(); return null; }   // Einstellung geändert → frisch laden
  return w;
}
function closeSat(id){ const w = sats[id]; if (w && !w.isDestroyed()) w.close(); }
// front: vom Nutzer geoeffnet (Neocom-Klick, Einstellungen) -> nach vorne, auch wenn EVE gerade nicht vorne ist
// (sonst legt „nur ueber EVE“ es hinter das aktive Programm – Fenster scheint nicht aufzugehen; Nutzer 06.10.2026)
function syncSats(show, front){
  // O2: Hauling + Hub-Handel sind jetzt ein Fenster „Handel“
  ['hauling', 'hubhandel'].forEach(o => { if (S.windows[o]){ if (S.windows[o].open && !S.windows.handel) S.windows.handel = { open: true }; delete S.windows[o]; } });
  Object.keys(VIEWS).forEach(id => {
    const want = !!(S.windows[id] && S.windows[id].open);
    const has = !!(sats[id] && !sats[id].isDestroyed());
    if (want && !has){ const w = openSat(id, show !== false); if (front && w) w.once('show', () => setTimeout(() => { if (!w.isDestroyed()) w.moveTop(); }, 150)); }   // nach dem BELOW des Helfers
    if (!want && has){ satClosingAll = true; sats[id].close(); satClosingAll = false; }
  });
}
function recreateSats(){
  satClosingAll = true;
  Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()){ S.windows[id] = Object.assign({}, S.windows[id], { bounds: w.getBounds() }); w.destroy(); } delete sats[id]; });
  satClosingAll = false;
  syncSats();
}
function satsVisible(){ return Object.keys(sats).some(id => sats[id] && !sats[id].isDestroyed() && sats[id].isVisible()); }
function showSats(){ Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()) w.showInactive(); }); }
function hideSats(){ Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()) w.hide(); }); }

/* MM3 (10.10.2026): Klappmenüs und Rückfragen im EVE-Omni-Stil statt Windows-Menü/-Dialog (Browser-Fenster).
   Ein durchsichtiges Fenster so groß wie das Elternfenster liegt über der Webseite; Klick daneben, Esc oder Fokusverlust = zu.
   Vorlage wie bei den Windows-Menüs (label, sublabel, type checkbox/radio/separator, checked, enabled, submenu, click, folder). */
const EO_FOLDER = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.2h8.5A1.5 1.5 0 0 1 21 8.7v9.8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z" fill="currentColor" fill-opacity=".18"/></svg>';
const EO_POP_JS = `
var P = JSON.parse(decodeURIComponent(location.hash.slice(1))), R = document.getElementById("r"), open = [], done = false;
if (P.ic) document.documentElement.style.setProperty("--ic", P.ic);
function pick(v){ if (done) return; done = true; document.title = "eo:" + v + ":" + Date.now(); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function panel(items, x, y, lvl, flip){
  open.slice(lvl).forEach(function(p){ p.remove(); }); open.length = lvl;
  var p = document.createElement("div"); p.className = "m"; p.tabIndex = -1;
  items.forEach(function(it){
    if (it.sep){ p.appendChild(document.createElement("hr")); return; }
    var r = document.createElement("div"); r.className = "i" + (it.en === false ? " off" : "") + (it.kids ? " sub" : ""); r.__it = it;
    r.innerHTML = '<span class="c">' + (it.chk ? (it.radio ? "●" : "✓") : it.folder ? P.folder : "") + '</span><span class="t">' + esc(it.label) + (it.sl ? '<small>' + esc(it.sl) + "</small>" : "") + '</span><span class="a">' + (it.kids ? "›" : "") + "</span>";
    r.onmouseenter = function(){ hover(p, r, lvl); };
    r.onclick = function(ev){ ev.stopPropagation(); act(p, r, lvl); };
    p.appendChild(r);
  });
  R.appendChild(p); open.push(p);
  var W = innerWidth, H = innerHeight, w = p.offsetWidth, h = Math.min(p.offsetHeight, H - 8);
  p.style.maxHeight = (H - 8) + "px";
  var left = Math.max(4, Math.min(x, W - w - 4));
  p.style.left = left + "px"; p.style.top = Math.max(4, Math.min(H - h - 4, y)) + "px";
  return p;
}
function rows(p){ return [].slice.call(p.querySelectorAll(".i:not(.off)")); }
function sel(p, r){ [].forEach.call(p.querySelectorAll(".i.on"), function(x){ x.classList.remove("on"); }); if (r){ r.classList.add("on"); r.scrollIntoView({ block: "nearest" }); } }
function hover(p, r, lvl){ sel(p, r); clearTimeout(hover.t); hover.t = setTimeout(function(){ if (r.__it.kids && !r.classList.contains("off")) subOpen(p, r, lvl); else { open.slice(lvl + 1).forEach(function(x){ x.remove(); }); open.length = lvl + 1; } }, 120); }
function subOpen(p, r, lvl){ var b = r.getBoundingClientRect(), q = panel(r.__it.kids, b.right - 2, b.top - 5, lvl + 1, false); if (q.getBoundingClientRect().left < b.right - 10){ q.style.left = Math.max(4, b.left - q.offsetWidth + 2) + "px"; } return q; }
function act(p, r, lvl){ var it = r.__it; if (it.en === false) return; if (it.kids){ var q = subOpen(p, r, lvl); sel(q, rows(q)[0]); return; } pick(it.id); }
if (P.ask){
  var a = P.ask, d = document.createElement("div"); d.className = "m ask";
  d.innerHTML = '<div class="q">' + esc(a.message) + "</div>" + (a.detail ? '<div class="dt">' + esc(a.detail) + "</div>" : "") + '<div class="bs">' + a.buttons.map(function(b, i){ return '<button data-i="' + i + '"' + (i === a.def ? ' class="def"' : "") + ">" + esc(b) + "</button>"; }).join("") + "</div>";
  R.appendChild(d); d.style.left = Math.max(4, (innerWidth - d.offsetWidth) / 2) + "px"; d.style.top = Math.max(4, (innerHeight - d.offsetHeight) / 3) + "px";
  [].forEach.call(d.querySelectorAll("button"), function(b){ b.onclick = function(ev){ ev.stopPropagation(); pick(b.getAttribute("data-i")); }; });
  var df = d.querySelector("button.def") || d.querySelector("button"); df.focus();
} else { var m0 = panel(P.items, P.x, P.y, 0, false); }
document.addEventListener("mousedown", function(ev){ if (!ev.target.closest(".m")) pick(P.ask ? P.ask.cancel : "x"); });
document.addEventListener("contextmenu", function(ev){ ev.preventDefault(); });
document.addEventListener("keydown", function(ev){
  if (ev.key === "Escape"){ if (!P.ask && open.length > 1){ open.pop().remove(); return; } pick(P.ask ? P.ask.cancel : "x"); return; }
  if (P.ask){ if (ev.key === "ArrowLeft" || ev.key === "ArrowRight"){ var bs = [].slice.call(document.querySelectorAll(".bs button")), i = bs.indexOf(document.activeElement); bs[(i + (ev.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length].focus(); } return; }
  var p = open[open.length - 1], rs = rows(p), cur = p.querySelector(".i.on"), i = rs.indexOf(cur);
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp"){ ev.preventDefault(); sel(p, rs[(i + (ev.key === "ArrowDown" ? 1 : rs.length - 1) + (i < 0 && ev.key === "ArrowUp" ? 1 : 0)) % rs.length]); }
  else if (ev.key === "ArrowRight" && cur && cur.__it.kids){ act(p, cur, open.length - 1); }
  else if (ev.key === "ArrowLeft" && open.length > 1){ open.pop().remove(); }
  else if (ev.key === "Enter" && cur){ act(p, cur, open.length - 1); }
});`;
const EO_POP_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
  'html,body{margin:0;height:100%;background:transparent;overflow:hidden;font:13px "Segoe UI",system-ui,sans-serif;color:#c8d2dc;user-select:none}#r{position:fixed;inset:0}' +
  '.m{position:absolute;min-width:190px;max-width:420px;overflow-y:auto;padding:4px;background:rgba(9,12,16,.97);border:1px solid #2d3d4e;border-radius:4px;box-shadow:0 0 0 1px rgba(79,163,209,.12),0 10px 28px rgba(0,0,0,.65),0 0 14px rgba(79,163,209,.10);outline:none;scrollbar-width:thin}' +
  '.i{display:flex;align-items:center;gap:8px;min-height:26px;padding:3px 10px 3px 6px;border-radius:3px;cursor:pointer;white-space:nowrap}' +
  '.i.on{background:#16324a;color:#fff;box-shadow:inset 2px 0 0 #4fa3d1}.i.off{opacity:.4;cursor:default}' +
  '.i .c{flex:none;width:18px;display:inline-flex;justify-content:center;color:var(--ic, #e0b84a);font-size:12px}.i .c svg{color:var(--ic, #e0b84a);filter:drop-shadow(0 0 3px color-mix(in srgb, var(--ic, #e0b84a) 60%, transparent))}' +
  '.i .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:pre}.i small{display:block;font-size:11px;color:#6b7885;overflow:hidden;text-overflow:ellipsis}' +
  '.i .a{flex:none;width:10px;color:#4fa3d1;font-size:15px}hr{border:0;border-top:1px solid #1c2630;margin:4px 6px}' +
  '.ask{min-width:300px;max-width:440px;padding:16px 18px 14px;border-color:#4fa3d1}.q{font-size:14px;color:#e6edf3;font-weight:600;white-space:normal}.dt{margin-top:8px;color:#8fa0b0;white-space:normal;line-height:1.4}' +
  '.bs{display:flex;justify-content:flex-end;gap:6px;margin-top:16px}button{background:#131a22;color:#c8d2dc;border:1px solid #243140;border-radius:3px;height:26px;min-width:80px;padding:0 12px;cursor:pointer;font:inherit}' +
  'button:hover,button:focus{border-color:#4fa3d1;color:#fff;outline:none}button.def{border-color:#4fa3d1}' +
  '</style></head><body><div id="r"></div><script>' + EO_POP_JS + '</script></body></html>';
let eoPopWin = null;
function eoPop(parent, payload, onPick){
  if (!parent || parent.isDestroyed()) return;
  if (eoPopWin && !eoPopWin.isDestroyed()) eoPopWin.destroy();
  const cb = parent.getContentBounds();
  const w = eoPopWin = new BrowserWindow({ parent, x: cb.x, y: cb.y, width: cb.width, height: cb.height, frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, movable: false, minimizable: false, maximizable: false, skipTaskbar: true, hasShadow: false, show: false, webPreferences: { sandbox: true, contextIsolation: true, spellcheck: false } });
  w.setMenu(null);
  let fired = false;
  const finish = v => { if (fired) return; fired = true; if (!w.isDestroyed()) w.destroy(); if (eoPopWin === w) eoPopWin = null; onPick(v); };
  w.webContents.on('page-title-updated', (ev, t) => { ev.preventDefault(); const m = /^eo:([^:]*):/.exec(t); if (m) finish(m[1]); });
  w.on('blur', () => setTimeout(() => finish(null), 50));
  w.on('closed', () => finish(null));
  payload.folder = EO_FOLDER; payload.ic = S.icColor || '';
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(EO_POP_HTML) + '#' + encodeURIComponent(JSON.stringify(payload)));
  w.once('ready-to-show', () => { if (!w.isDestroyed()){ w.show(); w.focus(); } });
}
// Menü an der Mausposition (Vorlage wie bei den Windows-Menüs)
function eoMenu(parent, tpl){
  const fns = {}; let n = 0;
  const conv = list => (list || []).map(it => {
    if (it.type === 'separator') return { sep: true };
    const id = String(n++); if (it.click) fns[id] = it.click;
    return { id, label: it.label, sl: it.sublabel, chk: !!it.checked && (it.type === 'checkbox' || it.type === 'radio'), radio: it.type === 'radio', en: it.enabled !== false, folder: !!it.folder,
      kids: Array.isArray(it.submenu) ? conv(it.submenu) : undefined };
  });
  const items = conv(tMenu(tpl)), cb = parent.getContentBounds(), c = screen.getCursorScreenPoint();
  eoPop(parent, { items, x: c.x - cb.x, y: c.y - cb.y }, v => { const f = v != null && fns[v]; if (f) try{ f(); }catch(e){ console.error('eoMenu', e); } });
}
// Rückfrage/Meldung wie der Windows-Dialog – liefert Promise mit { response }
function eoAsk(parent, o){
  o = tDlg(o);
  const buttons = o.buttons && o.buttons.length ? o.buttons : ['OK'], cancel = o.cancelId != null ? o.cancelId : buttons.length - 1;
  return new Promise(res => eoPop(parent, { ask: { message: o.message || '', detail: o.detail || '', buttons, def: o.defaultId != null ? o.defaultId : 0, cancel } },
    v => res({ response: v == null || v === 'x' ? cancel : Number(v) })));
}
/* ---------------- E1: eigenes Browser-Fenster (Adresszeile, Zurueck/Vor, Lesezeichen) ----------------
   Oben die Leiste aus browser.html (kleine eigene Bruecke browser-preload.js), darunter die Webseite in einem
   WebContentsView ohne Zugriff aufs Programm (eigene Sitzung "persist:browser"). Schwebt wie die Overlays ueber EVE und rastet ein. */
const BROWSER_BAR_H = 90;   // CC7: + Tab-Leiste (26 px)
let bwin = null, bview = null, btabs = [], bact = 0;   // CC7: je Tab ein WebContentsView, sichtbar nur der aktive (bview)
// Eingabe der Adresszeile -> Adresse: mit http(s) so lassen, "zkillboard.com" -> https://, sonst Suche
function browserUrl(s){
  s = String(s || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(s)) return 'https://' + s;
  return (BROWSER_SEARCH[S.browser.search] || BROWSER_SEARCH.ddg)[1] + encodeURIComponent(s);   // FF1: Suchmaschine wählbar
}
// FF1: Einstellungen im Zahnrad des Browsers – Startseite, neuer Tab, Zoom, Suchmaschine
const BROWSER_SEARCH = { ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q='], google: ['Google', 'https://www.google.com/search?q='], bing: ['Bing', 'https://www.bing.com/search?q='], startpage: ['Startpage', 'https://www.startpage.com/do/search?q='] };
function browserHome(){ let f = ''; bmWalk(S.browser.bookmarks, n => { if (!f && n.url) f = n.url; }); return S.browser.home || f || 'https://evemaps.dotlan.net/'; }
function browserZoom(wc){ const z = Number(S.browser.zoom) || 1; if (Math.abs(wc.getZoomFactor() - z) > 0.001) wc.setZoomFactor(z); }
function browserState(){
  const wc = bview.webContents, h = wc.navigationHistory, c = S.windows.browser || {};
  return { url: wc.getURL(), title: wc.getTitle(), back: h.canGoBack(), fwd: h.canGoForward(), loading: wc.isLoading(), bookmarks: S.browser.bookmarks,
    tabs: btabs.map(v => ({ t: v.webContents.getTitle() || v.webContents.getURL() || 'Neuer Tab', l: v.webContents.isLoading() })), act: bact, lock: !!c.lock, home: browserHome(),
    marked: !!bmFind(wc.getURL()), manage: bmanage, edit: bedit, en: uiLang() === 'en', ic: S.icColor || '' };
}
// CC7: Tabs merken (nach Neustart wieder offen)
function browserSaveTabs(){
  S.browser.tabs = btabs.map(v => v.webContents.getURL() || v.eoUrl).filter(u => /^https?:\/\//.test(u)).slice(0, 20);
  S.browser.act = Math.min(bact, Math.max(0, S.browser.tabs.length - 1));
  if (bview) S.browser.last = bview.webContents.getURL();
  saveSettings();
}
function browserView(url){
  const v = new WebContentsView({ webPreferences: { partition: 'persist:browser', contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const wc = v.webContents;
  wc.session.setPermissionRequestHandler((c, perm, cb) => cb(perm === 'fullscreen' || perm === 'clipboard-sanitized-write'));
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) browserTab(url); return { action: 'deny' }; });   // CC7: Links für neue Fenster → neuer Tab
  ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-start-loading', 'did-stop-loading'].forEach(e => wc.on(e, browserPush));
  wc.on('did-navigate', browserSaveTabs); wc.on('did-navigate-in-page', browserSaveTabs);
  wc.on('did-finish-load', () => browserZoom(wc));   // FF1
  wc.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.control && !i.alt && /^[tw]$/i.test(i.key)){ e.preventDefault(); if (/t/i.test(i.key)) browserTab(''); else browserCloseTab(btabs.indexOf(v)); } });   // Strg+T / Strg+W auch in der Seite
  v.eoUrl = url; wc.loadURL(url);
  return v;
}
function browserSwitch(i){
  if (!bwin || bwin.isDestroyed() || !btabs[i]) return;
  if (bview && bview !== btabs[i]) bwin.contentView.removeChildView(bview);
  bact = i; bview = btabs[i]; bwin.contentView.addChildView(bview);
  browserLayout(); browserSaveTabs(); browserPush();
}
function browserTab(url){ const m = S.browser.newtab; btabs.push(browserView(browserUrl(url) || (m === 'blank' ? 'about:blank' : m === 'last' && S.browser.last) || browserHome())); browserSwitch(btabs.length - 1); }   // FF1
function browserCloseTab(i){
  const v = btabs[i]; if (!v) return;
  if (btabs.length === 1){ bwin.close(); return; }
  btabs.splice(i, 1);
  if (v === bview){ bwin.contentView.removeChildView(v); bview = null; }
  try{ v.webContents.close(); }catch(e){}
  browserSwitch(i < bact ? bact - 1 : Math.min(bact, btabs.length - 1));
}
// CC7: wie ein Overlay – Deckkraft, Sperren, Durchklicken (S.windows.browser), Vordergrund wie alle Overlays
function browserLook(){
  if (!bwin || bwin.isDestroyed()) return;
  const c = S.windows.browser || {}, ct = !!S.clickThrough || !!c.ct;
  zSet(bwin, satTop('browser'));
  bwin.setOpacity(Math.max(0.3, Math.min(1, Number(c.alpha) || 1)));
  bwin.setIgnoreMouseEvents(ct, ct ? { forward: true } : undefined);
  bwin.setResizable(!c.lock);
}
function browserMenu(){
  if (!bwin || bwin.isDestroyed()) return;
  const c = S.windows.browser || {}, set = p => { S.windows = merge(S.windows || {}, { browser: p }); saveSettings(); browserLook(); browserPush(); pushSettings(); };
  eoMenu(bwin, [
    { label: 'Position und Größe sperren', type: 'checkbox', checked: !!c.lock, click: () => set({ lock: !c.lock }) },
    { label: 'Deckkraft', submenu: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3].map(a => ({ label: Math.round(a * 100) + ' %', type: 'radio', checked: Math.abs((Number(c.alpha) || 1) - a) < 0.01, click: () => set({ alpha: a }) })) },
    { label: 'Durchklicken (nur Browser)', type: 'checkbox', checked: !!c.ct, sublabel: 'Ausschalten: Einstellungen › Programm › Durchklicken', click: () => set({ ct: !c.ct }) },
    { label: 'Immer im Vordergrund', type: 'checkbox', checked: satTop('browser'), click: () => set({ top: !satTop('browser') }) },
    { type: 'separator' },   // FF1
    { label: 'Startseite', sublabel: browserHome(), submenu: [
      { label: 'Aktuelle Seite als Startseite', click: () => { const u = bview && bview.webContents.getURL(); if (/^https?:\/\//.test(u)){ bset({ home: u }); } } },
      { label: 'Startseite öffnen', click: () => bview && bview.webContents.loadURL(browserHome()) },
      { label: 'Zurücksetzen (erstes Lesezeichen)', enabled: !!S.browser.home, click: () => bset({ home: '' }) }] },
    { label: 'Neuer Tab öffnet', submenu: [['home', 'Startseite'], ['blank', 'Leere Seite'], ['last', 'Zuletzt besuchte Seite']].map(x => ({ label: x[1], type: 'radio', checked: (S.browser.newtab || 'home') === x[0], click: () => bset({ newtab: x[0] }) })) },
    { label: 'Zoom', submenu: [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5].map(z => ({ label: Math.round(z * 100) + ' %', type: 'radio', checked: Math.abs((Number(S.browser.zoom) || 1) - z) < 0.001, click: () => { bset({ zoom: z }); btabs.forEach(v => browserZoom(v.webContents)); } })) },
    { label: 'Suchmaschine (Adressleiste)', submenu: Object.keys(BROWSER_SEARCH).map(k => ({ label: BROWSER_SEARCH[k][0], type: 'radio', checked: (S.browser.search || 'ddg') === k, click: () => bset({ search: k }) })) }
  ]);
  function bset(p){ Object.assign(S.browser, p); saveSettings(); browserPush(); }
}
/* BM (09.10.2026): Lesezeichen als Baum – Lesezeichen {name, url} oder Ordner {name, kids: []}; Pfad = Indizes "0/3/1".
   Leiste = oberste Ebene; Ordner klappen als Menü auf; Verwalten = Liste mit Ziehen; Import aus Chrome/Edge/Brave. */
let bmanage = false, bedit = '';
function bmWalk(list, f, pre){ (list || []).forEach((n, i) => { const p = (pre ? pre + '/' : '') + i; f(n, p); if (n.kids) bmWalk(n.kids, f, p); }); }
function bmAt(p){
  const ix = String(p).split('/').filter(x => x !== '').map(Number); let list = S.browser.bookmarks, node = null, parent = null;
  for (const i of ix){ if (!list || !list[i]) return null; parent = list; node = list[i]; list = node.kids; }
  return node ? { node, list: parent, i: ix[ix.length - 1] } : null;
}
function bmFind(url){ let r = ''; if (/^https?:\/\//.test(url)) bmWalk(S.browser.bookmarks, (n, p) => { if (!r && n.url === url) r = p; }); return r; }
function bmUrls(list){ const o = []; bmWalk(list, n => { if (n.url) o.push(n.url); }); return o; }
// from verschieben: into = ans Ende des Ordners (to '' = Leiste), before/after = neben das Element to
function bmMove(from, to, mode){
  if (from === '' || (to + '/').startsWith(from + '/')) return false;   // nicht in sich selbst
  const a = bmAt(from), b = to === '' ? null : bmAt(to);
  if (!a || (to !== '' && !b) || (mode !== 'into' && !b)) return false;
  const tlist = mode === 'into' ? (b ? b.node.kids : S.browser.bookmarks) : b.list;
  if (!tlist) return false;
  const tnode = b && b.node;
  a.list.splice(a.i, 1);
  tlist.splice(mode === 'into' ? tlist.length : tlist.indexOf(tnode) + (mode === 'after' ? 1 : 0), 0, a.node);
  return true;
}
function bmDone(){ saveSettings(); browserPush(); }
function bmOpenAll(list){ bmUrls(list).slice(0, 20).forEach(u => browserTab(u)); }
function bmMenuItems(list, pre){
  const it = (list || []).map((n, i) => n.kids ? { label: String(n.name), folder: true, submenu: bmMenuItems(n.kids, pre + i + '/') }
    : { label: String(n.name), click: () => { bmanage = false; if (bview) bview.webContents.loadURL(n.url); browserLayout(); browserPush(); } });
  const n = bmUrls(list).length;
  if (n > 1) it.push({ type: 'separator' }, { label: 'Alle ' + Math.min(n, 20) + ' in Tabs öffnen', click: () => { bmanage = false; bmOpenAll(list); } });
  if (!it.length) it.push({ label: '(leer)', enabled: false });
  return it;
}
// Ziele für „Verschieben nach“: Leiste + alle Ordner außer sich selbst/darunter
function bmTargets(p){
  const own = bmAt(p), it = [];
  if (String(p).indexOf('/') >= 0) it.push({ label: 'Leiste (oben)', click: () => { if (bmMove(p, '', 'into')) bmDone(); } });
  bmWalk(S.browser.bookmarks, (n, q) => {
    if (!n.kids || (q + '/').startsWith(p + '/') || (own && own.list === n.kids)) return;
    it.push({ label: '    '.repeat(q.split('/').length - 1) + String(n.name), folder: true, click: () => { if (bmMove(p, q, 'into')) bmDone(); } });
  });
  return it.length ? it : [{ label: '(kein Ordner – „Neuer Ordner“ anlegen)', enabled: false }];
}
function bmImportItems(){
  const src = bmSources();
  return src.length ? src.map(x => ({ label: String(x.label), click: () => bmImport(x) })) : [{ label: 'Keine Lesezeichen in Chrome, Edge oder Brave gefunden', enabled: false }];
}
function bmCommon(){
  return [{ label: 'Neuer Ordner', click: () => bmNewFolder('') },
    { label: 'Lesezeichen verwalten …', click: () => browserCmd('manage', '1') },
    { label: 'Lesezeichen importieren', submenu: bmImportItems() }];
}
function bmNewFolder(parent){
  const b = parent === '' ? null : bmAt(parent), list = b ? b.node.kids : S.browser.bookmarks; if (!list) return;
  list.push({ name: uiLang() === 'en' ? 'New folder' : 'Neuer Ordner', kids: [] });
  bedit = (parent ? parent + '/' : '') + (list.length - 1); bmDone();
}
function bmDelete(p){
  const a = bmAt(p); if (!a) return;
  const n = a.node.kids ? bmUrls(a.node.kids).length : 0;
  const del = () => { const b = bmAt(p); if (b && b.node === a.node){ b.list.splice(b.i, 1); bmDone(); } };
  if (!n){ del(); return; }
  eoAsk(bwin, { buttons: ['Löschen', 'Abbrechen'], defaultId: 1, cancelId: 1, message: 'Ordner „' + a.node.name + '“ mit ' + n + ' Lesezeichen löschen?' }).then(r => { if (r.response === 0) del(); });
}
// Rechtsklick auf Lesezeichen/Ordner in der Leiste (p = Pfad) oder auf freie Fläche (p = '')
function browserBmMenu(p){
  const a = p === '' ? null : bmAt(p);
  if (!a){ eoMenu(bwin, bmCommon()); return; }
  const n = a.node, mv = d => { const j = a.i + d; if (j < 0 || j >= a.list.length) return; a.list.splice(a.i, 1); a.list.splice(j, 0, n); bmDone(); };
  eoMenu(bwin, [
    ...(n.kids ? [{ label: 'Alle in Tabs öffnen', enabled: bmUrls(n.kids).length > 0, click: () => bmOpenAll(n.kids) }, { label: 'Neuer Ordner darin', click: () => bmNewFolder(p) }]
      : [{ label: 'Als Startseite', type: 'checkbox', checked: browserHome() === n.url, click: () => { S.browser.home = n.url; bmDone(); } },
         { label: 'In neuem Tab öffnen', click: () => browserTab(n.url) }]),
    { type: 'separator' },
    { label: '◀ Nach links', enabled: a.i > 0, click: () => mv(-1) },
    { label: 'Nach rechts ▶', enabled: a.i < a.list.length - 1, click: () => mv(1) },
    { label: 'Verschieben nach', submenu: bmTargets(p) },
    { label: 'Umbenennen', click: () => { bedit = p; browserPush(); } },
    { label: 'Löschen', click: () => bmDelete(p) },
    { type: 'separator' },
    ...bmCommon()
  ]);
}
// Import: Lesezeichen-Datei von Chrome/Edge/Brave (alle Profile) lesen – nur lesen, nichts am anderen Browser ändern
function bmSources(){
  const L = process.env.LOCALAPPDATA || '', out = [];
  [['Chrome', 'Google/Chrome'], ['Edge', 'Microsoft/Edge'], ['Brave', 'BraveSoftware/Brave-Browser']].forEach(([b, d]) => {
    const root = path.join(L, d, 'User Data'); let names = {}, dirs = [];
    try{ names = ((JSON.parse(fs.readFileSync(path.join(root, 'Local State'), 'utf8')).profile || {}).info_cache) || {}; }catch(e){}
    try{ dirs = fs.readdirSync(root); }catch(e){}
    // Chrome mit Google-Konto: Lesezeichen in „AccountBookmarks“, die lokale „Bookmarks“ ist dann oft leer – beide anbieten
    dirs.forEach(x => [['Bookmarks', ''], ['AccountBookmarks', ' (Konto)']].forEach(([fn, tag]) => { const f = path.join(root, x, fn); if (fs.existsSync(f)) out.push({ browser: b, file: f, label: b + ' – ' + ((names[x] && names[x].name) || x) + tag }); }));
  });
  return out.filter(x => { try{ const r = JSON.parse(fs.readFileSync(x.file, 'utf8')).roots || {}; return bmUrls(['bookmark_bar', 'other', 'synced'].map(k => bmConv(r[k])).filter(Boolean)).length > 0; }catch(e){ return false; } });   // leere Dateien nicht anbieten
}
function bmConv(n){
  if (!n) return null;
  if (n.type === 'url') return /^https?:\/\//i.test(n.url || '') ? { name: String(n.name || n.url).slice(0, 80), url: n.url } : null;
  return { name: String(n.name || 'Ordner').slice(0, 80), kids: (n.children || []).map(bmConv).filter(Boolean) };
}
async function bmImport(src){
  let r;
  try{ r = JSON.parse(fs.readFileSync(src.file, 'utf8')).roots || {}; }
  catch(e){ eoAsk(bwin, { message: 'Lesezeichen konnten nicht gelesen werden.', detail: String(e.message) }); return; }
  const kids = ((r.bookmark_bar || {}).children || []).map(bmConv).filter(Boolean);
  const other = ((r.other || {}).children || []).concat((r.synced || {}).children || []).map(bmConv).filter(Boolean);   // „Mobile Lesezeichen“ mit dazu
  if (other.length) kids.push({ name: uiLang() === 'en' ? 'Other bookmarks' : 'Weitere Lesezeichen', kids: other });
  const n = bmUrls(kids).length;
  if (!n){ eoAsk(bwin, { message: 'In ' + src.label + ' sind keine Lesezeichen.' }); return; }
  const name = (uiLang() === 'en' ? 'From ' : 'Aus ') + src.browser, bm = S.browser.bookmarks, old = bm.findIndex(x => x.kids && x.name === name);
  let mode = 1;
  if (old >= 0) mode = (await eoAsk(bwin, { buttons: ['Ersetzen', 'Zusätzlich', 'Abbrechen'], defaultId: 0, cancelId: 2,
    message: 'Ordner „' + name + '“ gibt es schon.', detail: 'Ersetzen = alten Import-Ordner durch den neuen ersetzen · Zusätzlich = zweiten Ordner anlegen' })).response;
  if (mode === 2) return;
  const o2 = bm.findIndex(x => x.kids && x.name === name);   // während der Rückfrage kann sich die Leiste geändert haben
  if (o2 >= 0 && mode === 0) bm[o2] = { name, kids }; else bm.push({ name, kids });
  bmDone();
  eoAsk(bwin, { message: n + ' Lesezeichen importiert.', detail: 'Ordner „' + name + '“ in der Lesezeichen-Leiste – sortieren unter „Lesezeichen verwalten“.' });
}
// P2: Hauptfenster erfaehrt, ob das Browser-Fenster offen ist (Markierung im Neocom-Overlay)
function browserOpenPush(){ send({ type: 'browserOpen', open: !!(bwin && !bwin.isDestroyed() && bwin.isVisible() && !bwin.isMinimized()) }); }
function browserPush(){ if (bwin && !bwin.isDestroyed() && bview){ bwin.webContents.send('browser:state', browserState()); bedit = ''; } }   // BM: „bearbeiten“ nur einmal schicken
function browserLayout(){
  if (!bwin || bwin.isDestroyed() || !bview) return;
  const [w, h] = bwin.getContentSize();
  bview.setBounds(bmanage ? { x: 0, y: h, width: 0, height: 0 } : { x: 0, y: BROWSER_BAR_H, width: w, height: Math.max(0, h - BROWSER_BAR_H) });   // BM: Verwaltung zeigt die Liste statt der Seite
}
// DD5: offiziellen EVE-Launcher öffnen (Anmeldung bleibt bei CCP); fehlt er, Download-Seite
function launchEve(){
  const exe = path.join(process.env.LOCALAPPDATA || '', 'eve-online', 'eve-online.exe');
  if (fs.existsSync(exe)) shell.openPath(exe); else shell.openExternal('https://www.eveonline.com/download');
}
// FF5: alle EVE-Clients beenden (z. B. zur Downtime) – nach Rückfrage erst normal schließen, was nach 5 s noch läuft hart
function quitEve(){
  if (!IS_WIN) return;
  execFile('tasklist', ['/FI', 'IMAGENAME eq exefile.exe', '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => {
    const n = err ? 0 : (String(out).match(/exefile\.exe/ig) || []).length;
    const opt = n ? { type: 'warning', buttons: ['Alle beenden', 'Abbrechen'], defaultId: 1, cancelId: 1, title: 'EVE Omni', message: 'Wirklich ' + (n === 1 ? 'den EVE-Client' : 'alle ' + n + ' EVE-Clients') + ' beenden?',
      detail: 'Erst normal schließen – was nach 5 Sekunden noch läuft, wird hart beendet. Der Launcher bleibt offen.' } : { type: 'info', buttons: ['OK'], title: 'EVE Omni', message: 'Es läuft kein EVE-Client.' };
    const parent = win && !win.isDestroyed() && win.isVisible() ? win : null;
    (parent ? dialog.showMessageBox(parent, opt) : dialog.showMessageBox(opt)).then(r => {
      if (!n || r.response !== 0) return;
      execFile('taskkill', ['/IM', 'exefile.exe'], { windowsHide: true }, () => {});
      setTimeout(() => execFile('taskkill', ['/F', '/IM', 'exefile.exe'], { windowsHide: true }, () => {}), 5000);
    });
  });
}
function openBrowser(url){
  url = browserUrl(url);
  if (bwin && !bwin.isDestroyed()){
    if (url) browserTab(url);   // CC7: neuer Tab statt die offene Seite zu ersetzen
    bwin.show(); bwin.focus();
    return bwin;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const b = visibleOnScreen(S.browser.bounds) ? S.browser.bounds : { width: 960, height: 720, x: wa.x + Math.round((wa.width - 960) / 2), y: wa.y + 60 };
  const w = bwin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 380, minHeight: 200,
    frame: false, backgroundColor: '#05070a', show: false, title: 'EVE Omni – Browser', icon: winIconPath(),
    webPreferences: { preload: path.join(__dirname, 'browser-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  w.setMenu(null);
  attachSnap(w);
  browserLook();
  let t = null;
  // H7: maximiert merken, die normale Groesse dabei nicht ueberschreiben
  const remember = () => { clearTimeout(t); t = setTimeout(() => { if (w.isDestroyed() || w.isMinimized()) return; S.browser.max = w.isMaximized(); if (!S.browser.max) S.browser.bounds = w.getBounds(); saveSettings(); }, 300); };
  w.on('move', remember);
  w.on('resize', () => { browserLayout(); remember(); });
  w.on('maximize', remember); w.on('unmaximize', remember);
  w.webContents.on('will-navigate', ev => ev.preventDefault());
  w.on('closed', () => { const tabs = btabs; if (bwin === w){ bwin = null; bview = null; btabs = []; bact = 0; } tabs.forEach(v => { try{ v.webContents.close(); }catch(e){} }); browserOpenPush(); });   // Tabs bleiben in S.browser.tabs gemerkt
  ['show', 'hide', 'minimize', 'restore'].forEach(e => w.on(e, browserOpenPush));
  w.once('ready-to-show', () => { if (S.browser.max) w.maximize(); w.show(); browserLayout(); browserPush(); });
  w.loadFile(path.join(__dirname, 'browser.html'));
  // CC7: gemerkte Tabs wieder öffnen (alte Einstellungen: nur die letzte Seite)
  const saved = Array.isArray(S.browser.tabs) && S.browser.tabs.length ? S.browser.tabs.slice(0, 20) : [S.browser.last || browserHome()];
  const act = Math.min(Number(S.browser.act) || 0, saved.length - 1);
  btabs = saved.map(u => browserView(u)); bact = act;
  if (url) btabs.push(browserView(url));
  browserSwitch(url ? btabs.length - 1 : act);
  return w;
}
function browserCmd(type, arg){
  if (!bwin || bwin.isDestroyed() || !bview) return;
  const wc = bview.webContents, h = wc.navigationHistory, bm = S.browser.bookmarks;
  if (type === 'go' || type === 'tab' || type === 'newtab'){ if (bmanage){ bmanage = false; browserLayout(); } }   // BM: Seite aufrufen beendet die Verwaltung
  if (type === 'go'){ const u = browserUrl(arg); if (u) wc.loadURL(u); }
  else if (type === 'back'){ if (h.canGoBack()) h.goBack(); }
  else if (type === 'fwd'){ if (h.canGoForward()) h.goForward(); }
  else if (type === 'reload') wc.reload();
  else if (type === 'stop') wc.stop();
  else if (type === 'external'){ const u = wc.getURL(); if (/^https?:\/\//.test(u)) shell.openExternal(u); }
  else if (type === 'mark'){   // Stern: aktuelle Seite merken (Leiste) oder wieder entfernen (egal in welchem Ordner)
    const u = wc.getURL(), f = bmFind(u);
    if (f){ const a = bmAt(f); a.list.splice(a.i, 1); }
    else if (/^https?:\/\//.test(u)) bm.push({ name: (wc.getTitle() || u).slice(0, 30), url: u });
    saveSettings();
  }
  else if (type === 'unmark'){ const f = bmFind(arg); if (f){ const a = bmAt(f); a.list.splice(a.i, 1); saveSettings(); } }
  else if (type === 'close'){ bwin.close(); return; }
  else if (type === 'newtab'){ browserTab(arg); return; }   // CC7
  else if (type === 'tab'){ browserSwitch(Number(arg) || 0); return; }
  else if (type === 'closetab'){ browserCloseTab(Number(arg) || 0); return; }
  else if (type === 'menu'){ browserMenu(); return; }
  else if (type === 'bmmenu'){ browserBmMenu(arg); return; }   // FF1
  else if (type === 'rename'){ const p = String(arg).split('\n'), a = bmAt(p[0]), n = (p[1] || '').trim().slice(0, 80); bedit = ''; if (a && n){ a.node.name = n; saveSettings(); } }   // BM: Pfad statt Adresse
  else if (type === 'bmfolder'){ const a = arg === '' ? null : bmAt(arg); if (a && a.node.kids) eoMenu(bwin, bmMenuItems(a.node.kids, arg + '/')); return; }
  else if (type === 'manage'){ bmanage = arg === '1'; browserLayout(); }
  else if (type === 'import'){ eoMenu(bwin, bmImportItems()); return; }
  else if (type === 'bmnew'){ bmNewFolder(arg); return; }
  else if (type === 'bmdel'){ bmDelete(arg); return; }
  else if (type === 'bmopen'){ const a = bmAt(arg); if (a && a.node.url){ bmanage = false; wc.loadURL(a.node.url); browserLayout(); } }
  else if (type === 'bmmove' || type === 'bmedit'){
    let o = {}; try{ o = JSON.parse(arg); }catch(e){}
    if (type === 'bmmove'){ if (bmMove(String(o.from), String(o.to), o.mode === 'before' || o.mode === 'after' ? o.mode : 'into')) saveSettings(); }
    else { const a = bmAt(o.p), n = String(o.name || '').trim().slice(0, 80), u = String(o.url || '').trim(); bedit = '';
      if (a){ if (n) a.node.name = n; if (a.node.url && /^https?:\/\//i.test(u)) a.node.url = u; saveSettings(); } }
  }
  browserPush();
}

// W12: Hauptfenster wie ein Overlay – eigene Schalter in der Titelleiste: Vordergrund (alwaysOnTopFull), Deckkraft (opacityFull),
// Durchklicken und Sperren (windows.main). Das allgemeine Durchklicken gilt nur fuer die Overlays, sonst kaeme man nicht mehr heran.
function applyWindowState(){
  if (!win || win.isDestroyed()) return;
  const top = !!(S.alwaysOnTop && S.alwaysOnTopFull), ct = !!(S.windows.main || {}).ct;
  zSet(win, top);
  if (top) win.setVisibleOnAllWorkspaces(false);
  win.setOpacity(Math.max(0.3, Math.min(1, Number(S.opacityFull) || 1)));
  win.setIgnoreMouseEvents(ct, ct ? { forward: true } : undefined);
  Object.keys(sats).forEach(id => applySatState(sats[id]));
  browserLook();   // CC7
  Object.keys(pvWins).forEach(h => zSet(pvWins[h], true));
}

function createWindow(showNow){
  const b = boundsFor();
  const w = win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    minWidth: MIN[0], minHeight: MIN[1],
    frame: false, transparent: !!S.transparent, backgroundColor: S.transparent ? '#00000000' : '#05070a',
    show: false, title: 'EVE Omni', icon: winIconPath(), thickFrame: !S.transparent, hasShadow: !S.transparent,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, spellcheck: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setMenu(null);
  attachSnap(w);
  applyWindowState();
  if (S.maximized && !S.transparent) win.maximize();

  // Links: EVE-Login im eigenen Fenster, alles andere im normalen Browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/login\.eveonline\.com\//.test(url) || (TEST && url === 'about:blank#evelogin')){
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 780, alwaysOnTop: true, autoHideMenuBar: true, title: 'EVE Login',
        icon: winIconPath(), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    }
    // Spotify-Anmeldung aus dem eingebetteten Player der Jukebox: im Programm oeffnen, damit der Player danach ganze Titel spielt
    if (/^https:\/\/accounts\.spotify\.com\//.test(url)){
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 760, alwaysOnTop: true, autoHideMenuBar: true, title: 'Spotify-Anmeldung',
        icon: winIconPath(), webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-create-window', child => {
    const catchRedirect = (ev, url) => {
      if (isSsoReturn(url)){
        ev.preventDefault();
        send({ type: 'sso', url });
        setTimeout(() => { try{ child.close(); }catch(e){} }, 50);
        if (win) { win.show(); win.focus(); }
      }
    };
    child.webContents.on('will-redirect', catchRedirect);
    child.webContents.on('will-navigate', catchRedirect);
    child.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  });
  win.webContents.on('will-navigate', (ev, url) => {            // die Seite selbst nie wegnavigieren
    if (!/^file:/.test(url)){ ev.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
  // Downloads (Sync-.bat, Daten-Export): Speichern-Dialog, Standard: Downloads-Ordner
  win.webContents.session.on('will-download', (ev, item) => {
    if (TEST) { item.setSavePath(path.join(app.getPath('temp'), item.getFilename())); return; }
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });

  let moveTimer = null;
  const remember = () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!win || win.isDestroyed() || win.isMinimized()) return;
      S.maximized = win.isMaximized(); if (S.maximized) { saveSettings(); return; }
      S.bounds.full = win.getBounds();
      saveSettings();
    }, 300);
  };
  win.on('moved', remember); win.on('resized', remember); win.on('move', remember); win.on('resize', remember);
  win.on('maximize', remember); win.on('unmaximize', remember);
  // Z8: backgroundThrottling aus -> document.hidden bleibt false; Sichtbarkeit fuers Neocom ("offen") selbst melden
  const vis = () => setTimeout(() => { if (win && !win.isDestroyed()) send({ type: 'mainVis', on: win.isVisible() && !win.isMinimized() }); }, 50);
  ['show', 'hide', 'minimize', 'restore'].forEach(e => win.on(e, vis));
  win.webContents.on('did-finish-load', vis);   // BB14: auch beim Start versteckt (Tray) melden
  win.on('minimize', () => { if (trayMin) return; S.minimized = true; saveSettings(); });
  win.on('restore', () => { if (S.minimized){ S.minimized = false; saveSettings(); } if (trayMin){ trayMin = false; applyWindowState(); win.focus(); } });
  win.on('close', ev => {
    if (!quitting && S.closeToTray && tray){ ev.preventDefault(); hideMain(); return; }
    if (!quitting && w === win){ quitting = true; setTimeout(() => app.quit(), 0); }   // Hauptfenster zu = Programm beenden (auch Einzelfenster)
  });
  win.on('closed', () => { if (win === w) win = null; });
  win.once('ready-to-show', () => {
    if (!showNow) return;
    win.show();
    if (S.minimized) win.minimize();
  });
  // V1: Demo ein/aus im Hauptfenster → Einzelfenster neu (mit bzw. ohne demo=1), Reserve-Fenster verwerfen
  let wasDemo = DEMO_ARG;
  win.webContents.on('did-navigate', () => { const d = demoOn(); if (d === wasDemo) return; wasDemo = d; if (satSpare && !satSpare.isDestroyed()) satSpare.destroy(); recreateSats(); cycleSend(); pvSync(); });
  win.loadFile(effectiveHtml(), DEMO_ARG ? { query: { demo: '1' } } : undefined);
  return win;
}
// Transparenz laesst sich nur beim Anlegen festlegen: neues Fenster aufbauen, dann das alte schliessen
function recreateWindow(){
  if (!win) return createWindow(true);
  const old = win, wasVisible = old.isVisible();
  if (!old.isMaximized()) S.bounds.full = old.getBounds();
  old.removeAllListeners('close');
  createWindow(wasVisible);
  old.destroy();
}

function showWin(focus){
  if (!win) createWindow(false);
  trayMin = false; applyWindowState();
  if (win.isMinimized()) win.restore();
  if (focus === false) win.showInactive(); else { win.show(); win.focus(); }
}
// Ein-/Ausblenden gilt fuer das Hauptfenster und alle Einzelfenster gemeinsam
function toggleShow(){
  const anyVisible = !mainHidden() || satsVisible();
  if (anyVisible){ hideMain(); hideSats(); }
  else { showWin(); showSats(); }
}

/* ---------------- Overlays nur ueber EVE ----------------
   Ein kleiner Hilfsprozess (PowerShell mit eingebettetem C#) meldet, welches Programm gerade vorne ist
   (GetForegroundWindow). Nur lesen – an EVE wird nichts gesendet. Ist EVE (exefile) vorne: Overlays "immer im
   Vordergrund". Ist ein anderes Programm vorne: Overlays direkt hinter dieses Fenster legen (SetWindowPos),
   dadurch verdeckt z. B. der Browser die Overlays. Klicks auf EVECore selbst aendern nichts.
   Faellt der Hilfsprozess aus, bleibt alles wie vorher (immer vorne). */
const fg = { proc: null, status: '', eve: true, hwnd: '0', name: '', clients: [], cycle: '', sent: [], switches: 0 };
// Quelltext des Hilfsprozesses: helfer.cs (C# 5). Er wird beim Start in ein PowerShell-Skript im Programm-Datenordner
// geschrieben und mit Add-Type uebersetzt (die Befehlszeile waere fuer -EncodedCommand inzwischen zu lang).
function helperScript(){
  const src = fs.readFileSync(path.join(__dirname, 'helfer.cs'), 'utf8');
  return "$src = @'\r\n" + src.replace(/\r?\n/g, '\r\n') + "\r\n'@\r\nAdd-Type -TypeDefinition $src -Language CSharp\r\n[EcFg]::Run()\r\n";
}
function hwndOf(w){
  try{ const b = w.getNativeWindowHandle(); return (b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0))).toString(); }catch(e){ return '0'; }
}
function startFgWatch(){
  if (!IS_WIN || TEST || fg.proc) return;
  try{
    const ps1 = path.join(app.getPath('userData'), 'evecore-helfer.ps1');
    fs.mkdirSync(path.dirname(ps1), { recursive: true });
    fs.writeFileSync(ps1, '\ufeff' + helperScript(), 'utf8');   // mit BOM, sonst liest PowerShell 5 die Datei als ANSI
    const p = fg.proc = require('child_process').spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    p.stdin.on('error', () => {});   // Helfer schon beendet (z. B. beim Beenden): Schreibfehler nicht als Fehlermeldung
    let buf = '';
    p.stdout.on('data', d => {
      buf += String(d);
      let i;
      while ((i = buf.indexOf('\n')) >= 0){ const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); fgLine(line); }
    });
    p.on('exit', () => { fg.proc = null; fg.status = 'fehler'; fg.clients = []; fg.cycle = ''; lastCycleLines = ''; fg.eve = true; applyWindowState(); pushSettings(); pvSync(); });
    p.on('error', () => { fg.proc = null; fg.status = 'fehler'; });
  }catch(e){ fg.status = 'fehler'; }
}
function fgLine(line){
  if (line === 'READY'){ fg.status = 'ok'; cycleSend(); pushSettings(); pvSync(); applyWindowState(); return; }   // applyWindowState: dem Helfer die Overlays melden (OV)
  if (line.indexOf('EVES') === 0){ fg.clients = parseEves(line); pushSettingsSoon(); pvSync(); return; }
  if (/^SWITCH \d+/.test(line)){ fg.switches++; return; }
  if (/^CYCLE /.test(line)){ fg.cycle = line.slice(6).trim(); pushSettingsSoon(); return; }
  if (/^CLIP \d+/.test(line)){ fg.clip = true; setTimeout(() => handleClip(true), 60); return; }
  const m = /^FG (\d+) ?(.*)$/.exec(line);
  if (m) fgEvent(m[1], m[2]);
}
// Vordergrund hat gewechselt
function fgEvent(hwnd, name){
  const n = String(name || '').toLowerCase();
  if (n === 'eve-omni' || n === 'evecore' || n === 'electron' || n === 'shell' || hwnd === '0') return;     // EVECore selbst / Taskleiste (W1) / kurz kein Fenster: nichts aendern
  fg.hwnd = String(hwnd); fg.name = n;
  pvSync();   // Rahmen um die Vorschau des Clients, der gerade vorne ist
  const eve = n === 'exefile';
  if (eve) fg.lastEve = fg.hwnd;   // H10: welcher Client zuletzt vorne war (fuer „Markt in EVE“)
  if (eve === fg.eve && eve) return;
  fg.eve = eve;
  applyWindowState();
}
function onlyEveActive(){ return S.overlayOnlyEve !== false && (fg.status === 'ok' || TEST); }
// Ein Fenster in den Vordergrund-Modus setzen oder hinter das aktive fremde Programm legen
// S16: last = Namen-Fenster der Vorschau – der Helfer hebt es nach allen anderen, sonst liegt es unter seiner Vorschau
// U1: Namen-Fenster erst nach der Vorschau einordnen – sonst schiebt BELOW (anderes Programm/Monitor vorne) die Vorschau ueber ihren Namen
function zSet(w, top, last){
  if (!w || w.isDestroyed()) return;
  zSetOne(w, top, last);
  if (w.__name) zSet(w.__name, top, true);
}
function zSetOne(w, top, last){
  if (w.__ov !== !!top && fg.proc){ w.__ov = !!top; const h = hwndOf(w); fgWrite('OV ' + h + ' ' + (top ? (last ? 2 : 1) : 0)); w.once('closed', () => fgWrite('OV ' + h + ' 0')); }   // Helfer hebt es selbst, sobald EVE vorne ist
  if (top && onlyEveActive() && !fg.eve){
    w.setAlwaysOnTop(false);
    if (fg.proc && fg.hwnd !== '0'){ try{ fg.proc.stdin.write('BELOW ' + hwndOf(w) + ' ' + fg.hwnd + '\n'); }catch(e){} }
    w.__below = true;
    return;
  }
  w.__below = false;
  if (top){ if (w.isAlwaysOnTop()) w.setAlwaysOnTop(false); w.setAlwaysOnTop(true, 'screen-saver'); }
  else w.setAlwaysOnTop(false);
}

/* ---------------- EVE-Clients durchschalten (wie EVE-X-Preview) ----------------
   Der Hilfsprozess findet die EVE-Fenster (Titel "EVE - <Charakter>") und holt beim Druck auf die eingestellte Taste
   den naechsten Client nach vorne – nur wenn gerade ein EVE-Client vorne ist und mindestens zwei laufen.
   Die Taste wird dann nicht an EVE weitergegeben; sonst wird nichts an EVE gesendet. */
function parseEves(line){
  const rest = line.slice(4).trim();
  if (!rest) return [];
  return rest.split('\t').map(p => {
    const i = p.indexOf('='); if (i < 1) return null;
    const hwnd = p.slice(0, i), title = p.slice(i + 1);
    const m = /^EVE\s*-\s*(.+)$/.exec(title.trim());
    return /^\d+$/.test(hwnd) ? { hwnd, title, name: m ? m[1].trim() : '' } : null;
  }).filter(Boolean);
}
function cleanKey(k, def){
  k = k || {};
  const vk = Math.round(Number(k.vk)), mods = Math.round(Number(k.mods)) || 0;
  if (!(vk >= 0 && vk <= 254) || !(mods >= 0 && mods <= 15)) return def;
  return { vk, mods, label: String(k.label || '').slice(0, 40) };
}
function cycleCfg(){
  const c = S.cycle || {};
  return { on: !!c.on && !demoOn(), fwd: cleanKey(c.fwd, DEFAULTS.cycle.fwd), back: cleanKey(c.back, DEFAULTS.cycle.back), skipLogin: c.skipLogin !== false,   // V1: in der Demo kein Client-Umschalten
           order: (Array.isArray(c.order) ? c.order : []).map(n => String(n || '').replace(/[\t\r\n]/g, ' ').trim()).filter(Boolean).slice(0, 60),
           skip: (Array.isArray(c.skip) ? c.skip : []).map(n => String(n || '').replace(/[\t\r\n]/g, ' ').trim()).filter(Boolean).slice(0, 60) };   // LL6: Clients ohne Haken
}
function fgWrite(line){
  if (TEST){ fg.sent.push(line); if (fg.sent.length > 50) fg.sent.shift(); return; }
  if (fg.proc){ try{ fg.proc.stdin.write(line + '\n'); }catch(e){} }
}
let lastCycleLines = '';
function cycleSend(onlyIfChanged){
  const c = cycleCfg();
  const lines = 'CYCLE ' + (c.on ? 1 : 0) + ' ' + c.fwd.vk + ' ' + c.fwd.mods + ' ' + c.back.vk + ' ' + c.back.mods + ' ' + (c.skipLogin ? 1 : 0) + '\n' + 'ORDER ' + c.order.join('\t') + '\n' + 'SKIP ' + c.skip.join('\t');
  if (onlyIfChanged && lines === lastCycleLines) return;
  lastCycleLines = lines;
  lines.split('\n').forEach(fgWrite);
}
let pushSoonTimer = null;
function pushSettingsSoon(){ clearTimeout(pushSoonTimer); pushSoonTimer = setTimeout(pushSettings, 250); }
// Einen EVE-Client nach vorne holen (Klick in den Einstellungen, spaeter Klick auf eine Vorschau-Kachel)
// S6: Nach einem Mausklick in EVECore gehoert die letzte Eingabe uns – Windows laesst das Hilfsprogramm dann kein Fenster
// nach vorne holen. Also vorher die Erlaubnis weitergeben (bei Tastenkuerzeln hatte der Helfer die Eingabe selbst).
let fgAllowFn;
function fgAllow(){
  if (fgAllowFn === undefined){ try{ fgAllowFn = require('koffi').load('user32.dll').func('bool __stdcall AllowSetForegroundWindow(uint32 pid)'); }catch(e){ fgAllowFn = null; } }
  if (fgAllowFn){ try{ fgAllowFn(0xFFFFFFFF); }catch(e){} }
}
function activateClient(hwnd){
  hwnd = String(hwnd || '');
  if (!fg.clients.some(c => c.hwnd === hwnd)) return false;
  fgAllow();
  fgWrite('ACTIVATE ' + hwnd);
  return true;
}

/* ---------------- Client-Vorschau (Stufe 2 + 3, wie EVE-X-Preview) ----------------
   Live-Bild der EVE-Fenster ueber die Fenster-Aufnahme von Chromium (nur lesen, an EVE wird nichts gesendet).
   Eine Seite meldet erst previewPick(hwnd) und ruft dann getDisplayMedia(): der Handler gibt genau dieses EVE-Fenster frei,
   ohne Auswahl-Abfrage. Stufe 2 = Kacheln in den Einstellungen (EVE-Clients), Stufe 3 = je Client ein kleines schwebendes
   Fenster (vorschau.html): Klick = Client nach vorne, Ziehen = verschieben (rastet ein, Position je Charakter gemerkt). */
const capPick = new Map();   // Renderer-Prozess -> angefragte Fenster (hwnd), der Reihe nach
function capSetup(){
  session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
    const q = req.frame && capPick.get(req.frame.processId), hwnd = q && q.shift();
    if (!hwnd || !fg.clients.some(c => c.hwnd === hwnd)) return cb({});
    desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } })
      .then(src => { const f = src.find(x => x.id.indexOf('window:' + hwnd + ':') === 0); cb(f ? { video: f } : {}); })
      .catch(() => cb({}));
  });
}
function capRequest(pid, hwnd){ const q = capPick.get(pid) || []; q.push(String(hwnd)); capPick.set(pid, q.slice(-8)); }
const pvWins = {};   // hwnd -> schwebendes Vorschau-Fenster
function pvBw(v, d){ v = Number(v); return v >= 0 && v <= 8 ? Math.round(v) : d; }
function pvCfg(){
  const p = S.preview || {};
  return { float: !!p.float, fps: [1, 5, 10, 15, 30].indexOf(Number(p.fps)) >= 0 ? Number(p.fps) : 10, width: Math.max(160, Math.min(640, Math.round(Number(p.width)) || 280)),
    fit: p.fit === 'full' ? 'full' : 'crop', border: /^#[0-9a-f]{6}$/i.test(p.border || '') ? p.border : '#e0b84a', engine: p.engine === 'video' ? 'video' : 'dwm',
    stack: p.stack !== false, stackLabel: ['count', 'select', 'nolog'].indexOf(p.stackLabel) >= 0 ? p.stackLabel : 'count',
    bwAct: pvBw(p.bwAct, 2), bwIdle: pvBw(p.bwIdle, 1),   // T7: Rahmendicke 0-8 px
    nameOn: p.nameOn !== false, nameAct: /^#[0-9a-f]{6}$/i.test(p.nameAct || '') ? p.nameAct : '#e0b84a', nameIdle: /^#[0-9a-f]{6}$/i.test(p.nameIdle || '') ? p.nameIdle : '#c8d2dc' };
}
// O1: Name farbig oben mittig ueber dem Bild, ohne Balken. Eigenes durchsichtiges Mini-Fenster (gehoert zur Vorschau),
// weil Windows das Spiegelbild ueber den Fensterinhalt zeichnet. Klicks gehen durch auf die Vorschau.
const PV_NAME_H = 24;
const PV_NAME_HTML = 'data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:transparent;text-align:center">' +
  '<b id="t" style="display:inline-block;max-width:96%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 13px Segoe UI,system-ui,sans-serif;' +
  'text-shadow:0 0 3px #000,0 0 3px #000,0 1px 2px #000;padding-top:3px"></b></body></html>');
function pvName(w, text, color){
  if (!w || w.isDestroyed()) return;
  let n = w.__name;
  if (!text || !pvCfg().nameOn){ if (n && !n.isDestroyed()) n.hide(); return; }
  if (!n || n.isDestroyed()){
    n = w.__name = new BrowserWindow({ parent: w, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, focusable: false, skipTaskbar: true, show: false, hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
    n.setMenu(null); n.setIgnoreMouseEvents(true);
    n.webContents.on('will-navigate', ev => ev.preventDefault());
    n.webContents.on('did-finish-load', () => pvNameApply(n));
    n.loadURL(PV_NAME_HTML);
    zSet(n, true, true);
  }
  n.__want = { text: String(text), color: color };
  pvNameApply(n); pvNamePos(w);
  if (!n.isVisible()) n.showInactive();
}
function pvNameApply(n){
  if (n.isDestroyed() || !n.__want || n.webContents.isLoading()) return;
  n.webContents.executeJavaScript('var t=document.getElementById("t");t.textContent=' + JSON.stringify(n.__want.text) + ';t.style.color=' + JSON.stringify(n.__want.color)).catch(() => {});
}
function pvNamePos(w){
  const n = w && !w.isDestroyed() ? w.__name : null;
  if (!n || n.isDestroyed()) return;
  const b = w.getBounds(); n.setBounds({ x: b.x, y: b.y, width: b.width, height: PV_NAME_H });
}
// LL6: Haken oben rechts in der Vorschau – an = Client per Umschalt-Taste erreichbar, aus = übersprungen (S.cycle.skip, gilt vor + zurück).
// Eigenes Mini-Fenster wie der Name (das Spiegelbild würde HTML im Vorschaufenster überdecken); Klick meldet sich über den Seitentitel.
const PV_CHK = 18;
const PV_CHK_HTML = 'data:text/html;charset=utf-8,' + encodeURIComponent('<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:transparent;cursor:pointer">' +
  '<div id="b" style="box-sizing:border-box;width:18px;height:18px;border:2px solid #e0b84a;border-radius:3px;background:rgba(0,0,0,.65);color:#e0b84a;font:900 13px/14px Segoe UI,sans-serif;text-align:center"></div>' +
  '<script>var on=true;function set(v){on=v;var b=document.getElementById("b");b.textContent=on?"✓":"";b.style.opacity=on?"1":".75";}' +
  'document.addEventListener("mousedown",function(e){e.preventDefault();set(!on);document.title=(on?"1":"0")+"-"+Date.now();});set(true);</script></body></html>');
function pvSkipOn(name){ return cycleCfg().skip.some(n => n.toLowerCase() === String(name || '').toLowerCase()); }
function pvSkipSet(name, on){
  const skip = cycleCfg().skip.filter(x => x.toLowerCase() !== String(name).toLowerCase());
  if (!on) skip.push(String(name));
  S.cycle = Object.assign({}, S.cycle, { skip }); cycleSend(); saveSettings(); pushSettings();
}
function pvChk(w, c){
  if (!w || w.isDestroyed()) return;
  let k = w.__chk;
  if (!c.name){ if (k && !k.isDestroyed()) k.hide(); return; }   // Stapel der nicht eingeloggten: kein Haken
  if (!k || k.isDestroyed()){
    k = w.__chk = new BrowserWindow({ parent: w, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, focusable: false, skipTaskbar: true, show: false, hasShadow: false,
      width: PV_CHK, height: PV_CHK, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false } });
    k.setMenu(null);
    k.webContents.on('will-navigate', ev => ev.preventDefault());
    k.webContents.on('did-finish-load', () => pvChkApply(k));
    k.webContents.on('page-title-updated', (ev, t) => { if (/^[01]-/.test(t)) pvSkipSet(k.__name, t[0] === '1'); });
    k.loadURL(PV_CHK_HTML);
    zSet(k, true, true);
  }
  k.__name = c.name; pvChkApply(k); pvChkPos(w);
  if (!k.isVisible()) k.showInactive();
}
function pvChkApply(k){ if (!k.isDestroyed()) k.webContents.executeJavaScript('set(' + !pvSkipOn(k.__name) + ')').catch(() => {}); }
function pvChkPos(w){
  const k = w && !w.isDestroyed() ? w.__chk : null;
  if (!k || k.isDestroyed()) return;
  const b = w.getBounds(); k.setBounds({ x: b.x + b.width - PV_CHK - 4, y: b.y + 4, width: PV_CHK, height: PV_CHK });
}
function pvNameFor(w, c){
  pvChk(w, c);
  const p = pvCfg(), n = fg.clients.filter(x => !x.name).length;
  const text = c.name || T({ count: n + ' nicht eingeloggt', select: 'Charakterauswahl', nolog: 'Nicht eingeloggt' }[p.stackLabel]);
  pvName(w, text, fg.name === 'exefile' && fg.hwnd === c.hwnd ? p.nameAct : p.nameIdle);
}
function pvInfo(c){ const p = pvCfg(); return { hwnd: c.hwnd, name: c.name, fps: p.fps, width: p.width, fit: p.fit, border: p.border, bwAct: p.bwAct, bwIdle: p.bwIdle, active: fg.name === 'exefile' && fg.hwnd === c.hwnd, dwm: pvDwm() }; }
// H5: Breite je Charakter (mit der Maus gezogen), sonst die eingestellte Groesse; Hoehe folgt dem Seitenverhaeltnis
function pvSize(c, w){
  const pos = (S.preview.pos || {})[pvKey(c)] || {}, W = Math.max(120, Math.min(1600, Math.round(Number(pos.w)) || pvCfg().width));
  return { width: W, height: Math.round(W / ((w && w.__pvAspect) || 16 / 9)) + (pvDwm() ? PV_BAR : 0) };
}
// J2: je Charakter zwei Profile – „klein“ (Name) und „groß“ (Name#gross), Doppelklick schaltet um
function pvKey(c){ if (!c.name) return '#stapel';   // O7: Stapel der nicht eingeloggten Clients hat eine eigene Position
  const n = c.name.toLowerCase(); return (S.preview.big || {})[n] ? n + '#gross' : n; }
function pvToggleBig(w){
  const c = fg.clients.find(x => x.hwnd === w.__hwnd);
  if (!c || !c.name || w.isDestroyed()) return;
  const n = c.name.toLowerCase(), b = w.getBounds();
  S.preview.big = Object.assign({}, S.preview.big, { [n]: !(S.preview.big || {})[n] });
  const key = pvKey(c);
  if (!(S.preview.pos || {})[key]) S.preview.pos = Object.assign({}, S.preview.pos, { [key]: { x: b.x, y: b.y, w: S.preview.big[n] ? Math.min(1280, b.width * 2) : pvCfg().width } });
  const pos = S.preview.pos[key], sz = pvSize(c, w);
  const nb = visibleOnScreen({ x: pos.x, y: pos.y, width: sz.width, height: sz.height }) ? { x: pos.x, y: pos.y } : { x: b.x, y: b.y };
  w.setBounds({ x: nb.x, y: nb.y, width: sz.width, height: sz.height });
  saveSettings();
}
function pvHwndOf(wc){ return Object.keys(pvWins).find(h => pvWins[h] && !pvWins[h].isDestroyed() && pvWins[h].webContents === wc) || null; }
// Neue Fenster nebeneinander oben links, bis die Zeile voll ist, dann darunter
function pvDefaultPos(i, W, H){
  const wa = screen.getPrimaryDisplay().workArea, per = Math.max(1, Math.floor((wa.width - 20) / (W + 6)));
  return { x: wa.x + 10 + (i % per) * (W + 6), y: wa.y + 10 + Math.floor(i / per) * (H + 6) };
}
function pvOpen(c, i){
  const pos = (S.preview.pos || {})[pvKey(c)], sz = pvSize(c), W = sz.width, H = sz.height;
  const b = pos && visibleOnScreen({ x: pos.x, y: pos.y, width: W, height: H }) ? pos : pvDefaultPos(i, W, H);
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: W, height: H, minWidth: 120, frame: false, resizable: true, focusable: false, skipTaskbar: true, show: false, hasShadow: false,
    backgroundColor: '#000000', title: 'EVE Omni – Vorschau ' + c.name, icon: winIconPath(),
    webPreferences: { preload: path.join(__dirname, 'vorschau-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false }
  });
  w.setMenu(null);
  w.__pvAspect = 16 / 9;
  w.__dwm = pvDwm();
  if (!w.__dwm) w.setAspectRatio(w.__pvAspect);   // Groesse ziehen behaelt das Seitenverhaeltnis (Spiegelbild: Hoehe wird nach dem Ziehen angepasst)
  w.__hwnd = c.hwnd;
  pvLook(w);
  attachSnap(w);
  zSet(w, true);
  w.webContents.on('will-navigate', ev => ev.preventDefault());
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  let t = null;
  // Position und Breite je Charakter merken (sofort im Speicher, damit pvSync nicht zurueckspringt; Datei verzoegert)
  const remember = () => { if (w.isDestroyed()) return; const bb = w.getBounds(); S.preview.pos = Object.assign({}, S.preview.pos, { [pvKey(c)]: { x: bb.x, y: bb.y, w: bb.width } }); clearTimeout(t); t = setTimeout(saveSettings, 300); };
  w.on('move', () => { remember(); pvNamePos(w); pvChkPos(w); });
  w.on('resize', () => { remember(); pvThumb(w); pvNamePos(w); pvChkPos(w); });
  w.on('resized', () => { if (!w.__dwm || w.isDestroyed()) return; const bb = w.getBounds(), H = Math.round(bb.width / w.__pvAspect) + PV_BAR; if (Math.abs(bb.height - H) > 2) w.setBounds({ x: bb.x, y: bb.y, width: bb.width, height: H }); });
  w.webContents.on('did-finish-load', () => { const cc = fg.clients.find(x => x.hwnd === c.hwnd); if (cc) w.webContents.send('preview:info', pvInfo(cc)); });
  w.once('ready-to-show', () => { w.showInactive(); pvThumb(w); const cc = fg.clients.find(x => x.hwnd === c.hwnd); if (cc) pvNameFor(w, cc); });
  w.loadFile(path.join(__dirname, 'vorschau.html'));
  return w;
}
// Fenster passend zu den laufenden Clients oeffnen/schliessen. O7: alle Clients in der Charakterauswahl (ohne Namen)
// teilen sich ein Fenster („Stapel“), es zeigt den obersten; Klick holt ihn nach vorne, ist er schon vorne, kommt der naechste.
let pvStackTop = null;
function pvSync(){
  if (quitting) return;   // 4.0.67: Helfer meldet beim Beenden weiter FG/EVES – neue Vorschau-Fenster hielten das Programm am Leben
  const p = pvCfg();
  const all = p.float && !demoOn() && (fg.status === 'ok' || TEST) ? fg.clients : [];   // V1: keine schwebende Vorschau in der Demo
  const unnamed = all.filter(c => !c.name), top = unnamed.find(c => c.hwnd === pvStackTop) || unnamed[0];
  pvStackTop = top ? top.hwnd : null;
  const want = all.filter(c => c.name).concat(p.stack && top ? [top] : []), dwm = pvDwm();
  Object.keys(pvWins).forEach(h => {
    if (want.some(c => c.hwnd === h)) return;
    const w = pvWins[h]; delete pvWins[h];
    if (w && !w.isDestroyed()) w.destroy();
  });
  want.forEach((c, i) => {
    const w = pvWins[c.hwnd];
    if (!w || w.isDestroyed() || w.__dwm !== dwm || w.__stack !== !c.name){   // O7: eingeloggt → raus aus dem Stapel, eigenes Fenster an seinem Platz
      if (w && !w.isDestroyed()) w.destroy();
      pvWins[c.hwnd] = pvOpen(c, i); pvWins[c.hwnd].__stack = !c.name; return;
    }
    if (p.fit === 'crop') pvAspect(w, 16 / 9);
    pvLook(w); pvThumb(w);
    const b = w.getBounds(), sz = pvSize(c, w);
    if (b.width !== sz.width || Math.abs(b.height - sz.height) > 2) w.setBounds({ x: b.x, y: b.y, width: sz.width, height: sz.height });
    w.webContents.send('preview:info', pvInfo(c));
    pvNameFor(w, c);
  });
}
// J5: Vorschau als Windows-Spiegelbild (DWM) direkt im EVECore-Vorschaufenster: koffi ruft dwmapi.dll auf.
// Windows zeichnet das Bild des Clients selbst ins Fenster (fluessig, kaum Rechenlast). Klappt koffi nicht: Video.
let DWM;
function dwmApi(){
  if (DWM !== undefined) return DWM;
  DWM = null;
  if (!IS_WIN || TEST) return DWM;
  try{
    const koffi = require('koffi'), d = koffi.load('dwmapi.dll');
    koffi.struct('PV_RECT', { l: 'int', t: 'int', r: 'int', b: 'int' });
    koffi.struct('PV_SIZE', { cx: 'int', cy: 'int' });
    koffi.pack('PV_PROPS', { flags: 'uint32', dest: 'PV_RECT', src: 'PV_RECT', opacity: 'uint8', visible: 'int', clientOnly: 'int' });
    DWM = { reg: d.func('long DwmRegisterThumbnail(intptr_t, intptr_t, _Out_ intptr_t *)'), upd: d.func('long DwmUpdateThumbnailProperties(intptr_t, PV_PROPS *)'),
      size: d.func('long DwmQueryThumbnailSourceSize(intptr_t, _Out_ PV_SIZE *)') };
  }catch(e){ DWM = null; }
  return DWM;
}
function pvDwm(){ return pvCfg().engine === 'dwm' && !!dwmApi(); }
function pvAlpha(){ const a = Number((S.preview || {}).alpha); return a >= 0.2 && a <= 1 ? a : 1; }
function pvLook(w){ w.setOpacity(pvAlpha()); w.setResizable(!(S.preview || {}).lock); }
// Bild einsetzen/anpassen: ringsum 2 px Rand frei; „16:9 aus der Mitte“ schneidet die Quelle passend zu.
// Das Bild verschwindet mit dem Fenster von selbst (kein Abmelden noetig).
const PV_BAR = 2;    // N2: keine Titelleiste mehr; Hoehen-Zuschlag fuer den Rand
function pvThumb(w){
  const D = w && !w.isDestroyed() && w.__dwm ? dwmApi() : null;
  if (!D) return;
  if (!w.__thumb){ const out = [0]; if (D.reg(Number(hwndOf(w)), Number(w.__hwnd), out) === 0) w.__thumb = out[0]; else return; }
  const sz = {}; D.size(w.__thumb, sz);
  const sf = screen.getDisplayMatching(w.getBounds()).scaleFactor, b = w.getContentBounds(), bw = pvCfg(), B = Math.round(Math.max(bw.bwAct, bw.bwIdle) * sf);   // T7: Bild um den dicksten Rahmen einruecken
  const dest = { l: B, t: B, r: Math.round(b.width * sf) - B, b: Math.round(b.height * sf) - B };
  const sx = sz.cx || 1, sy = sz.cy || 1, da = (dest.r - dest.l) / Math.max(1, dest.b - dest.t);
  let src = { l: 0, t: 0, r: sx, b: sy };
  if (pvCfg().fit === 'crop'){
    if (sx / sy > da){ const cw = Math.round(sy * da); src = { l: Math.round((sx - cw) / 2), t: 0, r: Math.round((sx + cw) / 2), b: sy }; }
    else { const ch = Math.round(sx / da); src = { l: 0, t: Math.round((sy - ch) / 2), r: sx, b: Math.round((sy + ch) / 2) }; }
  } else if (sz.cx && sz.cy && Math.abs(w.__pvAspect - sx / sy) >= 0.01){ pvAspect(w, sx / sy); return; }   // setBounds -> resize -> pvThumb nochmal
  D.upd(w.__thumb, { flags: 0x1 | 0x2 | 0x4 | 0x8 | 0x10, dest, src, opacity: Math.round(pvAlpha() * 255), visible: 1, clientOnly: 1 });
}
// Rechtsklick auf die Vorschau: kleines Menue (Position sperren, Durchsichtigkeit) – gilt fuer alle Vorschau-Fenster
function pvMenu(w){
  const p = S.preview, set = patch => { Object.assign(S.preview, patch); saveSettings(); Object.keys(pvWins).forEach(h => { const o = pvWins[h]; if (o && !o.isDestroyed()){ pvLook(o); pvThumb(o); } }); };
  Menu.buildFromTemplate([
    { label: 'Position und Größe sperren', type: 'checkbox', checked: !!p.lock, click: () => set({ lock: !p.lock }) },
    { label: 'Durchsichtigkeit', submenu: [1, 0.9, 0.8, 0.7, 0.6, 0.5].map(a => ({ label: Math.round(a * 100) + ' %', type: 'radio', checked: Math.abs(pvAlpha() - a) < 0.01, click: () => set({ alpha: a }) })) }
  ]).popup({ window: w });
}
ipcMain.handle('evecore:previewPick', (ev, hwnd) => { capRequest(ev.sender.getProcessId(), hwnd); return true; });
ipcMain.handle('preview:pick', ev => { const h = pvHwndOf(ev.sender); if (h) capRequest(ev.sender.getProcessId(), h); return !!h; });
ipcMain.on('preview:activate', ev => {
  const h = pvHwndOf(ev.sender), c = h && fg.clients.find(x => x.hwnd === h);
  if (!h) return;
  if (c && !c.name && fg.hwnd === h){   // O7: Stapel – dieser Client ist schon vorne, also den naechsten nicht eingeloggten holen
    const u = fg.clients.filter(x => !x.name), nx = u[(u.findIndex(x => x.hwnd === h) + 1) % u.length];
    if (nx && nx.hwnd !== h){ pvStackTop = nx.hwnd; pvSync(); activateClient(nx.hwnd); return; }
  }
  activateClient(h);
});
ipcMain.on('preview:drag', (ev, phase) => { const h = pvHwndOf(ev.sender); if (h) satDrag(pvWins[h], String(phase)); });
ipcMain.on('preview:big', ev => { const h = pvHwndOf(ev.sender); if (h) pvToggleBig(pvWins[h]); });
ipcMain.on('preview:menu', ev => { const h = pvHwndOf(ev.sender); if (h) pvMenu(pvWins[h]); });
// H5 „ganzes Bild“: Fenster bekommt das Seitenverhaeltnis des Clients (keine schwarzen Balken)
function pvAspect(w, r){
  r = Number(r);
  if (!(r >= 0.5 && r <= 8) || Math.abs((w.__pvAspect || 0) - r) < 0.01) return;
  w.__pvAspect = r; if (!w.__dwm) w.setAspectRatio(r);
  const b = w.getBounds(); w.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.round(b.width / r) + (w.__dwm ? PV_BAR : 0) });
}
ipcMain.on('preview:aspect', (ev, r) => { const h = pvHwndOf(ev.sender); if (h && pvCfg().fit === 'full') pvAspect(pvWins[h], r); });

/* ---------------- Gang-Alarm: Kills live von zKillboard (R2Z2) ----------------
   https://r2z2.zkillboard.com/ephemeral/sequence.json -> aktuelle Nummer; dann <nummer>.json holen, bis 404 kommt,
   danach mindestens 6 s warten (Regel von zKillboard, max. 15 Abfragen/s – wir bleiben unter 7/s).
   Jeder Kill geht an die Seite; die prueft Umkreis/Angreifer/Freunde. */
const kf = { on: false, seq: null, timer: null, busy: false };
const KF_BASE = 'https://r2z2.zkillboard.com/ephemeral/';
function kfStatus(t){ send({ type: 'killfeed', status: t }); }
async function kfGet(url){
  const r = await fetch(url, { headers: { 'User-Agent': 'EVE Omni (privates EVE-Werkzeug, Electron)', 'Accept': 'application/json' }, cache: 'no-store' });
  return { status: r.status, ok: r.ok, json: r.ok ? await r.json() : null };
}
async function kfLoop(){
  kf.timer = null;
  if (!kf.on || kf.busy) return;
  kf.busy = true;
  let wait = 6500;
  try{
    if (kf.seq === null){ const r0 = await kfGet(KF_BASE + 'sequence.json'); if (!r0.ok) throw new Error('HTTP ' + r0.status); kf.seq = Number(r0.json.sequence); }
    let n = 0;
    while (kf.on && n < 60){
      const r = await kfGet(KF_BASE + kf.seq + '.json');
      if (r.status === 404) break;
      if (r.status === 429 || r.status === 403){ wait = 60000; kfStatus('gebremst (' + r.status + '), warte 1 Min'); break; }
      if (r.ok && r.json) send({ type: 'kill', data: r.json });
      kf.seq++; n++;
      await new Promise(res => setTimeout(res, 150));
    }
    if (n >= 60) wait = 100;
    if (wait !== 60000) kfStatus('verbunden');
  }catch(e){ kfStatus('Fehler: ' + e.message + ' – neuer Versuch in 30 s'); wait = 30000; kf.seq = null; }
  kf.busy = false;
  if (kf.on) kf.timer = setTimeout(kfLoop, wait);
}
/* ---------------- HZ23: Intel-Kanäle mitlesen (wie RIFT) ----------------
   EVE schreibt Chats nach Dokumente\EVE\logs\Chatlogs\<Kanal>_<JJJJMMTT>_<HHMMSS>[_<Charakter-ID>].txt (UTF-16 LE, nur mit „Chat in Datei protokollieren“).
   Wir lesen nur neue Zeilen der gewählten Kanäle und schicken sie an die Seite – dort Systemerkennung und Alarm über den Alert. */
const intel = { on: false, chans: [], dir: '', timer: null, pos: {} };
function intelDir(){ return intel.dir || path.join(app.getPath('documents'), 'EVE', 'logs', 'Chatlogs'); }
const INTEL_FILE = /^(.+)_(\d{8})_(\d{6})(?:_\d+)?\.txt$/;
function intelFiles(){
  let out = [];
  try{ out = fs.readdirSync(intelDir()).map(f => { const m = INTEL_FILE.exec(f); if (!m) return null; let st; try{ st = fs.statSync(path.join(intelDir(), f)); }catch(e){ return null; } return { f, chan: m[1], t: st.mtimeMs, size: st.size }; }).filter(Boolean); }catch(e){}
  return out;
}
function intelList(){
  const files = intelFiles(), last = {};
  files.forEach(x => { if (!last[x.chan] || x.t > last[x.chan]) last[x.chan] = x.t; });
  return { dir: intelDir(), ok: fs.existsSync(intelDir()), chans: Object.keys(last).filter(c => Date.now() - last[c] < 30 * 86400000).sort((a, b) => last[b] - last[a]) };
}
// ponytail: Abfrage jede Sekunde statt fs.watch (auf Windows bei OneDrive/Netzlaufwerk unzuverlässig) – bei sehr vielen Logdateien auf fs.watch umstellen
function intelTick(){
  intel.timer = null;
  if (!intel.on || !intel.chans.length) return;
  const want = intel.chans.map(c => c.toLowerCase()), now = Date.now();
  intelFiles().filter(x => want.indexOf(x.chan.toLowerCase()) >= 0 && now - x.t < 86400000).forEach(x => {
    const p = path.join(intelDir(), x.f);
    if (intel.pos[p] === undefined){ intel.pos[p] = x.size; return; }   // alte Zeilen beim Start nicht melden
    if (x.size < intel.pos[p]) intel.pos[p] = 0;
    if (x.size === intel.pos[p]) return;
    let len = x.size - intel.pos[p]; len -= len % 2;   // UTF-16: nur ganze Zeichen
    if (len <= 0) return;
    let buf = Buffer.alloc(len);
    try{ const fd = fs.openSync(p, 'r'); fs.readSync(fd, buf, 0, len, intel.pos[p]); fs.closeSync(fd); }catch(e){ return; }
    intel.pos[p] += len;
    buf.toString('utf16le').replace(/^\uFEFF/, '').split(/\r?\n/).forEach(line => {
      const m = /^\s*\[\s*([\d.]+ [\d:]+)\s*\]\s*(.+?)\s>\s(.*)$/.exec(line);
      if (m && m[2] !== 'EVE-System' && m[2] !== 'EVE System') send({ type: 'intel', chan: x.chan, who: m[2].trim(), text: m[3].trim(), t: Date.parse(m[1].replace(/\./g, '-').replace(' ', 'T') + 'Z') || now });
    });
  });
  intel.timer = setTimeout(intelTick, 1000);
}
function intelSet(o){
  o = o || {};
  intel.on = !!o.on; intel.chans = Array.isArray(o.chans) ? o.chans.map(String) : []; intel.dir = String(o.dir || '');
  clearTimeout(intel.timer); intel.timer = null;
  if (intel.on && !TEST) intelTick();
  return intelList();
}
function kfSet(on){
  on = !!on;
  if (on === kf.on) return;
  kf.on = on;
  clearTimeout(kf.timer); kf.timer = null;
  if (on){ kf.seq = null; kfLoop(); }
}

/* ---------------- Local automatisch erkennen ----------------
   Wie bei RIFT: Der Nutzer drueckt im EVE-Local Strg+A, Strg+C. Wir lesen nur die Zwischenablage (alle 0,4 s),
   senden nichts an EVE. Sieht der Text wie eine Namensliste aus, prueft die Seite per ESI, ob es Piloten sind,
   und oeffnet erst dann das Local-Fenster. */
const LOCAL_LINE = /^[A-Za-z0-9][A-Za-z0-9 '.\-_]{1,36}$/;
function looksLikeLocal(t){
  if (!t || t.length > 200000) return false;
  // geschuetzte Leerzeichen / Tabs wie normale Leerzeichen behandeln, Kopfzeilen (z. B. "Lokal [1456]") duerfen dabei sein
  const lines = String(t).replace(/[\u00a0\u2007\u202f]/g, ' ').split(/\r?\n|\r/).map(l => l.replace(/\t.*$/, '').trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 4000) return false;
  // Pilotennamen duerfen nur aus Ziffern bestehen (z. B. "0186") - ob es wirklich Piloten sind, prueft danach EVE
  const ok = lines.filter(l => LOCAL_LINE.test(l) && !/\s{2,}/.test(l)).length;
  return ok >= 2 && ok >= Math.min(lines.length - 1, lines.length * 0.8) && /[A-Za-z]/.test(t);
}
// AA11: D-Scan (je Zeile „TypID ⇥ Name ⇥ Typ ⇥ Entfernung“) – geht vor Wertschätzer und Local
function looksLikeDscan(t){
  if (!t || t.length > 200000) return false;
  const lines = String(t).split(/\r?\n|\r/).filter(l => l.trim());
  return lines.length > 0 && lines.filter(l => /^\d+\t[^\t]*\t[^\t]+(\t|$)/.test(l)).length >= lines.length * 0.8;
}
// AA2: Liste für den Wertschätzer (Inventar/Vertrag mit Tab + Menge, oder EFT-Fitting) – geht vor Local
function looksLikeAppraisal(t){
  if (!t || t.length > 200000) return false;
  const lines = String(t).split(/\r?\n|\r/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return false;
  if (/^\[[^,\]]+,.*\]$/.test(lines[0])) return true;
  return lines.filter(l => /^[^\t]+\t[\d.,' \u00a0]*\d[\d.,' \u00a0]*(\t|$)/.test(l)).length >= Math.max(1, lines.length * 0.6);
}
// Kopie verarbeiten (force = auch wenn der Text gleich ist wie beim letzten Mal, z. B. zweimal Strg+C im selben Local)
async function handleClip(force){
  if (demoOn()) return;   // V1: Demo nimmt nichts aus der Zwischenablage (Local/D-Scan/Login)
  const t = await readClip();
  if (t === lastClip && !force) return;
  lastClip = t;
  // Login im Browser (Chrome): kopierte Ruecksprung-Adresse mit ?code= direkt uebernehmen
  const tt = String(t || '').trim();
  if (isSsoReturn(tt) && /[?&]code=/.test(tt) && tt.length < 4000 && tt !== lastSso){ lastSso = tt; send({ type: 'sso', url: tt }); if (win){ showWin(true); } return; }
  if (looksLikeDscan(t)){ if (S.localWatch) send({ type: 'dscanPaste', text: t }); return; }   // AA11
  if (looksLikeAppraisal(t)){ send({ type: 'apPaste', text: t }); return; }   // Seite nimmt es nur bei offenem Wertschätzer
  if (!S.localWatch) return;
  if (looksLikeLocal(t)){ clipSent++; send({ type: 'localPaste', text: t, auto: true }); }
}
let lastClip = null, clipTimer = null, clipSent = 0, lastSso = '';
function startClipWatch(){
  clearInterval(clipTimer);
  readClip().then(t => { lastClip = t; });
  // Unter Windows meldet der Hilfsprozess jede Kopie (auch gleichen Text); sonst alle 0,4 s nach neuem Text schauen
  clipTimer = setInterval(() => { if (fg.status !== 'ok' || !fg.clip) handleClip(false); }, 400);
}
// Einzelfenster oeffnen und zeigen, ohne EVE den Fokus zu nehmen
function showView(id){
  if (!VIEWS[id]) return;
  if (!(S.windows[id] && S.windows[id].open)){ S.windows[id] = Object.assign({}, S.windows[id], { open: true }); saveSettings(); pushSettings(); updateTray(); }
  const w = openSat(id, true);
  if (w && !w.isDestroyed() && !w.isVisible() && w.webContents && !w.webContents.isLoading()) w.showInactive();
}

/* ---------------- Tastenkuerzel ---------------- */
// Zwischenablage lesen (neuere Electron-Versionen liefern hier ein Promise, aeltere direkt den Text)
async function readClip(){ try{ return String((await clipboard.readText()) || ''); }catch(e){ return ''; } }
let hotkeyStatus = {};
const HOTKEY_ACTIONS = {
  clickThrough: () => {
    // S2: ist irgendwo Durchklicken an, schaltet die Taste alles aus (Notausgang); sonst fuer alle Overlays an
    const one = Object.keys(S.windows).filter(k => (S.windows[k] || {}).ct);
    if (!S.clickThrough && one.length){ one.forEach(k => { delete S.windows[k].ct; }); applyWindowState(); saveSettings(); pushSettings(); return; }
    S.clickThrough = !S.clickThrough; applyWindowState(); saveSettings(); pushSettings(); },
  toggleShow: () => toggleShow(),
  // Local pruefen: der Nutzer hat im EVE-Local Strg+A, Strg+C gedrueckt -> Zwischenablage an die Seite geben
  localPaste: async () => {
    const text = await readClip();
    showView('local');
    send({ type: 'localPaste', text: text.slice(0, 200000) });
  },
  musicToggle: () => send({ type: 'music', cmd: 'toggle' }),
  musicNext: () => send({ type: 'music', cmd: 'next' }),
  musicPrev: () => send({ type: 'music', cmd: 'prev' })
};
function registerHotkeys(){
  globalShortcut.unregisterAll();
  hotkeyStatus = {};
  Object.keys(HOTKEY_ACTIONS).forEach(id => {
    const acc = S.hotkeys[id];
    if (!acc) return;
    let ok = false;
    try{ ok = globalShortcut.register(acc, HOTKEY_ACTIONS[id]); }catch(e){ ok = false; }
    hotkeyStatus[id] = !!ok;
  });
}

/* ---------------- Taskleistensymbol ---------------- */
function hk(id){ const a = S.hotkeys[id]; return a ? T(a.replace('CommandOrControl', 'Strg').replace('Shift', 'Umschalt')) : ''; }
let trayKey = '';
function updateTray(){
  if (!tray) return;
  const tpl = [
    { label: 'EVE Omni anzeigen / ausblenden', accelerator: undefined, sublabel: hk('toggleShow'), click: toggleShow },
    { label: 'EVE starten (Launcher)', click: launchEve },   // DD5
    { label: 'Alle EVE-Clients beenden …', click: quitEve },   // FF5
    { type: 'separator' },
    { label: 'Hauptfenster immer im Vordergrund', type: 'checkbox', checked: !!(S.alwaysOnTop && S.alwaysOnTopFull), click: m => { S.alwaysOnTopFull = m.checked; if (m.checked) S.alwaysOnTop = true; applyWindowState(); saveSettings(); pushSettings(); } },
    { label: 'Einrasten', type: 'checkbox', checked: S.snap !== false, click: () => { S.snap = S.snap === false; saveSettings(); pushSettings(); updateTray(); } },   // II1
    { label: 'Overlays immer im Vordergrund', type: 'checkbox', checked: !!S.alwaysOnTop, click: m => { S.alwaysOnTop = m.checked; Object.keys(S.windows).forEach(k => { if (S.windows[k]) delete S.windows[k].top; }); applyWindowState(); saveSettings(); pushSettings(); } },   // 09.10.: gilt wieder für alle
    { label: 'Durchklicken', type: 'checkbox', checked: !!S.clickThrough || Object.keys(S.windows).some(k => (S.windows[k] || {}).ct), sublabel: hk('clickThrough'), click: () => HOTKEY_ACTIONS.clickThrough() },   // W12: aus = auch Hauptfenster wieder klickbar
    { label: 'Transparenter Hintergrund', type: 'checkbox', checked: !!S.transparent, click: m => { S.transparent = m.checked; saveSettings(true); recreateWindow(); updateTray(); } },
    { label: 'EVE-Clients umschalten mit ' + ((cycleCfg().fwd.label) || 'Taste'), type: 'checkbox', checked: !!(S.cycle && S.cycle.on),
      click: m => { S.cycle = Object.assign(cycleCfg(), { on: m.checked }); cycleSend(); saveSettings(); pushSettings(); } },
    { label: 'Overlays', submenu: Object.keys(VIEWS).map(id => ({ label: VIEWS[id], type: 'checkbox', checked: !!(S.windows[id] && S.windows[id].open),
        click: m => { S.windows[id] = Object.assign({}, S.windows[id], { open: m.checked }); saveSettings(); syncSats(undefined, true); pushSettings(); } })) },
    { label: 'Browser-Fenster', click: () => openBrowser() },
    { label: 'Fensterposition zurücksetzen', click: () => resetBounds() },
    { type: 'separator' },
    { label: 'Einstellungen …', click: () => { showWin(); send({ type: 'openSettings' }); } },
    { label: 'Neocom-Einstellungen …', click: () => { showWin(); send({ type: 'openSettings', pane: 'neocom' }); } },   // BB12
    { label: 'Sicherungsordner öffnen', click: () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); } },
    { type: 'separator' },
    { label: 'Beenden', click: () => { quitting = true; app.quit(); } }
  ];
  // Menue nur bei Aenderung neu setzen: pushSettings kommt oft (EVE-Clients) – ein neues Menue, waehrend das alte offen ist, verschluckt den Klick (Beenden ging nicht)
  const key = JSON.stringify(tpl);
  if (key !== trayKey){ trayKey = key; tray.setContextMenu(Menu.buildFromTemplate(tpl)); }
  tray.setToolTip(T('EVE Omni Beta ' + app.getVersion() + (S.clickThrough ? ' – Durchklicken aktiv' : '')));
}
function createTray(){
  try{
    let img = winIconPath();   // BB12: Windows – .ico mit allen Groessen
    if (process.platform !== 'win32'){ img = nativeImage.createFromPath(path.join(__dirname, 'icon-16.png')); img.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(path.join(__dirname, 'icon-32.png')) }); }
    tray = new Tray(img);
    tray.on('click', toggleShow);
    updateTray();
  }catch(e){ tray = null; }
}
function resetBounds(){
  S.bounds.full = null; S.maximized = false;
  if (win){ if (win.isMaximized()) win.unmaximize(); win.setBounds(defaultBounds()); }
  saveSettings();
}

/* ---------------- Sicherungen ---------------- */
let backupWaiters = [];
function requestBackup(reason){
  return new Promise(resolve => {
    backupWaiters.push(resolve);
    send({ type: 'backupRequest', includeLogins: !!S.backup.logins, reason });
    setTimeout(() => { const i = backupWaiters.indexOf(resolve); if (i >= 0){ backupWaiters.splice(i, 1); resolve(false); } }, 15000);
  });
}
function writeBackup(json, reason){
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = 'EVE-Omni-Sicherung-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  // Pruefen, dass es wirklich eine EVECore-Datendatei ist
  const o = JSON.parse(json);
  if (!o || o.format !== 'evecore-daten') throw new Error('keine EVE-Omni-Daten');
  fs.writeFileSync(path.join(dir, name), json);
  // die letzten 14 behalten
  const all = fs.readdirSync(dir).filter(n => /^(EVE-Omni|EVECore)-Sicherung-\d{4}-\d\d-\d\d_\d{4}\.json$/.test(n)).sort((a, b) => a.slice(-20) < b.slice(-20) ? -1 : 1);   // nach Datum, alte Namen zaehlen mit
  all.slice(0, Math.max(0, all.length - 14)).forEach(n => { try{ fs.unlinkSync(path.join(dir, n)); }catch(e){} });
  S.backup.last = Date.now(); S.backup.lastFile = name;
  saveSettings();
  backupWaiters.splice(0).forEach(r => r(true));
  pushSettings();
  return name;
}
function backupDueCheck(){
  if (demoOn()) return;   // V1: in der Demo keine Sicherung
  if (!S.backup.on) return;
  if (!S.backup.last || Date.now() - S.backup.last > 20 * 3600 * 1000) requestBackup('taeglich');
}

/* ---------------- EVE erkennen (nur Prozessliste, keine Verbindung zu EVE) ---------------- */
function checkEve(){
  if (!IS_WIN) return;
  execFile('tasklist', ['/FI', 'IMAGENAME eq exefile.exe', '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => {
    const running = !err && /exefile\.exe/i.test(String(out));
    if (running !== eveRunning){
      eveRunning = running;
      if (running && S.eveAutoShow){ if (S.startMain !== false || (win && win.isVisible())) showWin(false); showSats(); }   // BB26: Hauptfenster bleibt zu, wenn es beim Start zu sein soll
      if (!running && S.eveAutoHide) hideSats();
      if (running) eveSaveDaily();
      pushSettings();
    }
  });
}
function isEveRunningNow(){
  if (!IS_WIN) return Promise.resolve(false);
  return new Promise(res => execFile('tasklist', ['/FI', 'IMAGENAME eq exefile.exe', '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => res(!err && /exefile\.exe/i.test(String(out)))));
}

/* ---------------- Start-Menue-Verknuepfung (noetig fuer Windows-Meldungen) ---------------- */
function ensureShortcut(){
  if (!IS_WIN || TEST) return;
  try{
    const dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'), lnk = path.join(dir, 'EVE Omni.lnk');
    // BB0: alte EVECore-Verknuepfung + alten Autostart-Eintrag (hiess nach der alten Kennung) einmal wegraeumen
    const oldLnk = path.join(dir, 'EVECore.lnk');
    if (fs.existsSync(oldLnk)){ try{ fs.unlinkSync(oldLnk); }catch(e){} try{ app.setLoginItemSettings({ openAtLogin: false, name: OLD_APP_ID }); }catch(e){} }
    const want = { target: process.execPath, appUserModelId: APP_ID, description: 'EVE Omni', icon: process.execPath, iconIndex: 0 };
    let cur = null;
    try{ cur = shell.readShortcutLink(lnk); }catch(e){}
    const ICO = 4;   // CC5 + EE4 (H3) + FF2 (B nur Taskleiste/exe/Infobereich): neues Symbol -> Verknuepfung einmal neu schreiben und den Symbol-Speicher von Windows auffrischen (Startmenue, Windows-Meldungen)
    if (!cur || cur.target !== want.target || S.lnkIco !== ICO){
      shell.writeShortcutLink(lnk, cur ? 'replace' : 'create', want);
      if (S.lnkIco !== ICO){ S.lnkIco = ICO; saveSettings(); try{ execFile('ie4uinit.exe', ['-show'], { windowsHide: true }, () => {}); }catch(e){} }
    }
  }catch(e){}
}
function applyAutostart(){
  if (!IS_WIN || TEST) return;
  try{ app.setLoginItemSettings({ openAtLogin: !!S.autostart, path: process.execPath, args: ['--hidden'] }); }catch(e){}
}

/* ---------------- IPC ---------------- */
ipcMain.on('evecore:initial', ev => { ev.returnValue = { settings: publicSettings(), version: app.getVersion() }; });
ipcMain.handle('evecore:getSettings', () => publicSettings());
ipcMain.handle('evecore:setSettings', (ev, patch) => {
  patch = patch || {};
  if (patch.windows) neoTraceAdd('setSettings windows ' + JSON.stringify(patch.windows).slice(0, 160));
  const allowed = ['lang', 'eveSaveAuto', 'alwaysOnTop', 'alwaysOnTopFull', 'transparent', 'opacity', 'opacityFull', 'clickThrough', 'hotkeys', 'autostart', 'startMain', 'eveAutoShow', 'eveAutoHide', 'closeToTray', 'taskbar', 'htmlPath', 'backup', 'windows', 'snap', 'snapEdge', 'snapGap', 'snapMatch', 'localWatch', 'overlayOnlyEve', 'cycle', 'preview', 'deck', 'icColor'];
  const before = { transparent: S.transparent, htmlPath: S.htmlPath, lang: S.lang };
  Object.keys(patch).forEach(k => {
    if (allowed.indexOf(k) < 0) return;
    if (k === 'hotkeys' || k === 'backup' || k === 'windows' || k === 'cycle' || k === 'preview' || k === 'deck') S[k] = merge(S[k] || {}, patch[k] || {});
    else S[k] = patch[k];
  });
  if (S.backup) { delete S.backup.dirEffective; }
  if ('icColor' in patch){ S.icColor = /^#[0-9a-f]{6}$/i.test(String(S.icColor)) ? S.icColor : ''; browserPush(); }   // MM3: Ordner-Farbe im Browser
  if ('opacity' in patch) S.opacity = Math.max(0.3, Math.min(1, Number(S.opacity) || 1));
  if ('opacityFull' in patch) S.opacityFull = Math.max(0.3, Math.min(1, Number(S.opacityFull) || 1));
  if (patch.hotkeys) registerHotkeys();
  if (patch.cycle){ S.cycle = cycleCfg(); cycleSend(); pvSync(); }   // LL6: Haken in den Vorschauen nachziehen
  if (patch.preview && 'width' in patch.preview) Object.keys(S.preview.pos || {}).forEach(k => { if (k.indexOf('#gross') < 0) delete S.preview.pos[k].w; });   // neue Groesse gilt fuer alle (nicht fuer „groß“)
  if (patch.preview) pvSync();
  if (patch.deck){ if (patch.deck.newKey){ delete S.deck.newKey; S.deck.key = ''; } S.deck.port = Math.max(1024, Math.min(65535, Number(S.deck.port) || 51780)); deckStart(); }   // SD
  if ('autostart' in patch) applyAutostart();
  if ('lang' in patch) trayKey = '';   // 4.0.73: Tray-Menü in der neuen Sprache
  if ('lang' in patch && before.lang && S.lang !== before.lang){ if (satSpare && !satSpare.isDestroyed()) satSpare.destroy(); setTimeout(recreateSats, 300); }   // Overlays in der neuen Sprache (storage-Ereignis kommt unter file:// nicht an)
  applyWindowState();
  saveSettings();
  updateTray();
  if (patch.windows) syncSats(undefined, true);
  if (S.transparent !== before.transparent) setTimeout(() => { recreateWindow(); recreateSats(); }, 150);
  else if (S.htmlPath !== before.htmlPath) setTimeout(() => { if (win) win.loadFile(effectiveHtml()); recreateSats(); }, 150);
  pushSettings();
  return publicSettings();
});

/* ---------------- SD: Stream-Tasten (MiraBox Stream Dock / Elgato Stream Deck) ----------------
   Kleiner Anschluss nur auf 127.0.0.1: GET /events?k=<Schlüssel> = Zustand als Event-Stream, POST /cmd?k=<Schlüssel> = Befehl.
   Der Befehl geht wie ein Klick aus einem Overlay-Fenster an die Seite (satAction, view "deck"). Nichts geht ins Internet. */
const http = require('http');
let deckSrv = null, deckState = '{}', deckClients = [];
function deckCfg(){ S.deck = Object.assign({ on: false, port: 51780, key: '' }, S.deck || {}); if (!S.deck.key){ S.deck.key = require('crypto').randomBytes(12).toString('hex'); saveSettings(); } return S.deck; }
function deckStop(){ deckClients.forEach(r => { try{ r.end(); }catch(e){} }); deckClients = []; if (deckSrv){ try{ deckSrv.close(); }catch(e){} deckSrv = null; } }
function deckStart(){
  deckStop(); const c = deckCfg(); S.deckErr = '';
  if (!c.on) return;
  deckSrv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1'), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (req.method === 'OPTIONS'){ res.writeHead(204, cors); return res.end(); }
    if (u.searchParams.get('k') !== deckCfg().key){ res.writeHead(403, cors); return res.end('Schlüssel falsch'); }
    if (req.method === 'GET' && u.pathname === '/events'){
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }, cors));
      res.write('data: ' + deckFull() + '\n\n'); deckClients.push(res); pushSettingsSoon();
      const ka = setInterval(() => { try{ res.write(': \n\n'); }catch(e){} }, 20000);
      req.on('close', () => { clearInterval(ka); deckClients = deckClients.filter(r => r !== res); pushSettingsSoon(); });
      return;
    }
    if (req.method === 'POST' && u.pathname === '/cmd'){
      let body = ''; req.on('data', d => { body += d; if (body.length > 8192) req.destroy(); });
      req.on('end', () => {
        let a = null; try{ a = JSON.parse(body); }catch(e){}
        if (!a || typeof a.type !== 'string'){ res.writeHead(400, cors); return res.end(); }
        if (a.type === 'showMain') toggleMainFromDeck();
        else if (a.type === 'toggleAll') toggleShow();
        else if (a.type === 'front'){ const w = sats[String(a.arg || '')]; if (w && !w.isDestroyed()){ w.showInactive(); w.moveTop(); } }   // SD-D: Knopf 3 drücken
        else if (a.type === 'clickThrough'){ S.clickThrough = !S.clickThrough; applyWindowState(); saveSettings(); pushSettings(); }
        else send({ type: 'satAction', view: 'deck', action: a });
        res.writeHead(204, cors); res.end();
      });
      return;
    }
    if (u.pathname === '/ping'){ res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); return res.end(JSON.stringify({ ok: true, app: 'EVE Omni', version: app.getVersion() })); }
    res.writeHead(404, cors); res.end();
  });
  deckSrv.on('error', e => { S.deckErr = e.code === 'EADDRINUSE' ? 'Port ' + c.port + ' ist belegt – anderen Port wählen' : e.message; deckSrv = null; pushSettings(); });
  deckSrv.listen(c.port, '127.0.0.1');
}
function toggleMainFromDeck(){ if (win && win.isVisible() && !win.isMinimized()) hideMain(); else showWin(true); }
// SD: Plugin in die Tasten-Software kopieren; Port + Schlüssel werden ins Plugin geschrieben (kein Abtippen)
function copyDir(src, dst){ fs.mkdirSync(dst, { recursive: true }); fs.readdirSync(src, { withFileTypes: true }).forEach(e => { const s = path.join(src, e.name), d = path.join(dst, e.name); if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d); }); }
ipcMain.handle('evecore:deckInstall', (ev, kind) => {
  const c = deckCfg(), id = 'de.eveomni.tasten.sdPlugin', src = path.join(__dirname, 'deck', id);
  const base = kind === 'elgato' ? path.join(app.getPath('appData'), 'Elgato', 'StreamDeck') : path.join(app.getPath('appData'), 'HotSpot', 'StreamDock');
  if (!fs.existsSync(base)) return (kind === 'elgato' ? 'Stream-Deck-Software' : 'Stream-Dock-Software (MiraBox)') + ' nicht gefunden – Ordner fehlt: ' + base;
  const dst = path.join(base, 'plugins', id);
  copyDir(src, dst);
  if (kind === 'elgato') fs.copyFileSync(path.join(src, 'manifest-elgato.json'), path.join(dst, 'manifest.json'));   // SD-F: gleicher Kern, Elgato-Manifest (Encoder)
  fs.writeFileSync(path.join(dst, 'plugin', 'config.js'), '// von EVE Omni geschrieben'+'\n' + 'window.EVEOMNI = ' + JSON.stringify({ port: c.port, key: c.key }) + ';'+'\n');
  if (!c.on){ S.deck.on = true; saveSettings(); deckStart(); pushSettings(); }
  return 'Installiert nach ' + dst + ' – jetzt die ' + (kind === 'elgato' ? 'Stream-Deck' : 'Stream-Dock') + '-Software einmal beenden und neu starten, dann liegen die Tasten unter „EVE Omni“.';
});
// 4.0.21: Symbole (~190 KB) nur einmal je Plugin bzw. bei neuer Symbolfarbe – vorher gingen sie jede Sekunde mit (traege)
let deckIc = '';
function deckFull(){ return deckIc ? deckState.replace(/^\{/, '{"ic":' + deckIc + (deckState.length > 2 ? ',' : '')) : deckState; }
ipcMain.on('evecore:deckState', (ev, st) => {
  st = Object.assign({}, st || {});
  let full = false;
  if (st.ic){ const ic = JSON.stringify(st.ic); if (ic !== deckIc){ deckIc = ic; full = true; } delete st.ic; }
  const j = JSON.stringify(st); if (j === deckState && !full) return; deckState = j;
  const out = full ? deckFull() : j;
  deckClients.forEach(r => { try{ r.write('data: ' + out + '\n\n'); }catch(e){} });
});

ipcMain.on('evecore:ready', ev => {
  const sid = satIdOf(ev.sender);
  if (sid){ ev.sender.send('evecore:cmd', { type: 'settings', settings: publicSettings() }); send({ type: 'publishSatellites', view: sid }); return; }
  pushSettings();
});
ipcMain.on('evecore:publishView', (ev, id, data) => { const w = sats[id]; if (w && !w.isDestroyed()) w.webContents.send('evecore:cmd', { type: 'view', data }); });
// U2: Kopieren aus Overlay-Fenstern (nicht fokussierbar -> navigator.clipboard schlaegt fehl)
ipcMain.handle('evecore:copyText', (ev, t) => { clipboard.writeText(String(t || '')); return true; });
const neoTrace = [];   // Diagnose 07.10.: was das Programm nach einem Klick tut (geht mit nach neocom-log.txt)
function neoTraceAdd(s){ const d = new Date(); neoTrace.push(d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0') + ' ' + s); if (neoTrace.length > 40) neoTrace.shift(); }
ipcMain.on('evecore:satAction', (ev, action) => {
  const sid = satIdOf(ev.sender); if (!sid) return;
  if (action && sid === 'neocom') neoTraceAdd('satAction ' + action.type + ' ' + (action.target || '') + (action.big ? ' gross' : '') + ' → Hauptfenster ' + (win && !win.isDestroyed() ? (win.webContents.isCrashed() ? 'abgestürzt' : 'da') : 'fehlt'));
  if (action && (action.type === 'openMain' || action.type === 'openSettings' || (action.type === 'jb' && /^st:/.test(action.cmd || '')))) showWin(true);   // BB1: Streaming-Player spielt in der grossen Ansicht
  send({ type: 'satAction', view: sid, action });
});
ipcMain.on('evecore:closeSelf', ev => { const sid = satIdOf(ev.sender); if (sid) closeSat(sid); });
// T8: Neocom hat keine Leiste mit Zahnrad – Rechtsklick auf freie Flaeche = Mini-Menue (wie Zahnrad der anderen Overlays)
function satMenu(id){
  const w = sats[id]; if (!w || w.isDestroyed()) return;
  const cfg = S.windows[id] || {}, act = a => send({ type: 'satAction', view: id, action: a });
  const setWin = p => { const o = {}; o[id] = p; S.windows = merge(S.windows || {}, o); saveSettings(); pushSettings(); };
  Menu.buildFromTemplate([
    { label: 'Position und Größe sperren', type: 'checkbox', checked: !!cfg.lock, click: () => setWin({ lock: !cfg.lock }) },
    { label: 'Hintergrund', submenu: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map(a => ({ label: Math.round(a * 100) + ' %', click: () => act({ type: 'alpha', v: a }) })) },
    // Z1: Durchklicken (alle Overlays, wie Taskleistenmenue) + Immer im Vordergrund
    { label: 'Durchklicken', type: 'checkbox', checked: !!S.clickThrough, sublabel: hk('clickThrough'), click: () => HOTKEY_ACTIONS.clickThrough() },
    { label: 'Immer im Vordergrund', type: 'checkbox', checked: satTop(id), click: () => { setWin({ top: !satTop(id) }); applySatState(w); } },   // 09.10.: nur dieses Fenster
    { label: 'Einrasten', type: 'checkbox', checked: S.snap !== false, click: () => { S.snap = S.snap === false; saveSettings(); pushSettings(); updateTray(); } },   // II1
    { label: 'Schließen', submenu: [[0, 'nie (immer offen)'], [10, '10 s nach der Maus'], [30, '30 s nach der Maus'], [60, '1 Min nach der Maus'], [120, '2 Min nach der Maus'], [300, '5 Min nach der Maus']]
      .map(x => ({ label: x[1], type: 'radio', checked: (Number(cfg.autoClose) || 0) === x[0], click: () => setWin({ autoClose: x[0] }) })) },
    { type: 'separator' },
    ...(id === 'neocom' ? [{ label: 'Neocom-Einstellungen …', click: () => { showWin(true); act({ type: 'openSettings', pane: 'neocom' }); } }] : []),   // BB12
    { label: 'Alle Einstellungen …', click: () => { showWin(true); act({ type: 'openSettings' }); } }
  ]).popup({ window: w, callback: () => { satMenuOpen = false; } });
  satMenuOpen = true;
}
let satMenuOpen = false;
ipcMain.on('evecore:satMenu', ev => { const sid = satIdOf(ev.sender); if (sid) satMenu(sid); });
ipcMain.on('evecore:satMini', (ev, h) => { const sid = satIdOf(ev.sender); if (sid) satMiniToggle(sid, Number(h)); });
// BB12: Jukebox-Mini meldet ihre Inhaltshoehe (CSS-Pixel) -> Fensterhoehe inkl. Zoom (Strg+Mausrad)
ipcMain.on('evecore:satFitH', (ev, h) => {
  const w = sats.musik, st = S.windows.musik; if (!w || w.isDestroyed() || w.webContents !== ev.sender || !st || !st.mini) return;
  const nh = Math.max(40, Math.min(240, Math.round(Number(h) * ev.sender.getZoomFactor()))), b = w.getBounds();
  if (Math.abs(nh - b.height) < 2) return;
  st.miniH = nh; w.setBounds({ x: b.x, y: b.y, width: b.width, height: nh }); st.bounds = w.getBounds(); saveSettings();
  setTimeout(() => { if (!w.isDestroyed()) w.webContents.invalidate(); }, 60);   // durchsichtiges Fenster: nach dem Schrumpfen neu malen, sonst bleibt das alte Bild (doppelter Player) stehen
});
// Einzelfenster selbst ziehen (Jukebox): solange die Maustaste unten ist, folgt das Fenster dem Mauszeiger – mit Einrasten
const selfDrags = new Map();
function satDrag(w, phase){
  if (!w || w.isDestroyed()) return;
  const old = selfDrags.get(w);
  if (old){ clearInterval(old.t); selfDrags.delete(w); }
  dragEnd(w);
  if (phase !== 'start'){ if (old) snapMatch(w); return; }
  if (winLocked(w)) return;
  const b0 = w.getBounds(), c0 = screen.getCursorScreenPoint(), t0 = Date.now();
  const st = { t: setInterval(() => {
    if (w.isDestroyed() || Date.now() - t0 > 60000){ clearInterval(st.t); selfDrags.delete(w); return; }
    const c = screen.getCursorScreenPoint(), b = w.getBounds();
    const nb = { x: b0.x + c.x - c0.x, y: b0.y + c.y - c0.y, width: b.width, height: b.height };
    const s = S.snap === false ? nb : dragStep(w, nb, c);
    if (s.x !== b.x || s.y !== b.y) w.setBounds({ x: s.x, y: s.y, width: b.width, height: b.height });
  }, 15) };
  selfDrags.set(w, st);
}
ipcMain.on('evecore:satDrag', (ev, phase) => { const sid = satIdOf(ev.sender); if (sid) satDrag(sats[sid], phase); });
// Diagnose Neocom-Linksklick (07.10.): letzte Maus-Ereignisse des Neocom-Overlays + Zustand im Programm nach neocom-log.txt (Einstellungsordner)
ipcMain.on('evecore:neoLog', (ev, text) => {
  if (satIdOf(ev.sender) !== 'neocom') return;
  const w = sats.neocom, st = w && !w.isDestroyed() ? { drag: selfDrags.has(w), ignore: satCt(w), top: w.isAlwaysOnTop(), focusable: w.isFocusable(), visible: w.isVisible(), locked: winLocked(w) } : null;
  const m = win && !win.isDestroyed() ? { visible: win.isVisible(), locked: winLocked(win), drags: drags.size, selfDrags: selfDrags.size, demo: demoOn() } : null;
  const open = Object.keys(sats).filter(k => sats[k] && !sats[k].isDestroyed() && sats[k].isVisible());
  try{ fs.writeFileSync(path.join(app.getPath('userData'), 'neocom-log.txt'), 'Neocom-Fenster: ' + JSON.stringify(st) + '\nHauptfenster: ' + JSON.stringify(m) + '\nOffene Overlays: ' + open.join(', ') + '\n\n--- Programm ---\n' + neoTrace.join('\n') + '\n\n--- Neocom-Overlay ---\n' + String(text)); }catch(e){}
});
ipcMain.on('evecore:hide', () => hideMain());
ipcMain.on('evecore:minimize', () => { if (win) win.minimize(); });
ipcMain.on('evecore:toggleMaximize', () => { if (!win) return; if (win.isMaximized()) win.unmaximize(); else win.maximize(); });
ipcMain.on('evecore:close', () => { if (win) win.close(); });
ipcMain.on('evecore:resizeTo', (ev, w, h, auto) => {
  const sid = satIdOf(ev.sender);
  if (!auto && winLocked(BrowserWindow.fromWebContents(ev.sender))) return;   // T6: Griff unten rechts bei gesperrtem Fenster wirkungslos
  if (sid){ const sw = sats[sid], sb = sw.getBounds(); sw.setBounds(snapSize(sw, { x: sb.x, y: sb.y, width: Math.max(SAT_MIN(sid)[0], Math.round(w)), height: Math.max(SAT_MIN(sid)[1], Math.round(h)) })); return; }
  if (!win) return;
  const b = win.getBounds();
  win.setBounds(snapSize(win, { x: b.x, y: b.y, width: Math.max(MIN[0], Math.round(w)), height: Math.max(MIN[1], Math.round(h)) }));
});
ipcMain.on('evecore:resizeEnd', ev => {
  const sid = satIdOf(ev.sender);
  if (sid){ S.windows[sid] = Object.assign({}, S.windows[sid], { bounds: sats[sid].getBounds() }); saveSettings(); return; }
  if (win){ S.bounds.full = win.getBounds(); saveSettings(); }
});
ipcMain.on('evecore:resetBounds', () => resetBounds());
ipcMain.on('evecore:attention', () => { if (win && !win.isFocused()) win.flashFrame(true); });
ipcMain.on('evecore:notify', (ev, title, body) => {
  try{
    if (Notification.isSupported()){ new Notification({ title: String(title), body: String(body), icon: iconPath(), silent: true }).show(); return; }
  }catch(e){}
  try{ if (tray && tray.displayBalloon) tray.displayBalloon({ title: String(title), content: String(body), iconType: 'info' }); }catch(e){}
});
/* JB5: Jukebox-Titel kurz über EVE einblenden – kleines Fenster oben mittig auf dem Bildschirm unter der Maus, nicht klickbar, 3,5 s */
let jbToastWin = null, jbToastT = null;
ipcMain.on('evecore:jbToast', (ev, t) => {
  try{
    t = t || {}; const esc = x => String(x || '').slice(0, 200).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
    let cover = '';
    try{ if (/^file:/.test(t.cover || '')){ const fp = require('url').fileURLToPath(t.cover); if (fs.statSync(fp).size < 2e6) cover = 'data:image/' + (/\.png$/i.test(fp) ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(fp).toString('base64'); } }catch(e){}
    const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea, W = 380, H = 66;
    if (!jbToastWin || jbToastWin.isDestroyed()){
      jbToastWin = new BrowserWindow({ width: W, height: H, frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, show: false,
        type: 'toolbar', alwaysOnTop: true, hasShadow: false, webPreferences: { contextIsolation: true, sandbox: true, javascript: false } });
      jbToastWin.setIgnoreMouseEvents(true);
    }
    jbToastWin.setBounds({ x: wa.x + Math.round((wa.width - W) / 2), y: wa.y + 36, width: W, height: H });
    const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;font:13px Segoe UI,sans-serif;color:#dff4fb;overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;height:' + (H - 2) + 'px;box-sizing:border-box;padding:6px 12px;background:rgba(8,14,20,.88);border:1px solid #4cb2d4;border-radius:4px">' +
      (cover ? '<img src="' + cover + '" style="width:48px;height:48px;object-fit:cover;border-radius:3px;border:1px solid #4cb2d4">' : '<div style="font-size:26px;color:#4cb2d4">&#9835;</div>') +
      '<div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.title) + '</div>' +
      '<div style="font-size:11px;color:#8fb3c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.sub) + '</div></div></div>';
    jbToastWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).then(() => {
      if (!jbToastWin || jbToastWin.isDestroyed()) return;
      jbToastWin.showInactive(); zSet(jbToastWin, true);
      clearTimeout(jbToastT); jbToastT = setTimeout(() => { if (jbToastWin && !jbToastWin.isDestroyed()) jbToastWin.hide(); }, 3500);
    }, () => {});
  }catch(e){}
});
/* Jukebox: Musikdateien aus dem gewaehlten Ordner (nur dieser Ordner und Unterordner, hoechstens 3 Ebenen / 2000 Dateien) */
const MUSIC_EXT = /\.(mp3|ogg|oga|flac|wav|m4a|aac|opus|webm)$/i;
function listMusic(dir){
  const files = [];
  function walk(d, depth){
    if (depth > 3 || files.length >= 2000) return;
    let list = [];
    try{ list = fs.readdirSync(d, { withFileTypes: true }); }catch(e){ return; }
    // BB1: Cover = Bild mit gleichem Namen daneben (Titel.jpg/.png)
    const img = {};
    list.forEach(ent => { const m = ent.name.match(/^(.*)\.(jpe?g|png|webp)$/i); if (m) img[m[1].toLowerCase()] = ent.name; });
    list.forEach(ent => {
      if (files.length >= 2000) return;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p, depth + 1);
      else if (MUSIC_EXT.test(ent.name)){
        const c = img[ent.name.replace(MUSIC_EXT, '').toLowerCase()], f = { name: path.relative(dir, p).replace(/\\/g, '/'), url: pathToFileURL(p).href };
        if (c) f.cover = pathToFileURL(path.join(d, c)).href;
        files.push(f);
      }
    });
  }
  if (dir) walk(dir, 0);
  return files;
}
// T24: mehrere Ordner; bei mehr als einem steht der Ordnername vor dem Dateinamen
function musicDirs(){
  if (S.musicDir){ S.musicDirs = (S.musicDirs || []).concat(S.musicDirs.indexOf(S.musicDir) < 0 ? [S.musicDir] : []); S.musicDir = ''; saveSettings(); }
  return S.musicDirs || [];
}
// Y3: EVECore Soundtrack liegt im Programm (resources/app/soundtrack). Reihenfolge + Titel aus soundtrack.json;
// dort fehlende MP3s im Ordner kommen hinten dran, fehlende Dateien fallen weg -> Titel tauschen = Datei + json anpassen.
function soundtrack(){
  const dir = path.join(__dirname, 'soundtrack');
  let j = {};
  try{ j = JSON.parse(fs.readFileSync(path.join(dir, 'soundtrack.json'), 'utf8')); }catch(e){}
  const have = listMusic(dir), by = {}, tracks = [];
  have.forEach(f => { by[f.name] = f; });
  (j.tracks || []).forEach(t => { const f = by[t.file]; if (f){ delete by[t.file]; tracks.push({ title: t.title || f.name, url: f.url, sec: t.seconds || 0, cover: f.cover }); } });
  Object.keys(by).forEach(n => tracks.push({ title: n.replace(/\.[a-z0-9]+$/i, '').replace(/^.*? - /, ''), url: by[n].url, sec: 0, cover: by[n].cover }));
  return tracks.length ? { album: j.album || 'EVE Omni Soundtrack', artist: j.artist || '', tracks } : null;
}
function musicAll(){
  const dirs = musicDirs(), files = [];
  dirs.forEach(d => listMusic(d).forEach(f => files.push(dirs.length > 1 ? Object.assign(f, { name: path.basename(d) + '/' + f.name }) : f)));
  return { dir: dirs[0] || '', dirs, files, ost: soundtrack() };
}
ipcMain.handle('evecore:pickMusicDir', async ev => {
  const dirs = musicDirs();
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(ev.sender) || win, { title: 'Musikordner hinzufügen', defaultPath: dirs[dirs.length - 1] || app.getPath('music'), properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  if (dirs.indexOf(r.filePaths[0]) < 0){ S.musicDirs = dirs.concat([r.filePaths[0]]); saveSettings(); }
  return musicAll();
});
ipcMain.handle('evecore:removeMusicDir', (ev, d) => { S.musicDirs = musicDirs().filter(x => x !== d); saveSettings(); return musicAll(); });
ipcMain.handle('evecore:listMusic', () => musicAll());
ipcMain.handle('evecore:readClipboard', () => readClip());
// LL1: geteilte Kurzlinks (Deezer „Teilen“, Spotify-App) zur echten Adresse auflösen – nur diese Hosts, damit hier keine beliebigen Adressen abgerufen werden
ipcMain.handle('evecore:resolveLink', async (ev, u) => {
  let x; try{ x = new URL(String(u || '')); }catch(e){ return ''; }
  if (x.protocol !== 'https:' || !/^(link\.deezer\.com|deezer\.page\.link|dzr\.page\.link|spotify\.link|spoti\.fi)$/i.test(x.hostname)) return '';
  try{
    const r = await fetch(x.href, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const ok = /https:\/\/(?:www\.)?(?:deezer\.com|open\.spotify\.com)\/(?:[a-z-]+\/)?(?:album|playlist|track)\/[A-Za-z0-9]+/;
    let m = ok.exec(r.url);
    if (!m) m = ok.exec((await r.text()).replace(/\\\//g, '/'));   // Seite mit Weiterleitung per Skript
    return m ? m[0] : '';
  }catch(e){ return ''; }
});
// T20: Leistungs-Overlay – CPU seit dem letzten Aufruf, RAM, Ping = TCP-Verbindungsaufbau zum EVE-Server (Tranquility)
let cpuPrev = null;
function cpuPct(){
  const c = require('os').cpus().reduce((a, x) => { const t = x.times; a.idle += t.idle; a.all += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, all: 0 });
  const p = cpuPrev; cpuPrev = c;
  return p && c.all > p.all ? Math.round(100 * (1 - (c.idle - p.idle) / (c.all - p.all))) : null;
}
function tqPing(){
  return new Promise(res => {
    const t0 = Date.now(), s = require('net').connect({ host: 'tranquility.servers.eveonline.com', port: 26000 });
    const done = v => { s.destroy(); res(v); };
    s.setTimeout(3000, () => done(null)); s.once('connect', () => done(Date.now() - t0)); s.once('error', () => done(null));
  });
}
// Y1: GPU-Last, VRAM, Temperatur per nvidia-smi (fehlt es = keine NVIDIA, nicht mehr fragen)
let gpuNo = false;
function gpuInfo(){
  if (gpuNo) return Promise.resolve(null);
  return new Promise(res => execFile('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 3000 }, (err, out) => {
    if (err && err.code === 'ENOENT') gpuNo = true;
    const v = String(out || '').split(/\r?\n/)[0].split(',').map(Number);
    res(!err && v.length === 4 && v.every(isFinite) ? { gpu: v[0], vramUsed: v[1], vramTot: v[2], gpuTemp: v[3] } : null);
  }));
}
// Y1: CPU-Temperatur – LibreHardwareMonitor (wenn es läuft), sonst Windows-Thermalzone; PowerShell ist teuer, daher nur alle 30 s (5 min, wenn nichts kam)
let cpuT = { v: null, t: 0, busy: false };
function cpuTemp(){
  if (!cpuT.busy && Date.now() - cpuT.t > (cpuT.v == null && cpuT.t ? 300000 : 30000)){
    cpuT.busy = true;
    const ps = "$t = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -EA 0 | ? { $_.SensorType -eq 'Temperature' -and $_.Name -match 'CPU Package|Tctl|Tdie' } | select -First 1 -Expand Value; " +
      "if (-not $t) { $z = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation -EA 0 | select -First 1; if ($z) { $t = $z.HighPrecisionTemperature / 10 - 273.15 } }; $t";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 15000 }, (err, out) => {
      const v = parseFloat(String(out || '').replace(',', '.'));
      cpuT = { v: !err && v > 0 && v < 150 ? Math.round(v) : null, t: Date.now(), busy: false };
    });
  }
  return cpuT.v;
}
ipcMain.handle('evecore:perf', async () => { const os = require('os'); const [ping, g] = await Promise.all([tqPing(), gpuInfo()]); return Object.assign({ cpu: cpuPct(), ram: Math.round(100 * (1 - os.freemem() / os.totalmem())), ping, cpuTemp: cpuTemp() }, g || {}); });
ipcMain.on('evecore:showView', (ev, id) => showView(String(id)));
ipcMain.on('evecore:openBrowser', (ev, url) => openBrowser(url));
ipcMain.on('evecore:launchEve', () => launchEve());   // DD5
ipcMain.on('evecore:quitEve', () => quitEve());   // FF5
// L5: Neocom-Knopf – offen und sichtbar -> schliessen, sonst oeffnen
ipcMain.on('evecore:toggleBrowser', () => { if (bwin && !bwin.isDestroyed() && bwin.isVisible() && !bwin.isMinimized()) bwin.close(); else openBrowser(); });
ipcMain.on('browser:cmd', (ev, type, arg) => { if (bwin && !bwin.isDestroyed() && ev.sender === bwin.webContents) browserCmd(String(type), String(arg || '')); });
ipcMain.on('evecore:showMain', () => showWin(true));
// EVE-Login im Standard-Browser (nur die EVE-Anmeldeseite)
ipcMain.on('evecore:openExternal', (ev, url) => { url = String(url || ''); if (/^https:\/\/login\.eveonline\.com\//.test(url)) shell.openExternal(url); });
ipcMain.on('evecore:quit', () => { quitting = true; app.quit(); });
ipcMain.on('evecore:killfeed', (ev, on) => { if (!TEST) kfSet(on); else kf.on = !!on; });
ipcMain.handle('evecore:intelList', () => intelList());   // HZ23
ipcMain.handle('evecore:intelSet', (ev, o) => intelSet(o));
ipcMain.handle('evecore:activateClient', (ev, hwnd) => activateClient(hwnd));
ipcMain.handle('evecore:frontClient', () => (fg.clients.find(c => c.hwnd === fg.lastEve) || {}).name || '');
ipcMain.handle('evecore:mainState', () => ({ visible: !!(win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()), mode: S.mode }));
ipcMain.handle('evecore:writeBackup', (ev, json, reason) => writeBackup(json, reason));
ipcMain.handle('evecore:backupNow', async () => { await requestBackup('manuell'); return publicSettings(); });
ipcMain.handle('evecore:pickBackupDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Ordner für Sicherungen', defaultPath: backupDir(), properties: ['openDirectory', 'createDirectory'] });
  if (!r.canceled && r.filePaths[0]){ S.backup.dir = r.filePaths[0]; saveSettings(); }
  return publicSettings();
});
ipcMain.on('evecore:openBackupDir', () => { fs.mkdirSync(backupDir(), { recursive: true }); shell.openPath(backupDir()); });
ipcMain.handle('evecore:pickHtml', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'EVE-Omni.html wählen', defaultPath: S.htmlPath || app.getPath('documents'), filters: [{ name: 'EVE Omni', extensions: ['html', 'htm'] }], properties: ['openFile'] });
  if (!r.canceled && r.filePaths[0]){ S.htmlPath = r.filePaths[0]; saveSettings(true); setTimeout(() => win && win.loadFile(effectiveHtml()), 150); }
  return publicSettings();
});
function eveSetBase(){ return process.env.EVECORE_EVE_SETTINGS || path.join(process.env.LOCALAPPDATA || '', 'CCP', 'EVE', 'g_eve_online_tq_tranquility'); }
ipcMain.handle('evecore:sync', async (ev, opts) => sync.run(opts || {}, { base: eveSetBase(), eveRunning: isEveRunningNow }));
/* EVE-Einstellungen sichern: automatisch beim ersten EVE-Start des Tages (abschaltbar), „Jetzt sichern“, Profile, Wiederherstellen (nur bei geschlossenem EVE) */
function eveSaveDir(){ return path.join(backupDir(), 'EVE-Einstellungen'); }
function eveSaveDaily(){
  if (demoOn() || S.eveSaveAuto === false) return;
  const day = new Date().toDateString(); if (S.eveSaveDay === day) return;
  try{ evesave.save(eveSetBase(), eveSaveDir(), 'auto'); S.eveSaveDay = day; saveSettings(); }catch(e){}
}
ipcMain.handle('evecore:eveSave', async (ev, o) => {
  o = o || {};
  const base = eveSetBase(), dest = eveSaveDir();
  try{
    if (o.op === 'save') return Object.assign(evesave.list(base, dest), { done: evesave.save(base, dest, 'auto') });
    if (o.op === 'profil') return Object.assign(evesave.list(base, dest), { done: evesave.save(base, dest, 'profil', o.name) });
    if (o.op === 'remove'){ evesave.remove(dest, String(o.name)); return evesave.list(base, dest); }
    if (o.op === 'restore'){
      if (await isEveRunningNow()) return Object.assign(evesave.list(base, dest), { error: 'EVE läuft noch – erst alle EVE-Clients schließen.' });
      return Object.assign(evesave.list(base, dest), { done: evesave.restore(base, dest, String(o.name), o.chars || null) });
    }
    if (o.op === 'open'){ fs.mkdirSync(dest, { recursive: true }); shell.openPath(dest); }
    return evesave.list(base, dest);
  }catch(e){ return Object.assign(evesave.list(base, dest), { error: e.message }); }
});

/* ---------------- Start ---------------- */
if (!TEST && !app.requestSingleInstanceLock()){
  app.quit();
} else {
  app.on('second-instance', () => showWin());
  app.whenReady().then(() => {
    if (oldRunning){ dialog.showMessageBoxSync({ type: 'info', title: 'EVE Omni', message: 'EVECore läuft noch.', detail: 'EVECore heißt jetzt EVE Omni und übernimmt beim ersten Start alle Daten. Bitte EVECore zuerst beenden (Symbol unten rechts › Beenden) und EVE Omni dann neu starten.' }); app.quit(); return; }
    loadSettings();
    if (!S.backup.dir && !TEST) try{ umzug.moveBackups(path.join(app.getPath('documents'), 'EVECore-Sicherungen'), backupDir()); }catch(e){}   // BB0
    capSetup();
    const hidden = process.argv.indexOf('--hidden') >= 0;
    createWindow(!hidden && S.startMain !== false);   // BB26
    createTray();
    setTimeout(() => syncSats(!hidden), 800);
    registerHotkeys();
    startClipWatch();
    startFgWatch();
    deckStart();   // SD
    ensureShortcut();
    applyAutostart();
    if (!S.shortcutDone){ S.shortcutDone = true; saveSettings(); }
    checkEve();
    setInterval(checkEve, 10000);
    setTimeout(backupDueCheck, TEST ? 3000 : 60000);
    setInterval(backupDueCheck, 3600 * 1000);
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); saveSettings(true); try{ const p = fg.proc; fg.proc = null; if (p) p.kill(); }catch(e){} });
  app.on('before-quit', () => { Object.keys(sats).forEach(id => { const w = sats[id]; if (w && !w.isDestroyed()) S.windows[id] = Object.assign({}, S.windows[id], { bounds: w.getBounds() }); }); });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (!tray || quitting) app.quit(); });
}

// fuer Tests
module.exports = { merge, DEFAULTS };
