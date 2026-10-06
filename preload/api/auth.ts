import { ipcRenderer } from "electron";
import type { UserProfileCache } from "@/lib/server/interface";
import type { AuthViewBounds, AuthViewState } from "@/lib/auth/view-types";
import type {
  AuthCommand,
  AuthResult,
  AuthSnapshot,
} from "@/lib/utils/interface";
export const authApi = {
  profile: async (): Promise<UserProfileCache | null> => {
    return ipcRenderer.invoke("desktop:profile");
  },
  viewState: (): Promise<AuthViewState> =>
    ipcRenderer.invoke("auth:view-state"),
  setViewBounds: (bounds: AuthViewBounds): Promise<void> =>
    ipcRenderer.invoke("auth:view-bounds", bounds),
  reloadView: (): Promise<void> => ipcRenderer.invoke("auth:view-reload"),
  setViewVisible: (visible: boolean): Promise<void> =>
    ipcRenderer.invoke("auth:view-visible", visible),
  onViewChanged: (callback: (state: AuthViewState) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: AuthViewState,
    ) => callback(state);
    ipcRenderer.on("auth:view-changed", listener);
    return () => ipcRenderer.removeListener("auth:view-changed", listener);
  },
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
