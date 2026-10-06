import { ipcRenderer } from "electron";
import type {
  LibraryCommand,
  LibraryResult,
  LibrarySnapshot,
} from "@/lib/utils/interface";
export const libraryApi = {
  snapshot: (): Promise<LibrarySnapshot> =>
    ipcRenderer.invoke("library:snapshot"),
  command: (command: LibraryCommand): Promise<LibraryResult> =>
    ipcRenderer.invoke("library:command", command),
  chooseIcon: (instanceId: string): Promise<LibraryResult> =>
    ipcRenderer.invoke("library:choose-icon", { instanceId }),
  createShortcut: (
    instanceId: string,
  ): Promise<{ ok: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke("library:create-shortcut", { instanceId }),
  onShortcutPlay: (callback: (instanceId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, instanceId: string) =>
      callback(instanceId);
    ipcRenderer.on("library:shortcut-play", listener);
    return () => {
      ipcRenderer.removeListener("library:shortcut-play", listener);
    };
  },
  onChanged: (callback: (snapshot: LibrarySnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: LibrarySnapshot,
    ) => callback(value);
    ipcRenderer.on("library:changed", listener);
    return () => {
      ipcRenderer.removeListener("library:changed", listener);
    };
  },
};
