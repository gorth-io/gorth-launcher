import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  symlink,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createLibraryStore } from "@/services/library-store";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";

test("upgrade version-one database preserves existing instances and atomically imports a prepared pack", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-library-test-"));
  const old = new DatabaseSync(path.join(root, "gorth-launcher.db"));
  old.exec(
    "CREATE TABLE instances(id TEXT PRIMARY KEY,name TEXT NOT NULL,version TEXT NOT NULL,loader TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO instances VALUES('existing','World','1.20.1','Vanilla',1); PRAGMA user_version=1;",
  );
  old.close();
  const store = await createLibraryStore(root, () => false);
  try {
    assert.equal(store.snapshot().instances[0].name, "World");
    assert.equal(store.snapshot().instances[0].loaderVersion, null);
    const prepared = path.join(root, "prepared");
    await mkdir(path.join(prepared, "game/config"), { recursive: true });
    await writeFile(
      path.join(prepared, "game/config/example.txt"),
      "pack-data",
    );
    await assert.rejects(
      store.importInstance(
        {
          name: "Unsupported",
          version: "1.20.1",
          loader: "Quilt",
          loaderVersion: "0.1",
        },
        prepared,
      ),
    );
    assert.equal(store.snapshot().instances.length, 1);
    const imported = await store.importInstance(
      {
        name: "Imported",
        version: "1.20.1",
        loader: "Fabric",
        loaderVersion: "0.16.14",
      },
      prepared,
    );
    assert.equal(
      await readFile(
        path.join(
          root,
          "minecraft/instances",
          imported.id,
          "game/config/example.txt",
        ),
        "utf8",
      ),
      "pack-data",
    );
    assert.equal(store.snapshot().instances.length, 2);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("loader pins survive SQLite restart, copy, trash and restore; unsupported pairs are rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-library-test-"));
  let store = await createLibraryStore(root, () => false);
  try {
    const preset = {
      action: "create",
      name: "Forge",
      version: "1.20.1",
      loader: "Forge",
      loaderVersion: "47.4.10",
    };
    await store.command(preset);
    await assert.rejects(store.command({ ...preset, loaderVersion: "latest" }));
    await assert.rejects(store.command({ ...preset, loader: "Quilt" }));
    const original = store.snapshot().instances[0];
    const configured = {
      ...defaultInstanceSettings({ memory: 4, javaPath: "" }),
      memoryMin: 2,
      memoryMax: 6,
      jvmArguments: ["-XX:+UseG1GC"],
      environment: { EXAMPLE: "value" },
      accountId: "offline:test",
    };
    await store.command({
      action: "instance.settings",
      id: original.id,
      settings: configured,
    });
    await store.command({ action: "copy", id: original.id, name: "Copy" });
    await store.command({ action: "delete", id: original.id });
    store.close();
    store = await createLibraryStore(root, () => false);
    assert.equal(store.snapshot().trash[0].loaderVersion, "47.4.10");
    await store.command({ action: "restore", id: original.id });
    assert(
      store
        .snapshot()
        .instances.every((item) => item.loaderVersion === "47.4.10"),
    );
    assert.deepEqual(
      store.snapshot().instanceSettings[original.id],
      configured,
    );
    const copy = store
      .snapshot()
      .instances.find((item) => item.id !== original.id)!;
    assert.deepEqual(store.snapshot().instanceSettings[copy.id], configured);
  } finally {
    store.close();
    await rm(root, { recursive: true });
  }
});

test("SQLite migration is idempotent, settings and rename persist across restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-library-test-"));
  let store = await createLibraryStore(root, () => false);
  try {
    const legacy = {
      id: "legacy",
      name: "World",
      version: "1.20.1",
      loader: "Vanilla",
      createdAt: 1,
    };
    await store.command({
      action: "migrate",
      instances: [legacy],
      settings: { memory: 3, javaPath: "/java" },
    });
    await store.command({ action: "rename", id: "legacy", name: "Renamed" });
    await store.command({
      action: "settings",
      settings: { memory: 6, javaPath: "", showTitlebarLogo: false },
    });
    store.close();
    store = await createLibraryStore(root, () => false);
    await store.command({
      action: "migrate",
      instances: [legacy],
      settings: { memory: 3, javaPath: "/java" },
    });
    assert.equal(store.snapshot().instances.length, 1);
    assert.equal(store.snapshot().instances[0].name, "Renamed");
    assert.equal(store.snapshot().settings.memory, 6);
    assert.equal(store.snapshot().settings.showTitlebarLogo, false);
    await store.command({ action: "delete", id: "legacy" });
    await store.command({
      action: "migrate",
      instances: [legacy],
      settings: { memory: 3, javaPath: "" },
    });
    assert.equal(store.snapshot().instances.length, 0);
    assert.equal(store.snapshot().trash.length, 1);
  } finally {
    store.close();
    await rm(root, { recursive: true });
  }
});

test("copy is independent, delete moves worlds to trash, restore survives restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-library-test-"));
  let busy = false;
  let store = await createLibraryStore(root, () => busy);
  try {
    await store.command({
      action: "create",
      name: "Original",
      version: "1.20.1",
      loader: "Vanilla",
    });
    const original = store.snapshot().instances[0];
    const world = path.join(
      root,
      "minecraft",
      "instances",
      original.id,
      "game",
      "saves",
      "World",
    );
    await mkdir(world, { recursive: true });
    await writeFile(path.join(world, "level.dat"), "world-data");
    busy = true;
    await assert.rejects(
      store.command({ action: "delete", id: original.id }),
      /dừng game/,
    );
    await assert.rejects(
      store.command({ action: "copy", id: original.id, name: "Copy" }),
      /dừng game/,
    );
    busy = false;
    await store.command({ action: "copy", id: original.id, name: "Copy" });
    const copy = store
      .snapshot()
      .instances.find((item) => item.id !== original.id)!;
    const copiedFile = path.join(
      root,
      "minecraft",
      "instances",
      copy.id,
      "game",
      "saves",
      "World",
      "level.dat",
    );
    assert.equal(await readFile(copiedFile, "utf8"), "world-data");
    await writeFile(copiedFile, "independent");
    assert.equal(
      await readFile(path.join(world, "level.dat"), "utf8"),
      "world-data",
    );
    await store.command({ action: "delete", id: original.id });
    await assert.rejects(readFile(path.join(world, "level.dat")), {
      code: "ENOENT",
    });
    store.close();
    store = await createLibraryStore(root, () => false);
    await store.command({ action: "restore", id: original.id });
    assert.equal(
      await readFile(path.join(world, "level.dat"), "utf8"),
      "world-data",
    );
    assert.equal(store.snapshot().trash.length, 0);
    assert.equal(store.snapshot().instances.length, 2);
    await assert.rejects(store.command({ action: "delete", id: "../escape" }));
    await assert.rejects(
      store.command({ action: "rename", id: copy.id, name: " " }),
    );
    await assert.rejects(
      store.command({
        action: "settings",
        settings: { memory: -1, javaPath: "" },
      }),
    );
    await symlink(
      world,
      path.join(root, "minecraft", "instances", copy.id, "linked-world"),
    );
    await assert.rejects(
      store.command({ action: "copy", id: copy.id, name: "Unsafe" }),
      /liên kết/,
    );
    assert.equal(store.snapshot().instances.length, 2);
  } finally {
    store.close();
    await rm(root, { recursive: true });
  }
});

test("startup rolls back interrupted trash move without losing a world", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-library-test-"));
  let store = await createLibraryStore(root, () => false);
  try {
    await store.command({
      action: "create",
      name: "Recovery",
      version: "1.20.1",
      loader: "Vanilla",
    });
    const item = store.snapshot().instances[0];
    store.close();
    const live = path.join(root, "minecraft", "instances", item.id);
    await mkdir(live, { recursive: true });
    await writeFile(path.join(live, "world.dat"), "recover-me");
    const db = new DatabaseSync(path.join(root, "gorth-launcher.db"));
    db.prepare("INSERT INTO settings(key,value) VALUES (?,?)").run(
      "instance-operation",
      JSON.stringify({ action: "delete", id: item.id }),
    );
    db.close();
    await rename(live, path.join(root, "minecraft", ".trash", item.id));
    store = await createLibraryStore(root, () => false);
    assert.equal(
      await readFile(path.join(live, "world.dat"), "utf8"),
      "recover-me",
    );
    assert.equal(store.snapshot().instances.length, 1);
  } finally {
    store.close();
    await rm(root, { recursive: true });
  }
});

test("advanced lifecycle stores icon/group, changes runtime, recovers saves and imports orphans", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "gorth-library-lifecycle-"),
  );
  const store = await createLibraryStore(root, () => false);
  try {
    await store.command({
      action: "create",
      name: "Lifecycle",
      version: "1.20.1",
      loader: "Vanilla",
    });
    const item = store.snapshot().instances[0],
      directory = path.join(root, "minecraft", "instances", item.id);
    await mkdir(path.join(directory, "game", "saves", "World"), {
      recursive: true,
    });
    await writeFile(
      path.join(directory, "game", "saves", "World", "level.dat"),
      "save",
    );
    await writeFile(path.join(directory, "installed.json"), "old receipt");
    await store.command({ action: "metadata", id: item.id, group: "Survival" });
    await store.command({
      action: "icon",
      id: item.id,
      iconData: "data:image/png;base64,AA==",
    });
    await store.command({
      action: "runtime",
      id: item.id,
      version: "1.20.1",
      loader: "Forge",
      loaderVersion: "47.4.10",
    });
    assert.equal(store.snapshot().instances[0].group, "Survival");
    assert.equal(store.snapshot().instances[0].loader, "Forge");
    await assert.rejects(readFile(path.join(directory, "installed.json")), {
      code: "ENOENT",
    });
    await store.command({ action: "delete", id: item.id });
    await store.command({
      action: "trash.purge",
      id: item.id,
      keepSaves: true,
    });
    const recoveredRoot = path.join(root, "minecraft", "recovered-saves");
    const recovered = await readdir(recoveredRoot);
    assert.equal(
      await readFile(
        path.join(recoveredRoot, recovered[0], "World", "level.dat"),
        "utf8",
      ),
      "save",
    );

    const orphan = path.join(root, "minecraft", "instances", "orphan-instance");
    await mkdir(path.join(orphan, "game"), { recursive: true });
    await writeFile(
      path.join(orphan, "installed.json"),
      JSON.stringify({
        version: "1.20.1",
        loader: "Vanilla",
        loaderVersion: null,
      }),
    );
    await store.command({ action: "orphans.import" });
    assert.equal(store.snapshot().instances[0].id, "orphan-instance");
    assert.equal(store.snapshot().instances[0].group, "Đã khôi phục");
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
