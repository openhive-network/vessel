import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Shell operations for opening external links
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Platform info
  platform: process.platform,

  // App version
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});

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
