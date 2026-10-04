// Client-Vorschau Stufe 3: Bruecke fuer ein schwebendes Vorschau-Fenster (vorschau.html)
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previewHost', {
  pick: () => ipcRenderer.invoke('preview:pick'),
  activate: () => ipcRenderer.send('preview:activate'),
  drag: phase => ipcRenderer.send('preview:drag', String(phase)),
  aspect: r => ipcRenderer.send('preview:aspect', Number(r)),
  menu: () => ipcRenderer.send('preview:menu'),
  big: () => ipcRenderer.send('preview:big'),
  onInfo: cb => ipcRenderer.on('preview:info', (ev, info) => cb(info))
});
