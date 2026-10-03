import { BrowserWindow } from "electron";
import type { AppMenuAction } from "@/lib/utils/interface";
import { createWindow } from "@/main/windows/capital";

export function sendMenuAction(action: AppMenuAction) {
  const target =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (target) {
    if (target.isMinimized()) target.restore();
    target.show();
    target.webContents.send("app:menu-action", action);
  } else {
    const window = createWindow();
    window.webContents.once("did-finish-load", () =>
      window.webContents.send("app:menu-action", action),
    );
  }
}
