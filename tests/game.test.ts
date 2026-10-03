import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { download, safePath, response } from "../lib/game/files";
import {
  allowed,
  argumentsFor,
  libraryFiles,
} from "../lib/game/metadata";
import type { Version } from "../lib/utils/interface";
import { launchArguments, validateInstance } from "../lib/game/install";
import { memoryLimit } from "../lib/game/java";
import { loaderCatalog, supportedLoader, supportedRelease } from "../lib/game/catalog";
import { mergeVersion, mavenPath } from "../lib/game/loaders";
import { legacyArguments } from "../lib/game/install";

test("curated loader pairs reject Quilt, arbitrary versions and missing pins; Vanilla requires releases from 1.7.10", () => {
  for (const entry of loaderCatalog) assert(supportedLoader({ loader: entry.loader, version: entry.minecraft, loaderVersion: entry.version }));
  assert(!supportedLoader({ loader: "Quilt", version: "1.20.1", loaderVersion: "0.26.0" }));
  assert(!supportedLoader({ loader: "Forge", version: "1.21.1", loaderVersion: "47.4.10" }));
  assert(!supportedLoader({ loader: "Forge", version: "1.20.1", loaderVersion: "47.4.23" }));
  for (const version of ["1.7.10", "1.8", "1.10", "1.20.1", "1.21.1", "26.3"]) {
    assert(supportedLoader({ loader: "Vanilla", version }));
    assert(supportedRelease({ id: version, type: "release" }));
    assert(!supportedRelease({ id: version, type: "snapshot" }));
  }
  for (const version of ["1.5.2", "1.7", "1.7.9", "b1.7.3", "24w14a", "26.3-rc-3", "26.4-snapshot-2"]) {
    assert(!supportedLoader({ loader: "Vanilla", version }));
    assert(!supportedRelease({ id: version, type: "release" }));
    assert.throws(() => validateInstance({ id: "test", name: "test", loader: "Vanilla", version, createdAt: 0 }));
  }
});

test("loader inheritance merges arguments, overrides Maven versions and preserves native classifiers", () => {
  const base = { id: "1.20.1", libraries: [{ name: "org.ow2.asm:asm:9.5" }, { name: "org.lwjgl:lwjgl:3.3.1:natives-macos" }], arguments: { jvm: ["-cp", "${classpath}"], game: ["--username", "${auth_player_name}"] }, downloads: { client: { url: "client" } }, assetIndex: { id: "5" } } as Version;
  const child = { id: "fabric", inheritsFrom: "1.20.1", mainClass: "KnotClient", libraries: [{ name: "org.ow2.asm:asm:9.8" }, { name: "org.lwjgl:lwjgl:3.3.1" }], arguments: { jvm: ["-Dloader=true"], game: [] } } as unknown as Version;
  const merged = mergeVersion(base, child);
  assert.equal(merged.libraries.length, 3);
  assert.equal(merged.libraries[0].name, "org.ow2.asm:asm:9.8");
  assert.equal(merged.downloads, base.downloads);
  assert.deepEqual(merged.arguments?.jvm, ["-cp", "${classpath}", "-Dloader=true"]);
  assert.throws(() => mergeVersion(base, { ...child, inheritsFrom: "1.21.1" }));
  assert.equal(mavenPath("net.fabricmc:fabric-loader:0.16.14"), "net/fabricmc/fabric-loader/0.16.14/fabric-loader-0.16.14.jar");
  assert.deepEqual(legacyArguments('${auth_player_name} --name "a b"'), ["${auth_player_name}", "--name", "a b"]);
});

test("path and IPC instance validation block traversal and unsupported loaders", () => {
  for (const name of [
    "../escape",
    "/absolute",
    "a/../escape",
    "C:/escape",
    "a\\escape",
    "./a",
    "a//b",
  ])
    assert.throws(() => safePath("/tmp/game", name));
  assert.equal(
    safePath("/tmp/game", "libraries/client.jar"),
    "/tmp/game/libraries/client.jar",
  );
  assert.throws(() =>
    validateInstance({
      id: "../../escape",
      version: "1.20.1",
      name: "test",
      loader: "Vanilla",
      createdAt: 0,
    }),
  );
  assert.throws(() =>
    validateInstance({
      id: "valid",
      version: "1.20.1",
      name: "test",
      loader: "Forge",
      createdAt: 0,
    }),
  );
  assert.throws(() => memoryLimit(0));
  assert.throws(() => memoryLimit(2.5));
});
test("Minecraft rules use ordered overrides, OS/arch and feature matching", () => {
  const context = {
    platform: "osx",
    architecture: "aarch64",
    version: "23.0",
    features: { has_custom_resolution: true },
  };
  assert(allowed(undefined, context));
  assert(!allowed([{ action: "allow", os: { name: "windows" } }], context));
  assert(
    !allowed(
      [{ action: "allow" }, { action: "disallow", os: { name: "osx" } }],
      context,
    ),
  );
  assert(
    allowed(
      [{ action: "allow", os: { name: "osx", arch: "aarch64" } }],
      context,
    ),
  );
  assert(
    !allowed([{ action: "allow", features: { is_demo_user: true } }], context),
  );
  assert(
    allowed(
      [{ action: "allow", features: { has_custom_resolution: true } }],
      context,
    ),
  );
  assert.deepEqual(
    argumentsFor(
      [
        "--name",
        "${name}",
        {
          rules: [{ action: "allow", features: { is_demo_user: true } }],
          value: "--demo",
        },
      ],
      { name: "Player" },
    ),
    ["--name", "Player"],
  );
  assert.throws(() => argumentsFor(["${missing}"], {}));
});
test("launch command preserves arguments as array, keeps token out of metadata and requires online injector", () => {
  const version = {
    id: "1.20.1",
    type: "release",
    mainClass: "net.minecraft.client.main.Main",
    javaVersion: { majorVersion: 17 },
    assetIndex: { id: "5" },
    libraries: [],
    arguments: {
      jvm: ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"],
      game: [
        "--username",
        "${auth_player_name}",
        "--accessToken",
        "${auth_access_token}",
        "--gameDir",
        "${game_directory}",
      ],
    },
  } as unknown as Version;
  const game = {
    version,
    java: "/temurin/bin/java",
    gameDir: "/tmp/space in game",
    natives: "/tmp/natives",
    classpath: ["/tmp/a.jar", "/tmp/space lib.jar"],
    root: "/tmp/game",
  };
  const session = {
    username: "Player",
    uuid: "0".repeat(32),
    accessToken: "private-token",
    authlibRoot: null,
  };
  const args = launchArguments(game, session, 1);
  assert(args.includes("-Xmx1G"));
  assert(args.includes("/tmp/space in game"));
  assert(args.includes("private-token"));
  assert.equal(
    args[args.indexOf("-cp") + 1],
    game.classpath.join(path.delimiter),
  );
  assert.throws(() =>
    launchArguments(
      game,
      { ...session, authlibRoot: "https://auth.example.com" },
      1,
    ),
  );
  assert(
    launchArguments(
      game,
      { ...session, authlibRoot: "https://auth.example.com" },
      1,
      "/tmp/agent.jar",
    ).includes("-javaagent:/tmp/agent.jar=https://auth.example.com"),
  );
  assert.deepEqual(libraryFiles(version, "/tmp/game"), {
    jars: [],
    natives: [],
  });
});
test("downloads verify hash, repair corrupt files, reuse cache and clean partial failures", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-download-test-"));
  const file = path.join(root, "file.jar");
  const bytes = Buffer.from("verified artifact");
  const sha1 = createHash("sha1").update(bytes).digest("hex");
  const realFetch = globalThis.fetch;
  let calls = 0;
  let bad = false;
  globalThis.fetch = async () => {
    calls++;
    return new Response(bad ? Buffer.from("corrupted content") : bytes);
  };
  try {
    const artifact = {
      url: "https://libraries.minecraft.net/example.jar",
      sha1,
      size: bytes.length,
    };
    const signal = new AbortController().signal;
    await download(artifact, file, signal);
    assert.equal(calls, 1);
    assert.deepEqual(await readFile(file), bytes);
    await download(artifact, file, signal);
    assert.equal(calls, 1);
    await writeFile(file, "broken");
    await download(artifact, file, signal);
    assert.equal(calls, 2);
    bad = true;
    await assert.rejects(
      download(artifact, path.join(root, "bad.jar"), signal),
    );
    assert(!(await readdir(root)).some((name) => name.endsWith(".part")));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      download(artifact, path.join(root, "cancelled.jar"), controller.signal),
    );
    await assert.rejects(
      response("http://libraries.minecraft.net/example.jar", signal),
    );
    await assert.rejects(
      response("https://evil.example.com/example.jar", signal),
    );
  } finally {
    globalThis.fetch = realFetch;
    await rm(root, { recursive: true, force: true });
  }
});
