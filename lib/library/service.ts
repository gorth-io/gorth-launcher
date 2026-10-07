import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import path from "node:path";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { createLibraryStore } from "@/services/library-store";
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
  const instanceId = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
  const result = async (
    work: () => Promise<ReturnType<typeof store.snapshot>>,
  ) => {
    try {
      const snapshot = await work();
      for (const window of BrowserWindow.getAllWindows())
        window.webContents.send("library:changed", snapshot);
      return { ok: true, snapshot };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Thao tác thất bại.",
        snapshot: store.snapshot(),
      };
    }
  };
  ipcMain.handle("library:choose-icon", (event, raw) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    trusted(event);
    return result(async () => {
      const id = instanceId.parse(raw?.instanceId);
      store.getInstance(id);
      const selected = await dialog.showOpenDialog(window!, {
        title: "Chọn icon instance",
        properties: ["openFile"],
        filters: [
          { name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] },
        ],
      });
      if (selected.canceled || !selected.filePaths[0]) return store.snapshot();
      const data = await readFile(selected.filePaths[0]);
      if (data.length > 2 * 1024 * 1024)
        throw new Error("Icon vượt giới hạn 2 MB.");
      const mime = data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : data[0] === 0xff && data[1] === 0xd8
          ? "image/jpeg"
          : data.subarray(0, 4).toString() === "RIFF" &&
              data.subarray(8, 12).toString() === "WEBP"
            ? "image/webp"
            : null;
      if (!mime) throw new Error("Icon phải là PNG, JPEG hoặc WebP hợp lệ.");
      return store.command({
        action: "icon",
        id,
        iconData: `data:${mime};base64,${data.toString("base64")}`,
      });
    });
  });
  ipcMain.handle("library:create-shortcut", async (event, raw) => {
    trusted(event);
    try {
      const id = instanceId.parse(raw?.instanceId),
        instance = store.getInstance(id),
        desktop = app.getPath("desktop"),
        safeName = instance.name.replace(/[\\/:*?"<>|]/g, "_");
      const executable = process.execPath.replace(/'/g, "'\\''");
      let file: string, content: string;
      if (process.platform === "win32") {
        file = path.join(desktop, safeName + ".cmd");
        content = `@echo off\r\nstart "" "${process.execPath.replace(/"/g, '""')}" --play-instance=${id}\r\n`;
      } else if (process.platform === "darwin") {
        file = path.join(desktop, safeName + ".command");
        content = `#!/bin/sh\nexec '${executable}' --play-instance=${id}\n`;
      } else {
        file = path.join(desktop, safeName + ".desktop");
        content = `[Desktop Entry]\nType=Application\nName=${instance.name.replace(/[\r\n]/g, " ")}\nExec=${process.execPath.replace(/ /g, "\\ ")} --play-instance=${id}\nTerminal=false\n`;
      }
      await writeFile(file, content, { mode: 0o755 });
      if (process.platform !== "win32") await chmod(file, 0o755);
      return { ok: true, path: file };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Không tạo được shortcut.",
      };
    }
  });
  const applyCommand = async (raw: unknown): Promise<LibraryResult> => {
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
  };
  ipcMain.handle("library:command", (event, raw: unknown) => {
    trusted(event);
    return applyCommand(raw);
  });
  app.on("will-quit", store.close);
  return { ...store, applyCommand };
}
