import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, lstat, readdir, cp, rename, rm } from "node:fs/promises";
import { eq, asc, like } from "drizzle-orm";
import { z } from "zod";
import { openDatabase } from "@/database/client";
import { instances, settings } from "@/database/schema";
import type { Instance, LibrarySnapshot } from "@/lib/utils/interface";
import { supportedLoader } from "@/lib/game/catalog";

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
  createdAt: z.number().int().nonnegative(),
});
const configuration = z.object({
  memory: z.number().int().min(1).max(64),
  javaPath: z.string().max(4096),
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
  const { client, db } = openDatabase(
    path.join(dataPath, "gorth-launcher.sqlite"),
  );
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
  const snapshot = (): LibrarySnapshot => ({
    instances: db
      .select()
      .from(instances)
      .orderBy(asc(instances.createdAt))
      .all(),
    settings: configuration.parse(
      JSON.parse(getValue("launcher") ?? '{"memory":4,"javaPath":""}'),
    ),
    trash: db
      .select()
      .from(settings)
      .where(like(settings.key, "trash:%"))
      .all()
      .map((row) => instance.parse(JSON.parse(row.value))),
  });
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
    if (["copy", "delete", "restore"].includes(c.action) && isBusy())
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
      else if (c.action === "create")
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
      else if (c.action === "rename") {
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
              putValue("trash:" + item.id, item);
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
    needsMigration: () => !getValue("legacy-imported"),
    isWorking: () => working,
    close: () => client.close(),
  };
}
