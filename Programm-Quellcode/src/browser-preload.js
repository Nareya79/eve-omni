// E1: Bruecke fuer die Leiste des Browser-Fensters (browser.html). Die Webseite darunter bekommt keine Bruecke.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserHost', {
  cmd: (type, arg) => ipcRenderer.send('browser:cmd', String(type), arg == null ? '' : String(arg)),
  onState: cb => ipcRenderer.on('browser:state', (ev, st) => cb(st))
});
