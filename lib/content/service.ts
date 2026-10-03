import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import type { createLibraryStore } from "@/lib/library/store";
import { gameIsBusy, synchronizeGameLibrary } from "@/lib/game/service";
import { download } from "@/lib/game/files";
import {
  beginContent,
  cancelContent,
  contentSnapshot,
  finishContent,
  subscribeContent,
  updateContent,
} from "./state";
import {
  contentVersions,
  hasCurseForgeKey,
  resolveContentFile,
  resolveMods,
  searchContent,
} from "./providers";
import { installSchema, querySchema, versionsSchema } from "./schema";
import { installMods, regularDirectory } from "./install";
import { unpackPack } from "./packs";
import type { ContentResult } from "./interface";

export function registerContentIpc(
  library: Awaited<ReturnType<typeof createLibraryStore>>,
) {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted content sender");
    return window;
  };
  const root = () => path.join(app.getPath("userData"), "minecraft");
  const run = async <T>(
    action: () => Promise<T>,
  ): Promise<ContentResult<T>> => {
    try {
      return { ok: true, data: await action() };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Không xử lý được nội dung.",
      };
    }
  };
  subscribeContent((status) => {
    for (const window of BrowserWindow.getAllWindows())
      if (!window.webContents.isDestroyed())
        window.webContents.send("content:changed", status);
  });
  ipcMain.handle("content:status", (event) => {
    trusted(event);
    return {
      status: contentSnapshot(),
      curseforgeConfigured: hasCurseForgeKey(),
    };
  });
  ipcMain.handle("content:cancel", (event) => {
    trusted(event);
    cancelContent();
  });
  ipcMain.handle("content:search", (event, raw) => {
    trusted(event);
    return run(() =>
      searchContent(querySchema.parse(raw), AbortSignal.timeout(45_000)),
    );
  });
  ipcMain.handle("content:versions", (event, raw) => {
    trusted(event);
    return run(() => {
      const input = versionsSchema.parse(raw);
      return contentVersions(
        input.query,
        input.projectId,
        AbortSignal.timeout(45_000),
      );
    });
  });
  async function operation(
    action: (staging: string, signal: AbortSignal) => Promise<void>,
  ) {
    if (gameIsBusy() || library.isWorking())
      throw new Error(
        "Hãy dừng game/tải game và chờ thao tác thư viện trước khi cài nội dung.",
      );
    const signal = beginContent();
    let staging: string | undefined;
    try {
      const directory = await regularDirectory(
        app.getPath("userData"),
        "minecraft/content-staging",
      );
      staging = await mkdtemp(path.join(directory, "install-"));
      await action(staging, signal);
      finishContent();
    } catch (error) {
      const message = signal.aborted
        ? "Đã hủy cài nội dung."
        : error instanceof Error
          ? error.message
          : "Cài nội dung thất bại.";
      finishContent(message);
      throw new Error(message);
    } finally {
      if (staging) await rm(staging, { recursive: true, force: true });
    }
  }
  async function importArchive(
    archive: string,
    staging: string,
    signal: AbortSignal,
  ) {
    updateContent("Kiểm tra modpack…");
    const item = await unpackPack(archive, staging, signal, updateContent);
    signal.throwIfAborted();
    await library.importInstance(item, path.join(staging, "payload"));
    const snapshot = library.snapshot();
    await synchronizeGameLibrary(snapshot.instances);
    for (const window of BrowserWindow.getAllWindows())
      if (!window.webContents.isDestroyed())
        window.webContents.send("library:changed", snapshot);
  }
  ipcMain.handle("content:install", (event, raw) => {
    trusted(event);
    return run(async () => {
      const input = installSchema.parse(raw);
      await operation(async (staging, signal) => {
        if (input.query.kind !== "modpack") {
          if (!input.instanceId)
            throw new Error("Hãy chọn instance để cài nội dung.");
          const instance = library.getInstance(input.instanceId);
          const query = {
            ...input.query,
            version: instance.version,
            loader: instance.loader,
          };
          querySchema.parse(query);
          const files = await resolveMods(
            query,
            input.projectId,
            input.versionId,
            signal,
          );
          await installMods(
            root(),
            instance.id,
            query.provider,
            files,
            staging,
            signal,
            updateContent,
          );
        } else {
          const file = await resolveContentFile(
            input.query,
            input.projectId,
            input.versionId,
            signal,
          );
          const archive = path.join(staging, "pack.zip");
          updateContent("Đang tải archive modpack…");
          await download(file.artifact, archive, signal);
          await importArchive(archive, staging, signal);
        }
      });
      return null;
    });
  });
  ipcMain.handle("content:import", async (event) => {
    const window = trusted(event);
    return run(async () => {
      const result = await dialog.showOpenDialog(window, {
        title: "Nhập modpack Modrinth / CurseForge",
        properties: ["openFile"],
        filters: [{ name: "Modpack", extensions: ["mrpack", "zip"] }],
      });
      if (result.canceled) return null;
      await operation((staging, signal) =>
        importArchive(result.filePaths[0], staging, signal),
      );
      return null;
    });
  });
  app.on("before-quit", cancelContent);
}
