declare module 'electron' {
  export const app: {
    name: string;
    isPackaged: boolean;
    isReady: () => boolean;
    getPath: (name: string) => string;
    setPath: (name: string, path: string) => void;
    getAppPath: () => string;
    getVersion: () => string;
    getLocale: () => string;
    setName: (name: string) => void;
    on: (event: string, listener: (...args: any[]) => void) => void;
    once: (event: string, listener: (...args: any[]) => void) => void;
    quit: () => void;
    exit: (code: number) => void;
    whenReady: () => Promise<void>;
    requestSingleInstanceLock: () => boolean;
    disableHardwareAcceleration: () => void;
    configureHostResolver: (options: any) => void;
    relaunch: (options?: any) => void;
    getLoginItemSettings: (options?: any) => any;
    setLoginItemSettings: (options: any) => void;
    commandLine: {
      appendSwitch: (switchName: string, value?: string) => void;
    };
    dock?: {
      setIcon: (icon: any) => void;
    };
  };
  
  export class BrowserWindow {
    constructor(options?: any);
    loadURL(url: string): Promise<void>;
    loadFile(filePath: string): Promise<void>;
    show(): void;
    hide(): void;
    focus(): void;
    minimize(): void;
    maximize(): void;
    unmaximize(): void;
    restore(): void;
    close(): void;
    isVisible(): boolean;
    isFocused(): boolean;
    isMinimized(): boolean;
    isMaximized(): boolean;
    isFullScreen(): boolean;
    isDestroyed(): boolean;
    setMenu(menu: any): void;
    setMinimumSize(width: number, height: number): void;
    setTitleBarOverlay(options?: any): void;
    setBackgroundColor(color: string): void;
    on(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    webContents: any;
    static getAllWindows(): BrowserWindow[];
    static fromWebContents(webContents: any): BrowserWindow | null;
  }
  
  export const ipcMain: {
    handle: (channel: string, listener: (event: any, ...args: any[]) => any) => void;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
  
  export const ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
    send: (channel: string, ...args: any[]) => void;
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  };
  
  export const contextBridge: {
    exposeInMainWorld: (key: string, api: any) => void;
  };
  
  export const session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: (listener: (details: any, callback: (responseHeaders: any) => void) => void) => void;
      };
      fetch: (url: string, options?: any) => Promise<any>;
      setProxy: (options: any) => Promise<void>;
      resolveProxy: (url: string) => Promise<string>;
    };
  };
  
  export class Tray {
    constructor(image: any, options?: any);
    setToolTip(tooltip: string): void;
    setContextMenu(menu: Menu | null): void;
    popUpContextMenu(menu?: Menu): void;
    removeListener(event: string, listener: (...args: any[]) => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
  }
  
  export class Menu {
    static buildFromTemplate(template: any[]): Menu;
    popup(options?: any): void;
  }
  
  export const nativeImage: {
    createFromPath: (path: string) => any;
  };
  
  export const nativeTheme: any;
  export const systemPreferences: any;
  
  export const shell: {
    openPath: (path: string) => Promise<string>;
    showItemInFolder: (path: string) => void;
    openExternal: (url: string) => Promise<boolean>;
  };
  
  export const dialog: {
    showOpenDialog: (options: any, dialogOptions?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog: (options: any, saveOptions?: any) => Promise<{ canceled: boolean; filePath?: string }>;
  };
  
  export type WebContents = any;
}

declare namespace NodeJS {
  interface Process {
    resourcesPath: string;
  }
}
