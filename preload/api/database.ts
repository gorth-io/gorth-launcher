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
