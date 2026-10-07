import { BrowserWindow, ipcMain } from "electron";
import { desktopRouter, type DesktopContext } from "@/main/rpc/router";
import { handleRpcRequest } from "@/main/rpc/transport";
import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
export function registerRpcIpc(context: DesktopContext) {
  ipcMain.handle("desktop:rpc", (event, input: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !isRpcRendererUrl(event.sender.getURL(), getRpcRendererUrl())
    ) {
      throw new Error("Untrusted desktop RPC sender.");
    }
    return handleRpcRequest(desktopRouter, input, context);
  });
}
