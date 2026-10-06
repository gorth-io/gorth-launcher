// Test-only Electron replacement. Never imported by an application build.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
export const directory = mkdtempSync(path.join(tmpdir(), "gorth-auth-test-"));
export const calls = {
  decrypt: 0,
  available: false,
  snapshots: [] as unknown[],
};
export const handlers = new Map<string, (...args: unknown[]) => unknown>();
export const frame = {};
export const sender = {
  mainFrame: frame,
  isDestroyed: () => false,
  send: (_channel: string, value: unknown) => calls.snapshots.push(value),
};
const window = { webContents: sender };
export const BrowserWindow = {
  fromWebContents: (value: unknown) => (value === sender ? window : null),
  getAllWindows: () => [window],
};
export const app = { getPath: () => directory };
export const ipcMain = {
  handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(channel, handler),
};
export const shell = {
  openExternal: async () => {
    throw new Error("Unexpected external navigation");
  },
};
export const dialog = { showSaveDialog: async () => ({ canceled: true }) };
export const authSession = Object.assign(new EventEmitter(), {
  clearStorageData: async () => {},
  setPermissionRequestHandler: () => {},
  setPermissionCheckHandler: () => {},
});
export const session = { fromPartition: () => authSession };
export const embeddedViews: WebContentsView[] = [];
export class WebContentsView {
  webContents = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    close: () => {
      this.closed = true;
    },
    loadURL: async (url: string) => {
      this.url = url;
    },
    reload: () => {},
    setWindowOpenHandler: (
      handler: (details: { url: string }) => { action: string },
    ) => {
      this.openHandler = handler;
    },
  });
  closed = false;
  visible = true;
  url = "";
  bounds = {};
  openHandler?: (details: { url: string }) => { action: string };
  constructor(public options: unknown) {
    embeddedViews.push(this);
  }
  setBounds(value: unknown) {
    this.bounds = value;
  }
  setVisible(value: boolean) {
    this.visible = value;
  }
}
export const safeStorage = {
  isEncryptionAvailable: () => calls.available,
  getSelectedStorageBackend: () => "test",
  encryptString: (value: string) => Buffer.from("TEST-ONLY:" + value),
  decryptString: (value: Buffer) => {
    calls.decrypt++;
    if (!value.toString().startsWith("TEST-ONLY:"))
      throw new Error("Invalid fixture");
    return value.toString().slice("TEST-ONLY:".length);
  },
};
