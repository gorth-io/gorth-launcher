import { contextBridge } from "electron";
import { shortcutsApi } from "@/preload/api/shortcuts";
import { contentApi } from "@/preload/api/content";
import { libraryApi } from "@/preload/api/database";
import { portalApi } from "@/preload/api/portal";
import { contextMenuApi, appMenuApi } from "@/preload/api/browser";
import { gameApi } from "@/preload/api/game";
import { authApi } from "@/preload/api/auth";
import { windowStateApi, launcherApi } from "@/preload/api/window";
import { instanceDataApi } from "@/preload/api/instance-data";

const electronAPI = {
  shortcuts: shortcutsApi,
  content: contentApi,
  library: libraryApi,
  portal: portalApi,
  contextMenu: contextMenuApi,
  appMenu: appMenuApi,
  game: gameApi,
  auth: authApi,
  windowState: windowStateApi,
  launcher: launcherApi,
  instanceData: instanceDataApi,
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
