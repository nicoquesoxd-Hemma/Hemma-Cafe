const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  startDownload: () => ipcRenderer.send('start-download'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status, info) => callback(status, info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, percent) => callback(percent))
});
