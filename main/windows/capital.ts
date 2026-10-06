import { appUrl } from "@/lib/utils/environment";
import { installPortal } from "@/main/windows/portal";
import { installWebview } from "@/main/windows/webview";
import { BrowserWindow, dialog, nativeTheme, screen } from "electron";
import path from "node:path";
import { readWindowState, trackWindowState } from "@/main/windows/state";
let mainWindow: BrowserWindow | null = null;

export function createWindow() {
  // The launcher stores one window state. Reuse its one main window rather
  // than letting activation/menu races create competing state writers.
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  const { isMaximized, ...bounds } = readWindowState();
  const window = new BrowserWindow({
    title: "Gorth Launcher",
    ...bounds,
    show: false,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 21, y: 21 } }
      : {
          titleBarOverlay: {
            color: "#00000000",
            symbolColor: "#888888",
            height: 52,
          },
        }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171717" : "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });
  mainWindow = window;
  window.once("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  installPortal(window);
  installWebview(window);
  window.on("system-context-menu", (event, point) => {
    event.preventDefault();
    const dip = screen.screenToDipPoint(point);
    const bounds = window.getContentBounds();
    window.webContents.send("context-menu:titlebar", {
      x: dip.x - bounds.x,
      y: dip.y - bounds.y,
    });
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (
      new URL(url).origin !== new URL(appUrl || MAIN_WINDOW_VITE_DEV_SERVER_URL).origin
    )
      event.preventDefault();
  });
  const notify = () =>
    window.webContents.send(
      "window:full-screen-changed",
      window.isFullScreen(),
    );
  window.on("enter-full-screen", notify);
  window.on("leave-full-screen", notify);
  trackWindowState(window);
  window.once("ready-to-show", () => {
    if (isMaximized) window.maximize();
    window.show();
  });
  const loadRenderer = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL || appUrl)
          await window.loadURL(
      new URL("assets/index.html", appUrl || MAIN_WINDOW_VITE_DEV_SERVER_URL).href,
          );
        else
          await window.loadFile(
            path.join(
              __dirname,
              `../renderer/${MAIN_WINDOW_VITE_NAME}/assets/index.html`,
            ),
          );
        return;
      } catch (error) {
        if (window.isDestroyed()) return;
        if (!MAIN_WINDOW_VITE_DEV_SERVER_URL || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };
  void loadRenderer().catch(() =>
    dialog.showErrorBox(
      "Gorth Launcher",
      "Could not load the application interface. Please restart the app.",
    ),
  );
  return window;
}
