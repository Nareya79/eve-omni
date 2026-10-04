// Bruecke zwischen EVE-Omni.html und dem Programm. Die Seite sieht nur window.evecoreHost mit diesen Funktionen.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const initial = ipcRenderer.sendSync('evecore:initial') || { settings: {} };
function markHtml(){
  const de = document.documentElement;
  if (!de) return false;
  de.classList.add('in-host');
  de.classList.toggle('host-transparent', !!initial.settings.transparent);
  de.classList.toggle('host-win', initial.settings.platform === 'win32');
  return true;
}
if (!markHtml()) document.addEventListener('DOMContentLoaded', markHtml);

let cmdCb = null;
const queue = [];
ipcRenderer.on('evecore:cmd', (ev, cmd) => { if (cmdCb) { try{ cmdCb(cmd); }catch(e){} } else queue.push(cmd); });

contextBridge.exposeInMainWorld('evecoreHost', {
  isHost: true,
  version: initial.version,
  getSettings: () => ipcRenderer.invoke('evecore:getSettings'),
  setSettings: patch => ipcRenderer.invoke('evecore:setSettings', patch),
  onCommand: cb => { cmdCb = cb; queue.splice(0).forEach(c => { try{ cb(c); }catch(e){} }); },
  ready: () => ipcRenderer.send('evecore:ready'),
  hide: () => ipcRenderer.send('evecore:hide'),
  minimize: () => ipcRenderer.send('evecore:minimize'),
  toggleMaximize: () => ipcRenderer.send('evecore:toggleMaximize'),
  close: () => ipcRenderer.send('evecore:close'),
  resizeTo: (w, h, auto) => ipcRenderer.send('evecore:resizeTo', w, h, !!auto),
  resizeEnd: () => ipcRenderer.send('evecore:resizeEnd'),
  resetBounds: () => ipcRenderer.send('evecore:resetBounds'),
  attention: () => ipcRenderer.send('evecore:attention'),
  notify: (title, body) => ipcRenderer.send('evecore:notify', String(title), String(body)),
  writeBackup: (json, reason) => ipcRenderer.invoke('evecore:writeBackup', String(json), String(reason || '')),
  backupNow: () => ipcRenderer.invoke('evecore:backupNow'),
  pickBackupDir: () => ipcRenderer.invoke('evecore:pickBackupDir'),
  openBackupDir: () => ipcRenderer.send('evecore:openBackupDir'),
  pickHtml: () => ipcRenderer.invoke('evecore:pickHtml'),
  syncSettings: opts => ipcRenderer.invoke('evecore:sync', opts),
  publishView: (id, data) => ipcRenderer.send('evecore:publishView', String(id), data),
  satAction: action => ipcRenderer.send('evecore:satAction', action),
  copyText: t => ipcRenderer.invoke('evecore:copyText', String(t)),
  closeSelf: () => ipcRenderer.send('evecore:closeSelf'),
  satMini: h => ipcRenderer.send('evecore:satMini', Number(h) || 0),
  satFitH: h => ipcRenderer.send('evecore:satFitH', Number(h) || 0),
  satMenu: () => ipcRenderer.send('evecore:satMenu'),
  satDrag: phase => ipcRenderer.send('evecore:satDrag', String(phase)),
  pickMusicDir: () => ipcRenderer.invoke('evecore:pickMusicDir'),
  listMusic: () => ipcRenderer.invoke('evecore:listMusic'),
  removeMusicDir: d => ipcRenderer.invoke('evecore:removeMusicDir', d),
  readClipboard: () => ipcRenderer.invoke('evecore:readClipboard'),
  perf: () => ipcRenderer.invoke('evecore:perf'),   // T20
  showView: id => ipcRenderer.send('evecore:showView', String(id)),
  openBrowser: url => ipcRenderer.send('evecore:openBrowser', url ? String(url) : ''),
  launchEve: () => ipcRenderer.send('evecore:launchEve'),   // DD5
  quitEve: () => ipcRenderer.send('evecore:quitEve'),   // FF5
  toggleBrowser: () => ipcRenderer.send('evecore:toggleBrowser'),
  showMain: () => ipcRenderer.send('evecore:showMain'),
  mainState: () => ipcRenderer.invoke('evecore:mainState'),
  quitApp: () => ipcRenderer.send('evecore:quit'),
  killfeed: on => ipcRenderer.send('evecore:killfeed', !!on),
  openExternal: url => ipcRenderer.send('evecore:openExternal', String(url)),
  activateClient: hwnd => ipcRenderer.invoke('evecore:activateClient', String(hwnd)),
  frontClient: () => ipcRenderer.invoke('evecore:frontClient'),
  previewPick: hwnd => ipcRenderer.invoke('evecore:previewPick', String(hwnd)),
  deckState: st => ipcRenderer.send('evecore:deckState', st),
  deckInstall: kind => ipcRenderer.invoke('evecore:deckInstall', String(kind || 'mirabox'))   // SD: Zustand für die Stream-Tasten
});
