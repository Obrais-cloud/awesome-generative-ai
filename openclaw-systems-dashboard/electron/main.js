'use strict';

const { app, BrowserWindow, Menu, shell, dialog, Tray, nativeImage } = require('electron');
const path = require('path');
const { startServer } = require('../server/index');

let mainWindow = null;
let tray = null;
let serverInfo = null;

// ── Single instance lock ─────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Create main window ──────────────────────────────────────────────────
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: 'OpenClaw Dashboard',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // show when ready to prevent flicker
  });

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Application menu ────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'View',
      submenu: [
        {
          label: 'Refresh Dashboard',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.webContents.reload(),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'OpenClaw Documentation',
          click: () => shell.openExternal('https://openclaw.dev/docs'),
        },
        { type: 'separator' },
        {
          label: `Dashboard v${require('../package.json').version}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Tray icon (minimize to tray) ────────────────────────────────────────
function createTray() {
  // Use a simple 16x16 data URL for the tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQklEQVQ4y2NgGAWjIYCRkIK/f/8yMDIyMuDj' +
    'A0lgNTQ1NTFgk8NqwP///xmwGUJMAKsBxBiC1YD/BAwhasDgDwMAGmQLEblSMIYAAAAASUVORK5CYII='
  );

  tray = new Tray(icon);
  tray.setToolTip('OpenClaw Dashboard');
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// ── App lifecycle ───────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    serverInfo = await startServer();
    buildMenu();
    createWindow(serverInfo.url);

    if (process.platform !== 'linux') {
      createTray();
    }
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to start dashboard server:\n${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && serverInfo) {
    createWindow(serverInfo.url);
  }
});

app.on('before-quit', () => {
  if (serverInfo && serverInfo.server) {
    serverInfo.server.close();
  }
});
