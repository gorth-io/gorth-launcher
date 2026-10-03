import { ipcRenderer } from "electron";
import type { AppMenuAction } from "@/lib/utils/interface";
export const contextMenuApi = {
  command: (
    action:
      "reload" | "devtools" | "inspect" | "minimize" | "maximize" | "close",
    point?: { x: number; y: number },
  ) => ipcRenderer.send("context-menu:command", action, point),
  onTitlebar: (callback: (point: { x: number; y: number }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      point: { x: number; y: number },
    ) => callback(point);
    ipcRenderer.on("context-menu:titlebar", listener);
    return () => {
      ipcRenderer.removeListener("context-menu:titlebar", listener);
    };
  },
};
export const appMenuApi = {
  onAction: (callback: (action: AppMenuAction) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      action: AppMenuAction,
    ) => callback(action);
    ipcRenderer.on("app:menu-action", listener);
    return () => {
      ipcRenderer.removeListener("app:menu-action", listener);
    };
  },
};
