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

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[electron] Page load failed: ${code} ${desc}`);
    // Retry after a short delay — server might still be starting
    setTimeout(() => mainWindow && mainWindow.loadURL(url), 2000);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[electron] Renderer crashed:', details.reason);
    dialog.showErrorBox('Renderer Crashed', `The dashboard renderer process crashed (${details.reason}). The app will restart.`);
    if (mainWindow) mainWindow.reload();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Application menu ────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const pkg = require('../package.json');

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => checkForUpdates(true),
        },
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
        ...(!isMac ? [{
          label: 'Check for Updates…',
          click: () => checkForUpdates(true),
        }] : []),
        {
          label: `Dashboard v${pkg.version}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Tray icon (minimize to tray) ────────────────────────────────────────
function createTray() {
  try {
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
  } catch (err) {
    console.warn('[electron] Tray creation failed:', err.message);
  }
}

// ── Auto-update ─────────────────────────────────────────────────────────
// Checks UPDATE_URL (env var or built-in) for a newer version.
// The update server should host a JSON file: { "version": "1.1.0", "url": "<download-link>" }
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

function checkForUpdates(manual = false) {
  const updateUrl = process.env.DASHBOARD_UPDATE_URL;
  if (!updateUrl) {
    if (manual) dialog.showMessageBox({ message: 'No update URL configured.\n\nSet DASHBOARD_UPDATE_URL to enable auto-updates.', type: 'info' });
    return;
  }

  const pkg = require('../package.json');
  const https = updateUrl.startsWith('https') ? require('https') : require('http');

  https.get(updateUrl, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const info = JSON.parse(body);
        if (info.version && info.version !== pkg.version && isNewer(info.version, pkg.version)) {
          const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (v${info.version}) is available. You are running v${pkg.version}.`,
            detail: info.notes || '',
            buttons: ['Download', 'Later'],
            defaultId: 0,
          });
          if (choice === 0 && info.url) {
            shell.openExternal(info.url);
          }
        } else if (manual) {
          dialog.showMessageBox(mainWindow, { message: `You are running the latest version (v${pkg.version}).`, type: 'info' });
        }
      } catch {
        if (manual) dialog.showMessageBox({ message: 'Failed to check for updates.', type: 'warning' });
      }
    });
  }).on('error', () => {
    if (manual) dialog.showMessageBox({ message: 'Could not reach update server.', type: 'warning' });
  });
}

function isNewer(remote, local) {
  const r = remote.replace(/^v/, '').split('.').map(Number);
  const l = local.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
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

    // Check for updates on startup (silent) and periodically
    checkForUpdates(false);
    setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL);
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
    try { serverInfo.server.close(); } catch {}
    serverInfo = null;
  }
});
