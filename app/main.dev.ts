/* eslint global-require: 1 */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import MenuBuilder from './menu';

let mainWindow: BrowserWindow | null = null;
let promptWindow: BrowserWindow | null = null;
let customURI: string | string[] | undefined;

// Phase 1 test harness (EXECUTION_STRATEGY §5): point Electron at a DISPOSABLE profile copy, never
// the real one. Must run before any app wiring reads userData.
if (process.env.VESSEL_USER_DATA) {
  app.setPath('userData', process.env.VESSEL_USER_DATA);
}

// Dev/unpackaged launches (e.g. the profile-copy harness, `npm start`) otherwise show the generic
// Electron dock icon; packaged builds get the icon from electron-builder. Set it for dev on macOS.
if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
  try {
    app.dock.setIcon(path.join(__dirname, '..', 'assets', 'icons', 'png', '512x512.png'));
  } catch {
    // non-fatal — dev cosmetics only
  }
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

async function createWindow() {
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
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`file://${__dirname}/app.html`);

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
      nodeIntegration: true,
      contextIsolation: false,
    },
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
        `file://${__dirname}/app.html?type=sign&action=promptOperation&ops=${base64encoded}&meta=${base64encodedmeta}`
      );
    }
  }
}

// IPC handlers for renderer process
ipcMain.handle('shell:openExternal', async (event, url: string) => {
  await shell.openExternal(url);
});

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

function devToolsLog(s: string) {
  console.log(s);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`console.log("${s}")`);
  }
}
