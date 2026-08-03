/* eslint global-require: 1 */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import MenuBuilder from './menu';
import { Keystore } from './main/keystore';
import { WrongPasswordError, InvalidCiphertextError } from './utils/errors';

// Resolve the renderer entry for BOTH build systems until MR-B removes webpack: electron-vite dev
// server URL, else the electron-vite prod build (out/renderer/index.html), else the legacy webpack
// app.html. `query` (e.g. the sign-window params) rides on whichever URL we pick.
const rendererURL = (query = ''): string => {
  if (process.env.ELECTRON_RENDERER_URL) return `${process.env.ELECTRON_RENDERER_URL}${query}`;
  const viteIndex = path.join(__dirname, '../renderer/index.html');
  if (fs.existsSync(viteIndex)) return `file://${viteIndex}${query}`;
  return `file://${path.join(__dirname, 'app.html')}${query}`;
};

// Same dual-build resolution for the preload script: out/preload under electron-vite, else app/.
const preloadPath = (): string => {
  const vitePreload = path.join(__dirname, '../preload/preload.js');
  return fs.existsSync(vitePreload) ? vitePreload : path.join(__dirname, 'preload.js');
};

let mainWindow: BrowserWindow | null = null;
let promptWindow: BrowserWindow | null = null;
let customURI: string | string[] | undefined;

// Phase 1 test harness (EXECUTION_STRATEGY §5): point Electron at a DISPOSABLE profile copy, never
// the real one. Must run before any app wiring reads userData.
if (process.env.VESSEL_USER_DATA) {
  app.setPath('userData', process.env.VESSEL_USER_DATA);
}

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
  require('electron-debug')();
  const p = path.join(__dirname, '..', 'app', 'node_modules');
  require('module').globalPaths.push(p);
}

const installExtensions = async () => {
  // React/Redux DevTools ship as Manifest V3 and fail to load under Electron 28, spamming the console
  // with "sandboxed_renderer.bundle.js script failed to run" / "object null is not iterable". They add
  // nothing here until Phase 5 swaps electron-devtools-installer for an Electron-28-compatible loader,
  // so the load is opt-in via LOAD_DEVTOOLS=1.
  if (!process.env.LOAD_DEVTOOLS) return;
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map((name) => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, workingDirectory) => {
    if (process.platform === 'win32' || process.platform === 'linux') {
      customURI = argv.slice(1);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      createPrompt(null, customURI);
    }
  });
}

// Content-Security-Policy: production locks the renderer to same-origin code (no remote scripts, no
// eval) — the bundle has no inline scripts and no eval, so this is safe. Dev is relaxed because the
// Vite HMR client needs inline/eval + a ws connection to the localhost dev server.
const CSP_IS_DEV = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL;
const CSP_POLICY = CSP_IS_DEV
  ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: ws: http://localhost:*"
  : [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-src 'none'",
    ].join('; ');

async function createWindow() {
  // Attach the CSP to every response (only the last onHeadersReceived listener is used, so calling
  // this again on `activate` simply replaces it).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY],
      },
    });
  });

  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
    await installExtensions();
  }

  if (process.platform === 'win32' || process.platform === 'linux') {
    customURI = process.argv.slice(1);
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 970,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath(),
    },
  });

  mainWindow.loadURL(rendererURL());

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.show();
    mainWindow.focus();
    if (customURI) {
      createPrompt(null, customURI);
    }
  });

  // Security: Disable navigation to external URLs in main window
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });

  // Security: never open new windows from renderer content (external links go via shell:openExternal).
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
    promptWindow = null;
    app.quit();
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();
}

async function createPrompt(
  event: { preventDefault: () => void } | null,
  url: string | string[] | undefined
) {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true') {
    await installExtensions();
  }
  if (event) event.preventDefault();
  if (!url) return;

  customURI = url;
  const parse = require('url-parse');

  promptWindow = new BrowserWindow({
    alwaysOnTop: true,
    show: false,
    width: 500,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath(),
    },
  });

  // Security: the sign window renders externally-supplied URI payloads — deny new windows and block
  // navigation off the local app (Phase 3 hardening; the isolation flip + preload land with D9b).
  promptWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  promptWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith('file://') && !navUrl.startsWith('http://localhost')) {
      event.preventDefault();
    }
  });

  const urlString = Array.isArray(url) ? url[0] : url;
  const parsed = parse(urlString, true);
  parsed.query.type = parsed.hostname;
  parsed.query.action = 'promptOperation';

  promptWindow.webContents.on('did-finish-load', () => {
    if (!promptWindow) {
      throw new Error('"promptWindow" is not defined');
    }
    promptWindow.show();
    promptWindow.focus();
  });

  if (parsed.host === 'sign') {
    const exp = /\/tx\/((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)/;
    const match = exp.exec(parsed.pathname);
    if (match) {
      const base64encoded = match[1];
      const metaexp = /^#((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;
      const metamatch = metaexp.exec(parsed.hash);
      let base64encodedmeta = 'e30=';
      if (metamatch) {
        base64encodedmeta = metamatch[1];
      }
      promptWindow.loadURL(
        rendererURL(`?type=sign&action=promptOperation&ops=${base64encoded}&meta=${base64encodedmeta}`)
      );
    }
  }
}

// IPC handlers for renderer process
ipcMain.handle('shell:openExternal', async (event, url: string) => {
  // Only ever hand http(s) links to the OS handler — never file:, javascript:, etc. (Phase 3 hardening).
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:' || protocol === 'http:') {
      await shell.openExternal(url);
    }
  } catch {
    // malformed URL — ignore
  }
});

// --- D9b Stage B · main-process keystore IPC (ADDITIVE — no renderer code invokes these yet) ---
let keystore: Keystore | null = null;
const getKeystore = (): Keystore => {
  // Lazy so nothing touches disk at startup; app.getPath('userData') already honors the
  // VESSEL_USER_DATA test override set at the top of this file.
  if (!keystore) keystore = new Keystore(path.join(app.getPath('userData'), 'keystore.json'));
  return keystore;
};

// Wrap every keystore handler so errors crossing to the renderer are SANITIZED: log the real cause in
// main, surface only a coarse code. A WIF/password can never leak through an error message (reviewer
// note), while the renderer can still distinguish a wrong password from other failures. Classify by
// `instanceof` (the error classes don't set `.name`, and minification would mangle constructor names).
const keystoreHandle = (
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
) => {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      const code =
        err instanceof WrongPasswordError
          ? 'WRONG_PASSWORD'
          : err instanceof InvalidCiphertextError
            ? 'INVALID_CIPHERTEXT'
            : 'KEYSTORE_ERROR';
      // Log only the derived code, never err.message (which could embed a WIF). The custom error
      // classes set no `.name` (it is always 'Error'), so the instanceof-derived code is the signal.
      // eslint-disable-next-line no-console
      console.error(`[keystore] ${channel} failed: ${code}`);
      throw new Error(code);
    }
  });
};

keystoreHandle('keystore:list', () => getKeystore().listAccounts());
keystoreHandle('keystore:hasAccount', (_e, account: string) => getKeystore().hasAccount(account));
keystoreHandle('keystore:sign', (_e, account: string, preparedTx: any, password: string) =>
  getKeystore().signTransaction(preparedTx, account, password)
);
keystoreHandle(
  'keystore:encodeMemo',
  (_e, account: string, password: string, recipientPublicKey: string, message: string) =>
    getKeystore().encodeMemo(account, password, recipientPublicKey, message)
);
keystoreHandle('keystore:decodeMemo', (_e, account: string, password: string, encoded: string) =>
  getKeystore().decodeMemo(account, password, encoded)
);
keystoreHandle(
  'keystore:importKey',
  (_e, account: string, wif: string, password: string, type: string) =>
    getKeystore().importKey(account, wif, password, type)
);
keystoreHandle('keystore:setChainConfig', (_e, chainId: string, addressPrefix?: string) =>
  Keystore.setChainConfig(chainId, addressPrefix)
);
keystoreHandle('keystore:migrateRecords', (_e, records: any[]) =>
  getKeystore().migrateRecords(Array.isArray(records) ? records : [])
);
keystoreHandle('keystore:removeAccount', (_e, account: string) =>
  getKeystore().removeAccount(account)
);
keystoreHandle('keystore:pruneAccounts', (_e, accounts: string[]) =>
  getKeystore().pruneAccounts(Array.isArray(accounts) ? accounts : [])
);

// Set as default protocol client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('hive', process.execPath, [path.resolve(process.argv[1])]);
    app.setAsDefaultProtocolClient('vessel', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('hive');
  app.setAsDefaultProtocolClient('vessel');
}

app.on('ready', createWindow);
app.on('open-url', (event, url) => createPrompt(event, url));
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  mainWindow = null;
  promptWindow = null;
});
