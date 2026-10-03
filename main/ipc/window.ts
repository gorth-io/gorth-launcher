import { app, BrowserWindow, dialog, ipcMain, screen } from "electron";
import os from "node:os";

export function resizeFocusedWindow(width: number, height: number) {
  const target =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!target || target.isDestroyed()) return;

  const resize = () => {
    if (target.isDestroyed()) return;
    const { workArea } = screen.getDisplayMatching(target.getBounds());
    target.setBounds({
      x: workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2)),
      y: workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2)),
      width,
      height,
    });
    target.show();
    target.focus();
  };
  const leaveMaximized = () => {
    if (!target.isMaximized()) return resize();
    target.once("unmaximize", resize);
    target.unmaximize();
  };

  if (target.isMinimized()) target.restore();
  if (target.isFullScreen()) {
    target.once("leave-full-screen", leaveMaximized);
    target.setFullScreen(false);
  } else {
    leaveMaximized();
  }
}

export function registerWindowIpc() {
  ipcMain.handle(
    "window:is-full-screen",
    (event) =>
      BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
  );
  ipcMain.handle("launcher:info", () => ({
    version: app.getVersion(),
    platform: process.platform,
    memoryGB: Math.floor(os.totalmem() / 1024 ** 3),
    dataPath: app.getPath("userData"),
  }));
  ipcMain.handle("launcher:choose-java", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;
    const result = await dialog.showOpenDialog(window, {
      title: "Chọn Java executable",
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
