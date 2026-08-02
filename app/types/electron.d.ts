// Extended Electron types for Electron 28
// These augment the existing types with newer APIs

import 'electron';

declare module 'electron' {
  interface IpcMain {
    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any): void;
    handleOnce(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any): void;
    removeHandler(channel: string): void;
  }

  interface IpcMainInvokeEvent {
    sender: WebContents;
    frameId: number;
  }

  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
  }

  interface ContextBridge {
    exposeInMainWorld(apiKey: string, api: Record<string, any>): void;
  }

  const contextBridge: ContextBridge;
}
