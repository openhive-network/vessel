import { contextBridge, ipcRenderer } from 'electron';

// Protected API exposed to the renderer without leaking the whole ipcRenderer.
const electronAPI = {
  // Shell operations for opening external links
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  // Platform info
  platform: process.platform,
  // App version
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
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
export interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  platform: NodeJS.Platform;
  getVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
