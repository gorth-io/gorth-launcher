import { session, type BrowserWindow } from "electron";
import { allowedContentWebsite } from "@/lib/content/website";

export function installWebview(window: BrowserWindow) {
  const partition = "content-websites";
  const isolated = session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  // Downloads are managed by the launcher, with hashes and instance validation.
  const blockDownload = (event: Electron.Event) => event.preventDefault();
  isolated.on("will-download", blockDownload);
  window.once("closed", () =>
    isolated.removeListener("will-download", blockDownload),
  );
  window.webContents.on("will-attach-webview", (event, preferences, params) => {
    if (!allowedContentWebsite(params.src) || params.partition !== partition) {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    Object.assign(preferences, {
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
    });
  });
  window.webContents.on("did-attach-webview", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    const guard = (event: Electron.Event, url: string) => {
      if (!allowedContentWebsite(url)) event.preventDefault();
    };
    contents.on("will-navigate", guard);
    contents.on("will-redirect", guard);
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
}
