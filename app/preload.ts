import { contextBridge, ipcRenderer } from 'electron';

// Protected API exposed to the renderer without leaking the whole ipcRenderer.
const electronAPI = {
  // Shell operations for opening external links
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  // Platform info
  platform: process.platform,
  // App version
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  // D9b Stage B — main-process keystore. Additive: exposed now, but no renderer code calls it until
  // the Stage B migration + seam rewire land. Sign/memo run in main; a WIF never crosses back.
  keystore: {
    list: () => ipcRenderer.invoke('keystore:list'),
    hasAccount: (account: string) => ipcRenderer.invoke('keystore:hasAccount', account),
    sign: (account: string, preparedTx: unknown, password: string) =>
      ipcRenderer.invoke('keystore:sign', account, preparedTx, password),
    encodeMemo: (account: string, password: string, recipientPublicKey: string, message: string) =>
      ipcRenderer.invoke('keystore:encodeMemo', account, password, recipientPublicKey, message),
    decodeMemo: (account: string, password: string, encoded: string) =>
      ipcRenderer.invoke('keystore:decodeMemo', account, password, encoded),
    importKey: (account: string, wif: string, password: string, type: string) =>
      ipcRenderer.invoke('keystore:importKey', account, wif, password, type),
    setChainConfig: (chainId: string, addressPrefix?: string) =>
      ipcRenderer.invoke('keystore:setChainConfig', chainId, addressPrefix),
  },
};

// contextBridge REQUIRES contextIsolation:true — Phase 3 flips it on. Until then the windows run
// contextIsolation:false / nodeIntegration:true, so exposing via contextBridge would throw and abort
// the whole preload. Expose directly on window in that case; switch to contextBridge once isolated.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} else {
  (window as unknown as { electronAPI: typeof electronAPI }).electronAPI = electronAPI;
}

// Type definitions for renderer
export interface KeystoreAccountSummary {
  account: string;
  encrypted: boolean;
  type: string;
  hasMemo: boolean;
}

export interface KeystoreBridge {
  list: () => Promise<KeystoreAccountSummary[]>;
  hasAccount: (account: string) => Promise<boolean>;
  sign: (account: string, preparedTx: unknown, password: string) => Promise<any>;
  encodeMemo: (
    account: string,
    password: string,
    recipientPublicKey: string,
    message: string
  ) => Promise<string>;
  decodeMemo: (account: string, password: string, encoded: string) => Promise<string>;
  importKey: (account: string, wif: string, password: string, type: string) => Promise<void>;
  setChainConfig: (chainId: string, addressPrefix?: string) => Promise<void>;
}

export interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  platform: NodeJS.Platform;
  getVersion: () => Promise<string>;
  keystore: KeystoreBridge;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
