import { ipcRenderer } from "electron";
import type { Shortcut } from "@/lib/shortcuts";
export const shortcutsApi = {
  list: () => ipcRenderer.invoke("shortcuts:list") as Promise<Shortcut[]>,
  update: (id: string, accelerator: string) =>
    ipcRenderer.invoke("shortcuts:update", id, accelerator) as Promise<
      Shortcut[]
    >,
  reset: (id?: string) =>
    ipcRenderer.invoke("shortcuts:reset", id) as Promise<Shortcut[]>,
  capture: (enabled: boolean) =>
    ipcRenderer.invoke("shortcuts:capture", enabled) as Promise<void>,
};
