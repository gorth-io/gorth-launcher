import path from "node:path";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";
import { registerContextMenuIpc } from "@/main/ipc/context-menu";
import { registerWindowIpc } from "@/main/ipc/window";
import { configureDataDirectory } from "@/services/data-directory";
import { app, BrowserWindow, dialog } from "electron";
import started from "electron-squirrel-startup";
import {
  registerAuthIpc,
  cancelAuth,
  getAuthenticatedUserId,
} from "@/lib/auth/service";
import { registerGameIpc, cancelGame } from "@/lib/game/service";
import { registerLibraryIpc } from "@/lib/library/service";
import { registerContentIpc } from "@/lib/content/service";
import { createWindow } from "@/main/windows/capital";
import { installApplicationMenu } from "@/main/ipc/application-menu";
import { registerShortcutsIpc } from "@/main/ipc/shortcuts";
import { sendMenuAction } from "@/main/ipc/native-menu";
import type { AppMenuAction } from "@/lib/utils/interface";
import { registerInstanceDataIpc } from "@/lib/instance/service";

if (started) app.quit();

app.setName("Gorth Launcher");

configureDataDirectory();

app.setAppUserModelId("com.gorth.launcher");

const ownsDataDirectory = app.requestSingleInstanceLock();
const shortcutInstance = (argv: string[]) =>
  argv
    .find((argument) => argument.startsWith("--play-instance="))
    ?.slice("--play-instance=".length);

if (!ownsDataDirectory) app.quit();

app.on("second-instance", (_event, argv) => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    const id = shortcutInstance(argv);
    if (id) window.webContents.send("library:shortcut-play", id);
  }
});

registerContextMenuIpc();
registerWindowIpc();

app
  .whenReady()
  .then(async () => {
    if (!ownsDataDirectory) return;
    const library = await registerLibraryIpc();
    await startDesktopServer(
      !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
      getAuthenticatedUserId,
    );
    registerAuthIpc();
    await registerGameIpc(library);
    registerContentIpc(library);
    registerInstanceDataIpc(library);
    registerShortcutsIpc(installApplicationMenu, (id) =>
      sendMenuAction(id as AppMenuAction),
    );
    installApplicationMenu();
    const window = createWindow();
    const id = shortcutInstance(process.argv);
    if (id)
      window.webContents.once("did-finish-load", () =>
        window.webContents.send("library:shortcut-play", id),
      );
  })
  .catch((error) => {
    dialog.showErrorBox("Không mở được dữ liệu launcher", String(error));
    app.quit();
  });

app.on("before-quit", cancelAuth);

app.on("before-quit", cancelGame);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", stopDesktopServer);
