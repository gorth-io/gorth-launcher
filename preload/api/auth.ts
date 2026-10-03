import { ipcRenderer } from "electron";
import type {
  AuthCommand,
  AuthResult,
  AuthSnapshot,
} from "@/lib/utils/interface";
export const authApi = {
  snapshot: (): Promise<AuthResult> => ipcRenderer.invoke("auth:snapshot"),
  command: (command: AuthCommand): Promise<AuthResult> =>
    ipcRenderer.invoke("auth:command", command),
  onChanged: (callback: (snapshot: AuthSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: AuthSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on("auth:changed", listener);
    return () => {
      ipcRenderer.removeListener("auth:changed", listener);
    };
  },
};
