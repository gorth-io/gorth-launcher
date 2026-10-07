import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  shell,
} from "electron";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { z } from "zod";
import type { createLibraryStore } from "@/services/library-store";
import { gameIsBusy, synchronizeGameLibrary } from "@/lib/game/service";
import { contentIsBusy } from "@/lib/content/state";
import { supportedLoader } from "@/lib/game/catalog";
import type { Instance } from "@/lib/utils/interface";
import { formatFilenameTimestamp } from "@/lib/utils/formatter";
import type {
  InstanceDataCommand,
  InstanceDataResult,
  InstanceDataSnapshot,
} from "./interface";
import {
  jsonIfExists,
  locateImportRoot,
  safeExtract,
  writeExportMetadata,
  zipDirectory,
} from "./archive";
import {
  nbtString,
  readServersNbt,
  serverCompounds,
  setNbtString,
  setServerCompounds,
  writeServersNbt,
} from "./nbt";

const id = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
const leaf = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      path.basename(value) === value &&
      ![...value].some((character) => character.charCodeAt(0) < 32),
    "Tên file không hợp lệ.",
  );
const server = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(255),
});
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("notes.save"),
    instanceId: id,
    notes: z.string().max(100_000),
  }),
  z.object({ action: z.literal("world.backup"), instanceId: id, world: leaf }),
  z.object({
    action: z.literal("world.restore"),
    instanceId: id,
    world: leaf,
    backup: leaf,
  }),
  z.object({ action: z.literal("world.delete"), instanceId: id, world: leaf }),
  z.object({
    action: z.literal("backup.delete"),
    instanceId: id,
    world: leaf,
    backup: leaf,
  }),
  z.object({
    action: z.enum([
      "screenshot.open",
      "screenshot.reveal",
      "screenshot.delete",
      "screenshot.preview",
    ]),
    instanceId: id,
    name: leaf,
  }),
  z.object({
    action: z.literal("server.save"),
    instanceId: id,
    index: z.number().int().min(0).max(10000).nullable(),
    server,
  }),
  z.object({
    action: z.literal("server.delete"),
    instanceId: id,
    index: z.number().int().min(0).max(10000),
  }),
  z.object({
    action: z.literal("log.read"),
    instanceId: id,
    kind: z.enum(["log", "crash"]),
    name: leaf,
  }),
]);
async function exists(file: string) {
  try {
    return await lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function safeDirectory(file: string) {
  const info = await lstat(file);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Thư mục instance không an toàn.");
}
async function folderSize(root: string): Promise<number> {
  let size = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const info = await lstat(path.join(root, entry.name));
    if (info.isSymbolicLink()) throw new Error("Dữ liệu chứa symlink.");
    if (info.isDirectory())
      size += await folderSize(path.join(root, entry.name));
    else if (info.isFile()) size += info.size;
  }
  return size;
}

export function registerInstanceDataIpc(
  library: Awaited<ReturnType<typeof createLibraryStore>>,
) {
  const root = () =>
    path.join(app.getPath("userData"), "minecraft", "instances");
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted instance-data sender");
    return window;
  };
  const game = (instanceId: string) => {
    library.getInstance(id.parse(instanceId));
    return path.join(root(), instanceId, "game");
  };
  const ensureIdle = () => {
    if (gameIsBusy() || contentIsBusy() || library.isWorking())
      throw new Error("Hãy dừng game và chờ các tác vụ hiện tại hoàn tất.");
  };
  async function servers(gameRoot: string) {
    const file = path.join(gameRoot, "servers.dat");
    if (!(await exists(file))) return { root: {}, items: [] };
    const nbt = readServersNbt(await readFile(file));
    return { root: nbt, items: serverCompounds(nbt) };
  }
  async function listFiles(directory: string, extensions: string[]) {
    if (!(await exists(directory))) return [];
    await safeDirectory(directory);
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !extensions.some((extension) =>
          entry.name.toLowerCase().endsWith(extension),
        )
      )
        continue;
      const info = await stat(path.join(directory, entry.name));
      result.push({
        name: entry.name,
        size: info.size,
        modifiedAt: info.mtimeMs,
      });
    }
    return result.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  async function snapshot(instanceId: string): Promise<InstanceDataSnapshot> {
    const gameRoot = game(instanceId),
      saves = path.join(gameRoot, "saves"),
      backupRoot = path.join(root(), instanceId, "backups"),
      worlds = [];
    if (await exists(saves)) {
      await safeDirectory(saves);
      for (const entry of await readdir(saves, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const directory = path.join(saves, entry.name),
          info = await lstat(directory);
        if (info.isSymbolicLink()) continue;
        worlds.push({
          name: entry.name,
          size: await folderSize(directory),
          modifiedAt: info.mtimeMs,
          backups: await listFiles(path.join(backupRoot, entry.name), [".zip"]),
        });
      }
    }
    const serverData = await servers(gameRoot);
    let notes = "";
    try {
      notes = await readFile(path.join(root(), instanceId, "notes.md"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return {
      instanceId,
      worlds: worlds.sort((a, b) => b.modifiedAt - a.modifiedAt),
      screenshots: await listFiles(path.join(gameRoot, "screenshots"), [
        ".png",
        ".jpg",
        ".jpeg",
      ]),
      servers: serverData.items.map((item) => ({
        name: nbtString(item, "name"),
        address: nbtString(item, "ip"),
      })),
      notes,
      logs: [
        ...(
          await listFiles(path.join(gameRoot, "logs"), [".log", ".log.gz"])
        ).map((item) => ({ ...item, kind: "log" as const })),
        ...(
          await listFiles(path.join(gameRoot, "crash-reports"), [
            ".txt",
            ".log",
          ])
        ).map((item) => ({ ...item, kind: "crash" as const })),
      ],
    };
  }
  const run = async <T>(
    work: () => Promise<T>,
  ): Promise<InstanceDataResult<T>> => {
    try {
      return { ok: true, data: await work() };
    } catch (error) {
      console.error("Instance data operation failed", error);
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Không xử lý được dữ liệu instance.",
      };
    }
  };
  ipcMain.handle("instance-data:snapshot", (event, raw) => {
    trusted(event);
    return run(() => snapshot(id.parse(raw?.instanceId)));
  });
  ipcMain.handle("instance-data:command", (event, raw: unknown) => {
    trusted(event);
    return run(async () => {
      const input = command.parse(raw) as InstanceDataCommand,
        gameRoot = game(input.instanceId),
        instanceRoot = path.join(root(), input.instanceId);
      if (input.action === "log.read") {
        const file = path.join(
            gameRoot,
            input.kind === "log" ? "logs" : "crash-reports",
            input.name,
          ),
          info = await stat(file);
        if (info.size > 16 * 1024 ** 2)
          throw new Error("Log vượt giới hạn 16 MB.");
        const rawLog = await readFile(file),
          content = input.name.endsWith(".gz")
            ? (await promisify(gunzip)(rawLog))
                .subarray(-2 * 1024 ** 2)
                .toString("utf8")
            : rawLog.subarray(-2 * 1024 ** 2).toString("utf8");
        return { content, snapshot: await snapshot(input.instanceId) };
      }
      if (input.action === "screenshot.preview") {
        if (!/\.(png|jpe?g|webp)$/i.test(input.name))
          throw new Error("Định dạng ảnh không hỗ trợ.");
        const directory = path.join(gameRoot, "screenshots");
        const file = path.join(directory, input.name);
        for (const target of [
          app.getPath("userData"),
          path.dirname(root()),
          root(),
          instanceRoot,
          gameRoot,
          directory,
          file,
        ]) {
          if ((await lstat(target)).isSymbolicLink())
            throw new Error("Không đọc ảnh qua symlink.");
        }
        const info = await stat(file);
        if (!info.isFile() || info.size > 16 * 1024 ** 2)
          throw new Error("Ảnh vượt giới hạn 16 MB.");
        const image = nativeImage.createFromBuffer(await readFile(file));
        if (image.isEmpty()) throw new Error("Không đọc được ảnh.");
        const size = image.getSize();
        const thumbnail = image.resize({ width: Math.min(640, size.width) });
        return {
          content: thumbnail.toDataURL(),
          snapshot: await snapshot(input.instanceId),
        };
      }
      if (
        input.action === "screenshot.open" ||
        input.action === "screenshot.reveal"
      ) {
        const file = path.join(gameRoot, "screenshots", input.name);
        if (!(await exists(file)))
          throw new Error("Không tìm thấy screenshot.");
        if (input.action === "screenshot.open") {
          const message = await shell.openPath(file);
          if (message) throw new Error(message);
        } else shell.showItemInFolder(file);
        return { snapshot: await snapshot(input.instanceId) };
      }
      ensureIdle();
      if (input.action === "notes.save") {
        await mkdir(instanceRoot, { recursive: true });
        const temporary = path.join(instanceRoot, "notes.md.tmp");
        await writeFile(temporary, input.notes);
        await rename(temporary, path.join(instanceRoot, "notes.md"));
      } else if (input.action === "world.backup") {
        const source = path.join(gameRoot, "saves", input.world),
          directory = path.join(instanceRoot, "backups", input.world);
        await safeDirectory(source);
        await mkdir(directory, { recursive: true });
        await zipDirectory(
          source,
          path.join(directory, formatFilenameTimestamp(new Date()) + ".zip"),
        );
      } else if (input.action === "world.restore") {
        const archive = path.join(
            instanceRoot,
            "backups",
            input.world,
            input.backup,
          ),
          saves = path.join(gameRoot, "saves"),
          temporary = await mkdtemp(
            path.join(app.getPath("temp"), "gorth-restore-"),
          );
        try {
          await safeExtract(archive, temporary);
          await mkdir(saves, { recursive: true });
          const target = path.join(saves, input.world);
          if (await exists(target))
            await zipDirectory(
              target,
              path.join(
                instanceRoot,
                "backups",
                input.world,
                formatFilenameTimestamp(new Date()) + "-before-restore.zip",
              ),
            );
          await rm(target, { recursive: true, force: true });
          await rename(temporary, target);
        } catch (error) {
          await rm(temporary, { recursive: true, force: true });
          throw error;
        }
      } else if (input.action === "world.delete")
        await rm(path.join(gameRoot, "saves", input.world), {
          recursive: true,
          force: false,
        });
      else if (input.action === "backup.delete")
        await rm(path.join(instanceRoot, "backups", input.world, input.backup));
      else if (input.action === "screenshot.delete")
        await rm(path.join(gameRoot, "screenshots", input.name));
      else if (
        input.action === "server.save" ||
        input.action === "server.delete"
      ) {
        const current = await servers(gameRoot),
          items = current.items;
        if (input.action === "server.save") {
          const item = input.index === null ? {} : items[input.index];
          if (!item) throw new Error("Không tìm thấy server.");
          setNbtString(item, "name", input.server.name);
          setNbtString(item, "ip", input.server.address);
          if (input.index === null) items.push(item);
        } else {
          if (!items[input.index]) throw new Error("Không tìm thấy server.");
          items.splice(input.index, 1);
        }
        setServerCompounds(current.root, items);
        await mkdir(gameRoot, { recursive: true });
        const temporary = path.join(gameRoot, "servers.dat.tmp");
        await writeFile(temporary, writeServersNbt(current.root));
        await rename(temporary, path.join(gameRoot, "servers.dat"));
      }
      return { snapshot: await snapshot(input.instanceId) };
    });
  });
  ipcMain.handle("instance-data:export", (event, raw) => {
    const window = trusted(event);
    return run(async () => {
      ensureIdle();
      const instance = library.getInstance(id.parse(raw?.instanceId));
      const selected = await dialog.showSaveDialog(window, {
        title: "Xuất instance",
        defaultPath: instance.name.replace(/[^a-zA-Z0-9._ -]/g, "_") + ".zip",
        filters: [{ name: "Instance ZIP", extensions: ["zip"] }],
      });
      if (selected.canceled || !selected.filePath) return null;
      const staging = await mkdtemp(
        path.join(app.getPath("temp"), "gorth-export-"),
      );
      try {
        await writeExportMetadata(staging, instance);
        const source = path.join(root(), instance.id, "game");
        if (await exists(source))
          await cp(source, path.join(staging, ".minecraft"), {
            recursive: true,
            dereference: false,
          });
        await mkdir(path.join(staging, "gorth-data"));
        for (const name of ["notes.md", "backups"]) {
          const extra = path.join(root(), instance.id, name);
          if (await exists(extra))
            await cp(extra, path.join(staging, "gorth-data", name), {
              recursive: true,
              dereference: false,
            });
        }
        await zipDirectory(staging, selected.filePath);
        return selected.filePath;
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    });
  });
  ipcMain.handle("instance-data:import", (event) => {
    const window = trusted(event);
    return run(async () => {
      ensureIdle();
      const selected = await dialog.showOpenDialog(window, {
        title: "Import Prism, MultiMC hoặc FTB",
        properties: ["openFile", "openDirectory"],
        filters: [{ name: "Instance archive", extensions: ["zip"] }],
      });
      if (selected.canceled || !selected.filePaths[0]) return null;
      const staging = await mkdtemp(
        path.join(app.getPath("temp"), "gorth-import-"),
      );
      try {
        const source = selected.filePaths[0],
          unpacked = path.join(staging, "source");
        if ((await stat(source)).isDirectory())
          await cp(source, unpacked, { recursive: true, dereference: false });
        else {
          await mkdir(unpacked);
          await safeExtract(source, unpacked);
        }
        const importRoot = await locateImportRoot(unpacked),
          gorth = await jsonIfExists(
            path.join(importRoot, "gorth-instance.json"),
          ),
          mmc = await jsonIfExists(path.join(importRoot, "mmc-pack.json")),
          ftb =
            (await jsonIfExists(path.join(importRoot, "instance.json"))) ??
            (await jsonIfExists(path.join(importRoot, "manifest.json")));
        const name = String(
          gorth?.name ??
            ftb?.name ??
            path.basename(source, path.extname(source)),
        ).slice(0, 60);
        let version = String(gorth?.version ?? ""),
          loader = String(gorth?.loader ?? "Vanilla"),
          loaderVersion = gorth?.loaderVersion
            ? String(gorth.loaderVersion)
            : null;
        if (mmc && Array.isArray(mmc.components))
          for (const component of mmc.components as Record<string, unknown>[]) {
            const uid = String(component.uid ?? "");
            if (uid === "net.minecraft")
              version = String(component.version ?? "");
            else if (uid.includes("fabric-loader")) {
              loader = "Fabric";
              loaderVersion = String(component.version ?? "");
            } else if (uid.includes("neoforged")) {
              loader = "NeoForge";
              loaderVersion = String(component.version ?? "");
            } else if (uid.includes("forge")) {
              loader = "Forge";
              loaderVersion = String(component.version ?? "");
            }
          }
        if (!version && ftb) {
          const minecraft = ftb.minecraft as
            Record<string, unknown> | undefined;
          version = String(
            ftb.mcVersion ?? ftb.gameVersion ?? minecraft?.version ?? "",
          );
          const match = /(fabric|neoforge|forge)[- ]?(.+)/i.exec(
            String(ftb.modLoader ?? ftb.loader ?? ""),
          );
          if (match) {
            loader =
              match[1].toLowerCase() === "fabric"
                ? "Fabric"
                : match[1].toLowerCase() === "neoforge"
                  ? "NeoForge"
                  : "Forge";
            loaderVersion = match[2];
          }
        }
        const item = { name, version, loader, loaderVersion } as Omit<
          Instance,
          "id" | "createdAt"
        >;
        if (!supportedLoader(item))
          throw new Error(
            `Runtime import ${loader} ${loaderVersion ?? ""} / Minecraft ${version} không nằm trong danh sách ổn định.`,
          );
        const payload = path.join(staging, "payload"),
          gameTarget = path.join(payload, "game");
        let chosen: string | null = null;
        for (const candidate of [
          path.join(importRoot, ".minecraft"),
          path.join(importRoot, "minecraft"),
          path.join(importRoot, "game"),
        ])
          if ((await exists(candidate))?.isDirectory()) {
            chosen = candidate;
            break;
          }
        await mkdir(payload);
        if (chosen)
          await cp(chosen, gameTarget, { recursive: true, dereference: false });
        else await mkdir(gameTarget);
        const extra = path.join(importRoot, "gorth-data");
        if ((await exists(extra))?.isDirectory()) {
          for (const name of ["notes.md", "backups"]) {
            const sourceExtra = path.join(extra, name);
            if (await exists(sourceExtra))
              await cp(sourceExtra, path.join(payload, name), {
                recursive: true,
                dereference: false,
              });
          }
        }
        const imported = await library.importInstance(item, payload);
        await synchronizeGameLibrary(library.snapshot().instances);
        for (const current of BrowserWindow.getAllWindows())
          current.webContents.send("library:changed", library.snapshot());
        return imported;
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    });
  });
}
