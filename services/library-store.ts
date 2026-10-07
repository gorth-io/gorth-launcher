import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  lstat,
  readdir,
  cp,
  rename,
  rm,
  readFile,
} from "node:fs/promises";
import { eq, asc, like } from "drizzle-orm";
import { z } from "zod";
import { openDatabase } from "@/database/client";
import { instances, settings } from "@/database/schema";
import type {
  Instance,
  LibrarySnapshot,
  PlaySession,
} from "@/lib/utils/interface";
import { supportedLoader } from "@/lib/game/catalog";
import { settingsSchema as configuration } from "@/lib/library/settings-schema";
import {
  defaultInstanceSettings,
  instanceSettingsSchema,
} from "@/lib/library/instance-settings";

const id = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
const name = z.string().trim().min(1).max(60);
const version = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,59}$/);
const loader = z.enum(["Vanilla", "Fabric", "Forge", "NeoForge", "Quilt"]);
const instance = z.object({
  id,
  name,
  version,
  loader,
  loaderVersion: z.string().max(60).nullish(),
  iconData: z.string().max(3_000_000).nullish(),
  group: z.string().trim().max(60).nullish(),
  createdAt: z.number().int().nonnegative(),
});
const trashEntry = instance.extend({
  deletedAt: z.number().int().nonnegative(),
});
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      name,
      version,
      loader: z.enum(["Vanilla", "Fabric", "Forge", "NeoForge"]),
      loaderVersion: z.string().max(60).nullish(),
    })
    .refine(
      supportedLoader,
      "Phiên bản mod loader không nằm trong danh sách được hỗ trợ.",
    ),
  z.object({ action: z.literal("rename"), id, name }),
  z.object({ action: z.literal("copy"), id, name }),
  z.object({ action: z.literal("delete"), id }),
  z.object({ action: z.literal("restore"), id }),
  z.object({
    action: z.literal("metadata"),
    id,
    group: z.string().trim().max(60).nullable(),
  }),
  z.object({
    action: z.literal("icon"),
    id,
    iconData: z.string().max(3_000_000).nullable(),
  }),
  z
    .object({
      action: z.literal("runtime"),
      id,
      version,
      loader: z.enum(["Vanilla", "Fabric", "Forge", "NeoForge"]),
      loaderVersion: z.string().max(60).nullish(),
    })
    .refine(
      supportedLoader,
      "Phiên bản mod loader không nằm trong danh sách được hỗ trợ.",
    ),
  z.object({ action: z.literal("trash.purge"), id, keepSaves: z.boolean() }),
  z.object({ action: z.literal("trash.cleanup") }),
  z.object({ action: z.literal("orphans.import") }),
  z.object({
    action: z.literal("instance.settings"),
    id,
    settings: instanceSettingsSchema,
  }),
  z.object({ action: z.literal("settings"), settings: configuration }),
  z.object({
    action: z.literal("migrate"),
    instances: z.array(instance).max(10000),
    settings: configuration,
  }),
]);

async function exists(target: string) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
async function regularTree(target: string) {
  const info = await lstat(target);
  if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))
    throw new Error(
      "Thư mục instance chứa liên kết hoặc file đặc biệt; hãy xử lý chúng trước khi sao chép.",
    );
  if (info.isDirectory())
    for (const entry of await readdir(target))
      await regularTree(path.join(target, entry));
}

export async function createLibraryStore(
  dataPath: string,
  isBusy: () => boolean,
) {
  await mkdir(dataPath, { recursive: true });
  const { client, db } = openDatabase(path.join(dataPath, "gorth-launcher.db"));
  const root = path.join(dataPath, "minecraft", "instances");
  const trashRoot = path.join(dataPath, "minecraft", ".trash");
  await mkdir(root, { recursive: true });
  await mkdir(trashRoot, { recursive: true });
  for (const directory of [path.dirname(root), root, trashRoot]) {
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error("Thư mục dữ liệu instance không được là liên kết.");
  }
  const getValue = (key: string) =>
    db.select().from(settings).where(eq(settings.key, key)).get()?.value;
  const putValue = (key: string, value: unknown) =>
    db
      .insert(settings)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value) },
      })
      .run();
  const transaction = (work: () => void) => {
    client.exec("BEGIN IMMEDIATE");
    try {
      work();
      client.exec("COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      throw error;
    }
  };
  const getInstance = (value: string) => {
    const item = db
      .select()
      .from(instances)
      .where(eq(instances.id, id.parse(value)))
      .get();
    if (!item) throw new Error("Không tìm thấy instance.");
    return item;
  };
  const snapshot = (): LibrarySnapshot => {
    const launcherSettings = configuration.parse(
      JSON.parse(
        getValue("launcher") ??
          '{"memory":4,"javaPath":"","trashRetentionDays":30,"keepSavesOnTrashCleanup":true}',
      ),
    );
    const currentInstances = db
      .select()
      .from(instances)
      .orderBy(asc(instances.createdAt))
      .all();
    return {
      instances: currentInstances,
      settings: launcherSettings,
      instanceSettings: Object.fromEntries(
        currentInstances.map((item) => {
          const stored = getValue("instance-settings:" + item.id);
          return [
            item.id,
            stored
              ? instanceSettingsSchema.parse(JSON.parse(stored))
              : defaultInstanceSettings(launcherSettings),
          ];
        }),
      ),
      trash: db
        .select()
        .from(settings)
        .where(like(settings.key, "trash:%"))
        .all()
        .map((row) => {
          const value = JSON.parse(row.value);
          return trashEntry.parse({
            ...value,
            deletedAt: value.deletedAt ?? value.createdAt,
          });
        }),
    };
  };
  // Complete or roll back interrupted filesystem operations before exposing the library.
  const pending = getValue("instance-operation");
  if (pending) {
    const op = z
      .object({ action: z.enum(["copy", "delete", "restore"]), id })
      .parse(JSON.parse(pending));
    const live = path.join(root, op.id);
    const trash = path.join(trashRoot, op.id);
    const inLibrary = !!db
      .select()
      .from(instances)
      .where(eq(instances.id, op.id))
      .get();
    if (op.action === "copy" && !inLibrary) {
      for (const target of [live, path.join(root, ".copy-" + op.id)])
        if (await exists(target)) await rm(target, { recursive: true });
    } else if (inLibrary && !(await exists(live)) && (await exists(trash)))
      await rename(trash, live);
    else if (!inLibrary && (await exists(live)) && !(await exists(trash)))
      await rename(live, trash);
    db.delete(settings).where(eq(settings.key, "instance-operation")).run();
  }
  async function purgeTrash(value: string, keepSaves: boolean) {
    const raw = JSON.parse(getValue("trash:" + id.parse(value)) ?? "null");
    const parsed = trashEntry.parse({
      ...raw,
      deletedAt: raw?.deletedAt ?? raw?.createdAt,
    });
    const directory = path.join(trashRoot, parsed.id);
    if (keepSaves) {
      const saves = path.join(directory, "game", "saves");
      if (await exists(saves)) {
        await regularTree(saves);
        const recovered = path.join(
          dataPath,
          "minecraft",
          "recovered-saves",
          parsed.id + "-" + parsed.deletedAt,
        );
        await mkdir(path.dirname(recovered), { recursive: true });
        await rename(saves, recovered);
      }
    }
    if (await exists(directory)) await rm(directory, { recursive: true });
    transaction(() => {
      db.delete(settings)
        .where(eq(settings.key, "trash:" + parsed.id))
        .run();
      db.delete(settings)
        .where(eq(settings.key, "instance-settings:" + parsed.id))
        .run();
    });
  }
  const automaticSettings = configuration.parse(
    JSON.parse(
      getValue("launcher") ??
        '{"memory":4,"javaPath":"","trashRetentionDays":30,"keepSavesOnTrashCleanup":true}',
    ),
  );
  if (automaticSettings.trashRetentionDays > 0) {
    const cutoff =
      Date.now() - automaticSettings.trashRetentionDays * 86_400_000;
    for (const row of db
      .select()
      .from(settings)
      .where(like(settings.key, "trash:%"))
      .all()) {
      const value = JSON.parse(row.value);
      if ((value.deletedAt ?? value.createdAt) < cutoff)
        await purgeTrash(
          row.key.slice("trash:".length),
          automaticSettings.keepSavesOnTrashCleanup,
        );
    }
  }
  let working = false;
  async function command(raw: unknown) {
    if (working) throw new Error("Đang xử lý thư viện. Vui lòng chờ.");
    if (
      raw &&
      typeof raw === "object" &&
      "action" in raw &&
      raw.action === "migrate" &&
      getValue("legacy-imported")
    )
      return snapshot();
    const parsed = commandSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error("Thông tin instance hoặc cài đặt không hợp lệ.");
    const c = parsed.data;
    if (
      [
        "copy",
        "delete",
        "restore",
        "instance.settings",
        "runtime",
        "icon",
        "metadata",
        "trash.purge",
        "trash.cleanup",
        "orphans.import",
      ].includes(c.action) &&
      isBusy()
    )
      throw new Error(
        "Hãy dừng game hoặc tác vụ tải trước khi thay đổi dữ liệu instance.",
      );
    working = true;
    try {
      if (c.action === "migrate") {
        if (!getValue("legacy-imported"))
          transaction(() => {
            for (const item of c.instances)
              db.insert(instances).values(item).onConflictDoNothing().run();
            if (!getValue("launcher")) putValue("launcher", c.settings);
            putValue("legacy-imported", true);
          });
      } else if (c.action === "settings") putValue("launcher", c.settings);
      else if (c.action === "instance.settings") {
        getInstance(c.id);
        putValue("instance-settings:" + c.id, c.settings);
      } else if (c.action === "create")
        db.insert(instances)
          .values({
            id: randomUUID(),
            name: c.name,
            version: c.version,
            loader: c.loader,
            loaderVersion: c.loaderVersion ?? null,
            createdAt: Date.now(),
          })
          .run();
      else if (c.action === "metadata") {
        getInstance(c.id);
        db.update(instances)
          .set({ group: c.group || null })
          .where(eq(instances.id, c.id))
          .run();
      } else if (c.action === "icon") {
        getInstance(c.id);
        db.update(instances)
          .set({ iconData: c.iconData })
          .where(eq(instances.id, c.id))
          .run();
      } else if (c.action === "runtime") {
        getInstance(c.id);
        db.update(instances)
          .set({
            version: c.version,
            loader: c.loader,
            loaderVersion: c.loaderVersion ?? null,
          })
          .where(eq(instances.id, c.id))
          .run();
        await rm(path.join(root, c.id, "installed.json"), { force: true });
      } else if (c.action === "trash.purge") {
        await purgeTrash(c.id, c.keepSaves);
      } else if (c.action === "trash.cleanup") {
        const launcherSettings = configuration.parse(
          JSON.parse(getValue("launcher")!),
        );
        for (const item of snapshot().trash)
          await purgeTrash(item.id, launcherSettings.keepSavesOnTrashCleanup);
      } else if (c.action === "orphans.import") {
        const known = new Set(snapshot().instances.map((item) => item.id));
        for (const entry of await readdir(root, { withFileTypes: true })) {
          if (
            !entry.isDirectory() ||
            entry.name.startsWith(".") ||
            known.has(entry.name) ||
            !id.safeParse(entry.name).success
          )
            continue;
          try {
            const receipt = JSON.parse(
              await readFile(
                path.join(root, entry.name, "installed.json"),
                "utf8",
              ),
            );
            const item = instance.parse({
              id: entry.name,
              name: entry.name,
              version: receipt.version,
              loader: receipt.loader ?? "Vanilla",
              loaderVersion: receipt.loaderVersion ?? null,
              iconData: null,
              group: "Đã khôi phục",
              createdAt: Math.trunc(
                (await lstat(path.join(root, entry.name))).birthtimeMs ||
                  Date.now(),
              ),
            });
            if (!supportedLoader(item)) continue;
            db.insert(instances).values(item).onConflictDoNothing().run();
          } catch {
            /* Ignore folders without valid Gorth installation metadata. */
          }
        }
      } else if (c.action === "rename") {
        getInstance(c.id);
        db.update(instances)
          .set({ name: c.name })
          .where(eq(instances.id, c.id))
          .run();
      } else if (c.action === "copy") {
        const original = getInstance(c.id);
        const copy: Instance = {
          ...original,
          id: randomUUID(),
          name: c.name,
          createdAt: Date.now(),
        };
        const source = path.join(root, original.id);
        const staging = path.join(root, ".copy-" + copy.id);
        const target = path.join(root, copy.id);
        putValue("instance-operation", { action: "copy", id: copy.id });
        try {
          if (await exists(source)) {
            await regularTree(source);
            await cp(source, staging, {
              recursive: true,
              errorOnExist: true,
              force: false,
              dereference: false,
            });
            await regularTree(staging);
            await rename(staging, target);
          }
          transaction(() => {
            db.insert(instances).values(copy).run();
            const storedSettings = getValue("instance-settings:" + original.id);
            if (storedSettings)
              putValue(
                "instance-settings:" + copy.id,
                instanceSettingsSchema.parse(JSON.parse(storedSettings)),
              );
            db.delete(settings)
              .where(eq(settings.key, "instance-operation"))
              .run();
          });
        } catch (error) {
          for (const directory of [staging, target])
            if (await exists(directory))
              await rm(directory, { recursive: true });
          db.delete(settings)
            .where(eq(settings.key, "instance-operation"))
            .run();
          throw error;
        }
      } else {
        const restoring = c.action === "restore";
        const item = restoring
          ? instance.parse(JSON.parse(getValue("trash:" + c.id) ?? "null"))
          : getInstance(c.id);
        const live = path.join(root, item.id);
        const trash = path.join(trashRoot, item.id);
        const source = restoring ? trash : live;
        const target = restoring ? live : trash;
        if (await exists(target))
          throw new Error("Thư mục đích đã tồn tại; không ghi đè dữ liệu.");
        putValue("instance-operation", { action: c.action, id: item.id });
        let moved = false;
        try {
          if (await exists(source)) {
            await rename(source, target);
            moved = true;
          }
          transaction(() => {
            if (restoring) {
              db.insert(instances).values(item).run();
              db.delete(settings)
                .where(eq(settings.key, "trash:" + item.id))
                .run();
            } else {
              putValue("trash:" + item.id, { ...item, deletedAt: Date.now() });
              db.delete(instances).where(eq(instances.id, item.id)).run();
            }
            db.delete(settings)
              .where(eq(settings.key, "instance-operation"))
              .run();
          });
        } catch (error) {
          if (moved) await rename(target, source);
          db.delete(settings)
            .where(eq(settings.key, "instance-operation"))
            .run();
          throw error;
        }
      }
      return snapshot();
    } finally {
      working = false;
    }
  }
  async function importInstance(
    value: Omit<Instance, "id" | "createdAt">,
    preparedDirectory: string,
  ) {
    if (working) throw new Error("Đang xử lý thư viện.");
    const parsed = commandSchema.parse({ action: "create", ...value });
    if (parsed.action !== "create")
      throw new Error("Yêu cầu import không hợp lệ.");
    working = true;
    const item: Instance = {
      ...value,
      id: randomUUID(),
      createdAt: Date.now(),
    };
    const destination = path.join(root, item.id);
    let moved = false;
    try {
      await regularTree(preparedDirectory);
      putValue("instance-operation", { action: "copy", id: item.id });
      await rename(preparedDirectory, destination);
      moved = true;
      transaction(() => {
        db.insert(instances).values(item).run();
        db.delete(settings).where(eq(settings.key, "instance-operation")).run();
      });
      return item;
    } catch (error) {
      if (moved) await rename(destination, preparedDirectory);
      db.delete(settings).where(eq(settings.key, "instance-operation")).run();
      throw error;
    } finally {
      working = false;
    }
  }
  return {
    snapshot,
    importInstance,
    command,
    getInstance,
    playHistory: () => {
      try {
        return z
          .array(
            z.object({
              id: z.string(),
              instanceId: id,
              startedAt: z.number(),
              endedAt: z.number(),
              duration: z.number(),
              exitCode: z.number().nullable(),
              crashed: z.boolean(),
            }),
          )
          .max(1000)
          .parse(JSON.parse(getValue("play-history") ?? "[]")) as PlaySession[];
      } catch {
        return [] as PlaySession[];
      }
    },
    recordPlaySession: (session: PlaySession) => {
      const current = (() => {
        try {
          return JSON.parse(getValue("play-history") ?? "[]") as PlaySession[];
        } catch {
          return [];
        }
      })();
      putValue("play-history", [...current, session].slice(-1000));
    },
    needsMigration: () => !getValue("legacy-imported"),
    isWorking: () => working,
    close: () => client.close(),
  };
}
