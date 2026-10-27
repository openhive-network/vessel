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
    verify: (account: string, password: string) =>
      ipcRenderer.invoke('keystore:verify', account, password),
    putEnvelope: (rec: unknown) => ipcRenderer.invoke('keystore:putEnvelope', rec),
    getEnvelope: (account: string) => ipcRenderer.invoke('keystore:getEnvelope', account),
    sign: (account: string, preparedTx: unknown, password: string) =>
      ipcRenderer.invoke('keystore:sign', account, preparedTx, password),
    encodeMemo: (
      account: string,
      password: string,
      recipientPublicKey: string,
      message: string,
      expectedSenderMemoPublic?: string
    ) =>
      ipcRenderer.invoke(
        'keystore:encodeMemo',
        account,
        password,
        recipientPublicKey,
        message,
        expectedSenderMemoPublic
      ),
    decodeMemo: (account: string, password: string, encoded: string) =>
      ipcRenderer.invoke('keystore:decodeMemo', account, password, encoded),
    importKey: (account: string, wif: string, password: string, type: string) =>
      ipcRenderer.invoke('keystore:importKey', account, wif, password, type),
    importMemoKey: (account: string, memoWif: string, password: string) =>
      ipcRenderer.invoke('keystore:importMemoKey', account, memoWif, password),
    setChainConfig: (chainId: string, addressPrefix?: string) =>
      ipcRenderer.invoke('keystore:setChainConfig', chainId, addressPrefix),
    migrateRecords: (records: unknown[]) => ipcRenderer.invoke('keystore:migrateRecords', records),
    removeAccount: (account: string) => ipcRenderer.invoke('keystore:removeAccount', account),
    pruneAccounts: (accounts: string[]) => ipcRenderer.invoke('keystore:pruneAccounts', accounts),
  },
};

// Both windows run contextIsolation:true / nodeIntegration:false / sandbox:true (see main.dev.ts), so
// contextBridge is the live path. The else-branch is a dead defensive fallback for a non-isolated
// context (process.contextIsolated is always true here) — kept only so the preload can't crash if the
// window config ever regresses.
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
  verify: (account: string, password: string) => Promise<boolean>;
  putEnvelope: (rec: {
    account: string;
    key: string;
    encrypted: boolean;
    type: string;
    memo?: string;
  }) => Promise<void>;
  /** The account's ciphertext as main holds it (encrypted fields only); null if main has no record. */
  getEnvelope: (account: string) => Promise<{ key?: string; memo?: string } | null>;
  sign: (account: string, preparedTx: unknown, password: string) => Promise<any>;
  encodeMemo: (
    account: string,
    password: string,
    recipientPublicKey: string,
    message: string,
    expectedSenderMemoPublic?: string
  ) => Promise<string>;
  decodeMemo: (account: string, password: string, encoded: string) => Promise<string>;
  importKey: (account: string, wif: string, password: string, type: string) => Promise<void>;
  importMemoKey: (account: string, memoWif: string, password: string) => Promise<void>;
  setChainConfig: (chainId: string, addressPrefix?: string) => Promise<void>;
  migrateRecords: (
    records: unknown[]
  ) => Promise<{ migrated: string[]; skipped: string[] }>;
  removeAccount: (account: string) => Promise<void>;
  pruneAccounts: (accounts: string[]) => Promise<string[]>;
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
