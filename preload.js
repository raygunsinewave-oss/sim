const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('djsimNative', {
  isElectron: true,
  platform: process.platform,
  requestMic: () => ipcRenderer.invoke('request-mic'),
  version: () => ipcRenderer.invoke('app-version'),
  onMenu: (fn) => ipcRenderer.on('menu', (_e, action) => fn(action))
});
