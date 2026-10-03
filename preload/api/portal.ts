import { ipcRenderer } from "electron";
export const portalApi = {
  update: (
    id: string,
    bounds: { x: number; y: number; width: number; height: number } | null,
  ) => ipcRenderer.send("portal:update", id, bounds),
  onBlur: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) =>
      callback(id);
    ipcRenderer.on("portal:blur", listener);
    return () => {
      ipcRenderer.removeListener("portal:blur", listener);
    };
  },
};
