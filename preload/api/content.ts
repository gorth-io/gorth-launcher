import { ipcRenderer } from "electron";
import type {
  ContentInstall,
  ContentProject,
  ContentQuery,
  ContentResult,
  ContentStatus,
  ContentVersion,
} from "@/lib/content/interface";
export const contentApi = {
  status: (): Promise<{
    status: ContentStatus;
    curseforgeConfigured: boolean;
  }> => ipcRenderer.invoke("content:status"),
  search: (
    query: ContentQuery,
  ): Promise<ContentResult<{ projects: ContentProject[]; more: boolean }>> =>
    ipcRenderer.invoke("content:search", query),
  versions: (
    query: ContentQuery,
    projectId: string,
  ): Promise<ContentResult<ContentVersion[]>> =>
    ipcRenderer.invoke("content:versions", { query, projectId }),
  install: (input: ContentInstall): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:install", input),
  importPack: (): Promise<ContentResult<null>> =>
    ipcRenderer.invoke("content:import"),
  cancel: (): Promise<void> => ipcRenderer.invoke("content:cancel"),
  onChanged: (callback: (status: ContentStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: ContentStatus,
    ) => callback(status);
    ipcRenderer.on("content:changed", listener);
    return () => ipcRenderer.removeListener("content:changed", listener);
  },
};
