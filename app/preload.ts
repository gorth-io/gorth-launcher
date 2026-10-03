import { contextBridge } from "electron";
import { contentApi } from "@/preload/api/content";
import { libraryApi } from "@/preload/api/database";
import { portalApi } from "@/preload/api/portal";
import { contextMenuApi, appMenuApi } from "@/preload/api/browser";
import { gameApi } from "@/preload/api/game";
import { authApi } from "@/preload/api/auth";
import { windowStateApi, launcherApi } from "@/preload/api/window";

const electronAPI = {
  content: contentApi,
  library: libraryApi,
  portal: portalApi,
  contextMenu: contextMenuApi,
  appMenu: appMenuApi,
  game: gameApi,
  auth: authApi,
  windowState: windowStateApi,
  launcher: launcherApi,
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
