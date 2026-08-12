/* eslint global-require: 1 */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import MenuBuilder from './menu';
import { Keystore } from './main/keystore';
import { parseSignRequest } from './main/signUri';
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
  // Opt-in via LOAD_DEVTOOLS=1. Phase 7 swapped electron-devtools-installer (its Manifest V3 loader
  // broke under Electron 28+, spamming "sandboxed_renderer.bundle.js script failed to run") for
  // electron-extension-installer, which loads React/Redux DevTools on Electron 43.
  if (!process.env.LOAD_DEVTOOLS) return;
  const { installExtension, REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } = require('electron-extension-installer');
  return installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS], {
    loadExtensionOptions: { allowFileAccess: true },
    forceDownload: !!process.env.UPGRADE_EXTENSIONS,
  }).catch(console.log);
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
  // url-parse -> native URL, extracted to a pure, unit-tested helper (Phase 6). Byte-identical
  // ops/meta extraction for the sign payload (base64 with + / =); a non-sign/malformed URI no-ops.
  const signReq = parseSignRequest(urlString ?? '');

  promptWindow.webContents.on('did-finish-load', () => {
    if (!promptWindow) {
      throw new Error('"promptWindow" is not defined');
    }
    promptWindow.show();
    promptWindow.focus();
  });

  if (signReq) {
    // Percent-encode ops/meta: the renderer reads them with URLSearchParams, which decodes a literal
    // '+' as a space — standard base64 uses '+', so unencoded interpolation would corrupt the payload.
    promptWindow.loadURL(
      rendererURL(
        `?type=sign&action=promptOperation&ops=${encodeURIComponent(signReq.ops)}&meta=${encodeURIComponent(signReq.meta)}`
      )
    );
  }
}

// IPC handlers for renderer process
ipcMain.handle('shell:openExternal', async (event, url: string) => {
  // C4 — only our own top frame may open external links (defense-in-depth).
  if (!isAllowedSender(event)) return;
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

// D9b Stage C4 — sender-frame allowlist. Only the TOP frame of our OWN windows (the main app window and
// the sign window) may invoke privileged IPC. Rejects an injected sub-frame (non-null parent) and any
// other WebContents (a rogue/opened window, devtools, a detached view). Defense-in-depth beneath the CSP
// (frame-src 'none'), the will-navigate guards, and setWindowOpenHandler:'deny' already on both windows.
function isAllowedSender(event: Electron.IpcMainInvokeEvent): boolean {
  const wc = event.sender;
  const fromKnownWindow =
    (mainWindow != null && wc === mainWindow.webContents) ||
    (promptWindow != null && wc === promptWindow.webContents);
  if (!fromKnownWindow) return false;
  const frame = event.senderFrame;
  // Only the top frame may call privileged IPC — a nested frame has a non-null parent.
  return frame != null && frame.parent == null;
}

// Wrap every keystore handler so errors crossing to the renderer are SANITIZED: log the real cause in
// main, surface only a coarse code. A WIF/password can never leak through an error message (reviewer
// note), while the renderer can still distinguish a wrong password from other failures. Classify by
// `instanceof` (the error classes don't set `.name`, and minification would mangle constructor names).
const keystoreHandle = (
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
) => {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isAllowedSender(event)) {
       
      console.error(`[keystore] ${channel} rejected: sender not on the frame allowlist`);
      throw new Error('FORBIDDEN_SENDER');
    }
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
       
      console.error(`[keystore] ${channel} failed: ${code}`);
      throw new Error(code);
    }
  });
};

keystoreHandle('keystore:list', () => getKeystore().listAccounts());
keystoreHandle('keystore:hasAccount', (_e, account: string) => getKeystore().hasAccount(account));
keystoreHandle('keystore:verify', (_e, account: string, password: string) =>
  getKeystore().verify(account, password)
);
keystoreHandle('keystore:putEnvelope', (_e, rec: any) => getKeystore().putEnvelope(rec));
keystoreHandle('keystore:sign', async (_e, account: string, preparedTx: any, password: string) => {
  const signed = await getKeystore().signTransaction(preparedTx, account, password);
  // Positive audit line (account name only, no secret) so a main-signed broadcast is observable in
  // the main-process log — lets the live test confirm main signed rather than the local fallback.
   
  console.log(`[keystore] signed a transaction for @${account} in the main process`);
  return signed;
});
keystoreHandle(
  'keystore:encodeMemo',
  async (
    _e,
    account: string,
    password: string,
    recipientPublicKey: string,
    message: string,
    expectedSenderMemoPublic?: string
  ) => {
    const encoded = await getKeystore().encodeMemo(
      account,
      password,
      recipientPublicKey,
      message,
      expectedSenderMemoPublic
    );
    // Positive audit line (account name only, no secret) — lets the live test confirm main encoded the
    // memo rather than the renderer's local fallback. Mirrors the keystore:sign audit line.
     
    console.log(`[keystore] encoded a memo for @${account} in the main process`);
    return encoded;
  }
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

// Dev/unpackaged macOS launches (`npm start`, the e2e/profile-copy harness) otherwise show the generic
// Electron dock icon — the packaged app gets its icon from electron-builder (the .icns) and is
// unaffected. dock-icon.png is the styled macOS "app tile" — the red rounded-square with the white Hive
// hexagon padded inside and the standard transparent margin, i.e. the SAME artwork baked into icon.icns
// (nativeImage can't read .icns directly, so we keep a PNG mirror). app.dock.setIcon replaces the dock
// image outright, so it must already carry the rounded-square treatment — a bare transparent logo here
// is exactly what made the dock icon ignore the macOS frame. __dirname is out/main under the vite build,
// so the repo's assets/ sit two levels up.
function setDevDockIcon(): void {
  if (app.isPackaged || process.platform !== 'darwin' || !app.dock) return;
  try {
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'mac', 'dock-icon.png');
    if (!fs.existsSync(iconPath)) return;
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) app.dock.setIcon(image);
  } catch {
    // non-fatal — dev cosmetics only
  }
}

app.on('ready', () => {
  setDevDockIcon();
  createWindow();
});
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
