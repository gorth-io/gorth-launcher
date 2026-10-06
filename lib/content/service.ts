import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import type { createLibraryStore } from "@/services/library-store";
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
import {
  installSchema,
  inventorySchema,
  manageSchema,
  querySchema,
  versionsSchema,
} from "./schema";
import {
  contentInventory,
  installMods,
  mutateExternalContent,
  mutateInstalledContent,
  regularDirectory,
} from "./install";
import { mergeModpackUpdate, setModpackSource, unpackPack } from "./packs";
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
  ipcMain.handle("content:inventory", (event, raw) => {
    trusted(event);
    return run(async () => {
      const input = inventorySchema.parse(raw);
      library.getInstance(input.instanceId);
      return contentInventory(root(), input.instanceId);
    });
  });
  ipcMain.handle("content:updates", (event, raw) => {
    trusted(event);
    return run(async () => {
      const input = inventorySchema.parse(raw);
      const instance = library.getInstance(input.instanceId);
      const inventory = await contentInventory(root(), input.instanceId);
      for (const item of inventory.items) {
        if (!item.provider || !item.projectId || !item.versionId) continue;
        const query = querySchema.parse({
          provider: item.provider,
          kind: item.kind,
          query: "",
          version: instance.version,
          loader: instance.loader,
          offset: 0,
        });
        const latest = (
          await contentVersions(
            query,
            item.projectId,
            AbortSignal.timeout(45_000),
          )
        )[0];
        if (latest && latest.id !== item.versionId) item.update = latest;
      }
      return inventory;
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
    source: {
      provider: "modrinth" | "curseforge";
      projectId: string;
      versionId: string;
    } | null = null,
  ) {
    updateContent("Kiểm tra modpack…");
    const item = await unpackPack(archive, staging, signal, updateContent);
    await setModpackSource(path.join(staging, "payload"), source);
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
          if (input.query.kind === "shader") {
            if (!["Fabric", "NeoForge"].includes(instance.loader))
              throw new Error(
                "Tự động cài Iris yêu cầu instance Fabric hoặc NeoForge được hỗ trợ.",
              );
            const irisQuery = querySchema.parse({
              ...query,
              provider: "modrinth",
              kind: "mod",
              query: "",
            });
            const irisVersion = (
              await contentVersions(irisQuery, "YL57xq9U", signal)
            )[0];
            if (!irisVersion)
              throw new Error("Không tìm thấy Iris release tương thích.");
            const irisFiles = await resolveMods(
              irisQuery,
              "YL57xq9U",
              irisVersion.id,
              signal,
            );
            await installMods(
              root(),
              instance.id,
              "modrinth",
              irisFiles,
              staging,
              signal,
              updateContent,
            );
          }
          await installMods(
            root(),
            instance.id,
            query.provider,
            files,
            staging,
            signal,
            updateContent,
            { worldName: input.worldName },
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
          await importArchive(archive, staging, signal, {
            provider: input.query.provider,
            projectId: input.projectId,
            versionId: input.versionId,
          });
        }
      });
      return null;
    });
  });
  ipcMain.handle("content:manage", (event, raw) => {
    trusted(event);
    return run(async () => {
      const input = manageSchema.parse(raw);
      const instance = library.getInstance(input.instanceId);
      await operation(async (staging, signal) => {
        if (input.action !== "update") {
          const item = (await contentInventory(root(), instance.id)).items.find(
            (entry) => entry.id === input.id,
          );
          if (!item) throw new Error("Không tìm thấy nội dung đã cài.");
          if (item.managed)
            await mutateInstalledContent(
              root(),
              instance.id,
              input.id,
              input.action,
            );
          else
            await mutateExternalContent(
              root(),
              instance.id,
              item,
              input.action,
            );
          return;
        }
        const inventory = await contentInventory(root(), instance.id);
        const item = inventory.items.find((entry) => entry.id === input.id);
        if (!item?.provider || !item.projectId || !item.versionId)
          throw new Error("Nội dung này không có metadata để cập nhật.");
        if (item.modified && item.kind !== "modpack")
          throw new Error("File đã được người dùng thay đổi; không tự ghi đè.");
        const query = querySchema.parse({
          provider: item.provider,
          kind: item.kind,
          query: "",
          version: instance.version,
          loader: instance.loader,
          offset: 0,
        });
        const latest = (
          await contentVersions(query, item.projectId, signal)
        )[0];
        if (!latest || latest.id === item.versionId)
          throw new Error("Nội dung đã ở phiên bản release mới nhất.");
        if (item.kind === "modpack") {
          const file = await resolveContentFile(
            query,
            item.projectId,
            latest.id,
            signal,
          );
          const archive = path.join(staging, "pack-update.zip");
          await download(file.artifact, archive, signal);
          const updateRoot = path.join(staging, "update");
          const runtime = await unpackPack(
            archive,
            updateRoot,
            signal,
            updateContent,
          );
          if (
            runtime.version !== instance.version ||
            runtime.loader !== instance.loader ||
            (runtime.loaderVersion ?? null) !== (instance.loaderVersion ?? null)
          )
            throw new Error(
              "Bản modpack mới đổi Minecraft/loader; hãy cài thành instance mới.",
            );
          const payload = path.join(updateRoot, "payload");
          await setModpackSource(payload, {
            provider: item.provider,
            projectId: item.projectId,
            versionId: latest.id,
          });
          await mergeModpackUpdate(
            path.join(root(), "instances", instance.id),
            payload,
          );
          return;
        }
        const files = await resolveMods(
          query,
          item.projectId,
          latest.id,
          signal,
        );
        await installMods(
          root(),
          instance.id,
          item.provider,
          files,
          staging,
          signal,
          updateContent,
          { worldName: item.worldName, replace: true },
        );
      });
      return contentInventory(root(), instance.id);
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
