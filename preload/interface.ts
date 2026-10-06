export interface LauncherInfo {
  version: string;
  platform: string;
  memoryGB: number;
  dataPath: string;
}
export interface ElectronApi {
  shortcuts: typeof import("@/preload/api/shortcuts").shortcutsApi;
  content: typeof import("@/preload/api/content").contentApi;
  library: typeof import("@/preload/api/database").libraryApi;
  portal: typeof import("@/preload/api/portal").portalApi;
  contextMenu: typeof import("@/preload/api/browser").contextMenuApi;
  appMenu: typeof import("@/preload/api/browser").appMenuApi;
  game: typeof import("@/preload/api/game").gameApi;
  auth: typeof import("@/preload/api/auth").authApi;
  windowState: typeof import("@/preload/api/window").windowStateApi;
  launcher: typeof import("@/preload/api/window").launcherApi;
  instanceData: typeof import("@/preload/api/instance-data").instanceDataApi;
}
declare global {
  interface Window {
    electronAPI: ElectronApi;
  }
}
