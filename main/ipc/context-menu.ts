import { BrowserWindow, ipcMain } from "electron";

export function registerContextMenuIpc() {
  ipcMain.on(
    "context-menu:command",
    (event, action: string, point?: { x: number; y: number }) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || window.webContents !== event.sender) return;
      switch (action) {
        case "reload":
          event.sender.reload();
          break;
        case "devtools":
          event.sender.toggleDevTools();
          break;
        case "inspect":
          if (point && Number.isFinite(point.x) && Number.isFinite(point.y))
            event.sender.inspectElement(
              Math.round(point.x),
              Math.round(point.y),
            );
          break;
        case "minimize":
          window.minimize();
          break;
        case "maximize":
          if (window.isMaximized()) window.unmaximize();
          else window.maximize();
          break;
        case "close":
          window.close();
          break;
      }
    },
  );
}
