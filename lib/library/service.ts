import { app, BrowserWindow, ipcMain, session } from "electron";
import { createLibraryStore } from "./store";
import { gameIsBusy, synchronizeGameLibrary } from "@/lib/game/service";
import type { LibraryResult } from "@/lib/utils/interface";
import { contentIsBusy } from "@/lib/content/state";

export async function registerLibraryIpc() {
  const store = await createLibraryStore(app.getPath("userData"), gameIsBusy);
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted library sender");
  };
  ipcMain.handle("library:snapshot", (event) => {
    trusted(event);
    return store.snapshot();
  });
  ipcMain.handle(
    "library:command",
    async (event, raw: unknown): Promise<LibraryResult> => {
      trusted(event);
      try {
        if (contentIsBusy())
          throw new Error("Hãy chờ tác vụ mod/modpack hoàn tất.");
        // Cookies belong to their old dev origin. Read them in main as well so
        // a packaged file:// renderer can migrate an existing desktop profile.
        if (
          store.needsMigration() &&
          raw &&
          typeof raw === "object" &&
          "action" in raw &&
          raw.action === "migrate"
        ) {
          const input = raw as { instances?: unknown; settings?: unknown };
          const previous = await session.defaultSession.cookies.get({
            name: "launcher-instances",
          });
          const previousSettings = await session.defaultSession.cookies.get({
            name: "launcher-settings",
          });
          raw = {
            ...raw,
            instances:
              Array.isArray(input.instances) && input.instances.length
                ? input.instances
                : previous.length
                  ? JSON.parse(decodeURIComponent(previous[0].value))
                  : input.instances,
            settings: previousSettings.length
              ? JSON.parse(decodeURIComponent(previousSettings[0].value))
              : input.settings,
          };
        }
        const snapshot = await store.command(raw);
        await synchronizeGameLibrary(snapshot.instances);
        for (const window of BrowserWindow.getAllWindows())
          window.webContents.send("library:changed", snapshot);
        return { ok: true, snapshot };
      } catch (error) {
        console.error("Library operation failed", error);
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Không cập nhật được thư viện.",
          snapshot: store.snapshot(),
        };
      }
    },
  );
  app.on("will-quit", store.close);
  return store;
}
