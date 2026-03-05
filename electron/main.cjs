const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = process.argv.includes('--dev');

app.commandLine.appendSwitch('disable-features', 'NetworkService');

function createWindow() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications' || permission === 'persistent-storage') {
      callback(true);
    } else {
      callback(false);
    }
  });

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      indexedDBEnabled: true
    },
    icon: path.join(__dirname, '../public/icono.ico')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow.removeAllListeners('close');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

// ── Auto-Update Configuration ──────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'checking');
});

autoUpdater.on('update-available', (info) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'available', info.version);
});

autoUpdater.on('update-not-available', () => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'not-available');
});

autoUpdater.on('error', (err) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'error', err?.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', () => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('update-status', 'downloaded');
});

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});
