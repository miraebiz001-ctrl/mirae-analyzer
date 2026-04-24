const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  verifyLicense: (key) => ipcRenderer.invoke('license:verify', key),
  getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
  launchApp: () => ipcRenderer.send('license:launch')
});

contextBridge.exposeInMainWorld('appInfo', {
  version: '1.0.0',
  platform: process.platform,
  isElectron: true
});
