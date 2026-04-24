const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  verifyLicense: (key) => ipcRenderer.invoke('license:verify', key),
  getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
  launchApp: () => ipcRenderer.send('license:launch')
});
