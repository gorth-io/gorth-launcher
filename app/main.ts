import { registerContextMenuIpc } from "@/main/ipc/context-menu";
import { registerWindowIpc } from "@/main/ipc/window";
import { configureDataDirectory } from "@/services/data-directory";
import { app, BrowserWindow, dialog } from "electron";
import started from "electron-squirrel-startup";
import { registerAuthIpc, cancelAuth } from "@/lib/auth/service";
import { registerGameIpc, cancelGame } from "@/lib/game/service";
import { registerLibraryIpc } from "@/lib/library/service";
import { registerContentIpc } from "@/lib/content/service";
import { createWindow } from "@/main/windows/capital";
import { installApplicationMenu } from "@/main/ipc/application-menu";

if (started) app.quit();

app.setName("Gorth Launcher");

configureDataDirectory();

app.setAppUserModelId("com.gorth.launcher");

const ownsDataDirectory = app.requestSingleInstanceLock();

if (!ownsDataDirectory) app.quit();

app.on("second-instance", () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) {
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
});

registerContextMenuIpc();
registerWindowIpc();

app
  .whenReady()
  .then(async () => {
    if (!ownsDataDirectory) return;
    const library = await registerLibraryIpc();
    registerAuthIpc();
    await registerGameIpc(library);
    registerContentIpc(library);
    installApplicationMenu();
    createWindow();
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
