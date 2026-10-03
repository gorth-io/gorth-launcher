import { ipcRenderer } from "electron";
import type { LauncherInfo } from "@/preload/interface";
export const windowStateApi = {
  isMacOS: process.platform === "darwin",
  getIsFullScreen: (): Promise<boolean> =>
    ipcRenderer.invoke("window:is-full-screen"),
  onFullScreenChanged: (callback: (value: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: boolean) =>
      callback(value);
    ipcRenderer.on("window:full-screen-changed", listener);
    return () => {
      ipcRenderer.removeListener("window:full-screen-changed", listener);
    };
  },
};
export const launcherApi = {
  getInfo: (): Promise<LauncherInfo> => ipcRenderer.invoke("launcher:info"),
  chooseJava: (): Promise<string | null> =>
    ipcRenderer.invoke("launcher:choose-java"),
};
