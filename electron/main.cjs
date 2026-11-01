// Electron main process.
//
// Responsibilities:
//  1. Start the Next.js server (the standalone bundle in production, or point
//     at `next dev` during development) on a local port.
//  2. Open a BrowserWindow pointed at that local server.
//  3. Keep the window generic — it just loads whatever routes the Next.js app
//     exposes, so new dashboard pages never require touching this file.
//  4. Check for app updates via electron-updater.
//
// Uses .cjs so this file is always CommonJS regardless of the project's
// "type": "module" setting in package.json (Next.js/React code stays ESM).

const { app, BrowserWindow, Menu, dialog, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const isPackaged = app.isPackaged;
const devServerUrl = process.env.ELECTRON_DEV_URL; // set by `npm run electron:dev`

let mainWindow = null;
let serverProcess = null;

// ── Device token storage ─────────────────────────────────────────────────
// The device token (see the provisioning plan) is encrypted with
// safeStorage — DPAPI-backed on Windows, tied to the logged-in Windows user
// account — and the encrypted blob is written to a file in the app's own
// per-user data directory (NOT inside the installed program files, so it's
// never part of the distributed bundle and survives app updates). Nothing
// here ever touches the raw token on disk.
const deviceTokenPath = () => path.join(app.getPath('userData'), 'device.token');

function readDeviceToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const filePath = deviceTokenPath();
    if (!fs.existsSync(filePath)) return null;
    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function writeDeviceToken(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level secure storage is not available on this machine.');
  }
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(deviceTokenPath(), encrypted);
}

ipcMain.handle('device-token:get', () => readDeviceToken());
ipcMain.handle('device-token:set', (_event, token) => {
  writeDeviceToken(String(token));
});

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('The local app server did not start in time.'));
          return;
        }
        setTimeout(check, 300);
      });
    })();
  });
}

// Starts the bundled Next.js standalone server and returns its local URL.
// Uses Electron's own executable, run in plain-Node mode (ELECTRON_RUN_AS_NODE),
// so no separate Node.js installation is needed on the client machine.
async function startStandaloneServer() {
  const serverEntry = isPackaged
    ? path.join(process.resourcesPath, 'standalone', 'server.js')
    : path.join(__dirname, '..', '.next', 'standalone', 'server.js');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Build output not found at ${serverEntry}.\nRun "npm run build" before launching the desktop app.`
    );
  }

  const port = await findFreePort();

  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Royal Optical Dashboard',
        'The local app server stopped unexpectedly. The app will now close.'
      );
      app.quit();
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function resolveAppUrl() {
  if (devServerUrl) {
    await waitForServer(devServerUrl);
    return devServerUrl;
  }
  return startStandaloneServer();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Keep the window scoped to our own local server / Supabase — any other
  // link (e.g. target="_blank") opens in the system browser instead of a
  // new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (target.hostname !== '127.0.0.1' && target.hostname !== 'localhost') {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  resolveAppUrl()
    .then((url) => mainWindow.loadURL(url))
    .catch((err) => {
      dialog.showErrorBox('Royal Optical Dashboard', `Failed to start the app:\n${err.message}`);
      app.quit();
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  if (isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silent — an update-check failure (e.g. offline) must never block clinic staff from working.
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on('before-quit', stopServer);
app.on('will-quit', stopServer);
process.on('exit', stopServer);
