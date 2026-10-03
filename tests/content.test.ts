import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { contentPath, packRuntime, unpackPack } from "../lib/content/packs";
import { installMods } from "../lib/content/install";
import { contentVersions, resolveContentFile, resolveMods, searchContent } from "../lib/content/providers";
import { allowedContentWebsite, projectWebsite } from "../lib/content/website";
import { querySchema } from "../lib/content/schema";
import type { ContentQuery } from "../lib/content/interface";
import { getJavaEnvironment } from "../lib/utils/environment";
const signal = () => new AbortController().signal;
const query: ContentQuery = { provider: "modrinth", kind: "mod", query: "test", version: "1.20.1", loader: "Fabric", offset: 0 };
const sha = (value: string, algorithm = "sha1") => createHash(algorithm).update(value).digest("hex");

test("content website addresses reject local files, spoofed hosts and unsafe schemes", () => {
  assert(allowedContentWebsite(projectWebsite("modrinth", "mod", "just-enough-filtering-(jef)")));
  for (const provider of ["modrinth", "curseforge"] as const)
    for (const kind of ["mod", "modpack", "shader", "resourcepack"] as const)
      assert(allowedContentWebsite(projectWebsite(provider, kind, "example-project")));
  for (const url of ["file:///etc/passwd", "javascript:alert(1)", "https://modrinth.com.evil.test/mod/a", "https://user@modrinth.com/mod/a", "https://www.curseforge.com:444/minecraft/modpacks/a", "https://modrinth.com/"])
    assert(!allowedContentWebsite(url));
});

test("shader and texture search use content categories without mod-loader filters, and ZIPs install into their own directories", async () => {
  const original = globalThis.fetch;
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-assets-test-"));
  try {
    for (const kind of ["shader", "resourcepack"] as const) {
      const request = { ...query, kind, loader: "Vanilla" };
      assert(querySchema.safeParse(request).success);
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        assert(!url.searchParams.has("modLoaderType"));
        if (url.hostname === "api.curseforge.com") {
          assert.equal(url.searchParams.get("classId"), kind === "shader" ? "6552" : "12");
          return Response.json({ data: [{ id: 1, slug: "sample", name: "Sample", summary: "Sample", downloadCount: 1 }], pagination: { totalCount: 1 } });
        }
        const facets = JSON.parse(url.searchParams.get("facets")!);
        assert.deepEqual(facets, [["project_type:" + kind], ["versions:1.20.1"]]);
        return Response.json({ hits: [{ project_id: "sample", slug: "sample", title: "Sample", description: "Sample", downloads: 1 }], total_hits: 1 });
      };
      for (const provider of ["modrinth", "curseforge"] as const) {
        const result = await searchContent({ ...request, provider }, signal());
        assert(allowedContentWebsite(result.projects[0].url));
      }
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        assert(!url.searchParams.has("loaders"));
        const version = { id: "release", project_id: "sample", name: "Sample", version_type: "release", game_versions: ["1.20.1"], loaders: [kind === "shader" ? "iris" : "minecraft"], files: [{ filename: "sample.zip", url: "https://cdn.modrinth.com/sample.zip", size: 4, primary: true, hashes: { sha1: sha("data") } }], dependencies: [] };
        if (url.pathname.includes("/project/sample/version")) return Response.json([version, { ...version, id: "beta", version_type: "beta" }]);
        if (url.pathname.includes("/version/release")) return Response.json(version);
        return Response.json({ project_type: kind, client_side: "required" });
      };
      assert.deepEqual((await contentVersions(request, "sample", signal())).map((v) => v.id), ["release"]);
      const file = await resolveContentFile(request, "sample", "release", signal());
      assert.equal(file.directory, kind === "shader" ? "shaderpacks" : "resourcepacks");
      assert.deepEqual(await resolveMods(request, "sample", "release", signal()), [file]);
      globalThis.fetch = async () => new Response("data");
      const stage = path.join(root, kind); await mkdir(stage);
      await installMods(root, kind, "modrinth", [file], stage, signal(), () => {});
      assert.equal(await readFile(path.join(root, "instances", kind, "game", file.directory!, "sample.zip"), "utf8"), "data");
      await assert.rejects(readFile(path.join(root, "instances", kind, "game/mods/sample.zip")));
    }
  } finally { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); }
});

// Minimal stored ZIP fixture writer; no production ZIP-writing dependency needed.
function zip(files: Record<string, string>) {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [filename, value] of Object.entries(files)) {
    const name = Buffer.from(filename), data = Buffer.from(value);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    local.push(header, name, data); central.push(entry, name); offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
test("pack runtimes enforce exact stable pins and paths block traversal / Windows device names", () => {
  assert.equal(packRuntime({ minecraft: "1.20.1", forge: "47.4.10" }).loader, "Forge");
  assert.throws(() => packRuntime({ minecraft: "1.20.1", forge: "47.4.0" }));
  assert.throws(() => packRuntime({ minecraft: "1.20.1", "quilt-loader": "0.26.0" }));
  for (const value of ["../outside", "a/../../b", "C:/file", "mods/CON.jar", "mods/nul", "mods/file.", "mods/a\u0000b"]) assert.throws(() => contentPath("/tmp/test", value));
  assert.equal(getJavaEnvironment().CURSEFORGE_API_KEY, undefined);
});
test("mrpack respects client overrides, skips optional/server-only files and rejects traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-content-test-"));
  try {
    const pack = { formatVersion: 1, game: "minecraft", name: "Test", dependencies: { minecraft: "1.20.1", "fabric-loader": "0.16.14" }, files: [{ path: "mods/skip.jar", hashes: { sha1: sha("skip"), sha512: sha("skip", "sha512") }, downloads: ["https://cdn.modrinth.com/skip"], fileSize: 4, env: { client: "unsupported" } }] };
    const archive = path.join(root, "pack.mrpack");
    await writeFile(archive, zip({ "modrinth.index.json": JSON.stringify(pack), "overrides/config/a.txt": "shared", "client-overrides/config/a.txt": "client", "server-overrides/config/a.txt": "server" }));
    const item = await unpackPack(archive, path.join(root, "stage"), signal(), () => {});
    assert.equal(item.loaderVersion, "0.16.14");
    assert.equal(await readFile(path.join(root, "stage/payload/game/config/a.txt"), "utf8"), "client");
    await assert.rejects(readFile(path.join(root, "stage/payload/game/mods/skip.jar")));
    await writeFile(archive, zip({ "../escape": "bad" }));
    await assert.rejects(unpackPack(archive, path.join(root, "bad"), signal(), () => {}));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("mod install validates hashes, is repeatable, refuses overwrite and symlink directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-content-test-"));
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("mod-data");
  const file = { projectId: "p", versionId: "v", filename: "mod.jar", artifact: { url: "https://cdn.modrinth.com/mod.jar", sha1: sha("mod-data"), size: 8 }, required: [] };
  try {
    const stage = path.join(root, "stage"); await mkdir(stage);
    await installMods(root, "instance", "modrinth", [file], stage, signal(), () => {});
    await installMods(root, "instance", "modrinth", [file], stage, signal(), () => {});
    assert.equal(await readFile(path.join(root, "instances/instance/game/mods/mod.jar"), "utf8"), "mod-data");
    await assert.rejects(installMods(root, "instance", "modrinth", [{ ...file, versionId: "other" }], stage, signal(), () => {}));
    await mkdir(path.join(root, "instances/linked/game"), { recursive: true });
    await symlink(stage, path.join(root, "instances/linked/game/mods"));
    await assert.rejects(installMods(root, "linked", "modrinth", [file], stage, signal(), () => {}));
  } finally { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); }
});
test("Modrinth resolves required dependency and filters releases; CurseForge distribution opt-out is honored", async () => {
  const original = globalThis.fetch;
  const version = (project: string, dependencies: unknown[] = []) => ({ id: project + "1", project_id: project, name: project, version_type: "release", game_versions: ["1.20.1"], loaders: ["fabric"], files: [{ filename: project + ".jar", url: "https://cdn.modrinth.com/" + project, size: 8, primary: true, hashes: { sha1: sha("mod-data") } }], dependencies });
  try {
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.includes("api.curseforge.com")) {
        assert.equal((options?.headers as Record<string, string>)["x-api-key"], "test-fixture-key");
        return Response.json(url.includes("/files/") ? { data: { id: 2, modId: 1, displayName: "Blocked", fileName: "blocked.jar", isAvailable: true, releaseType: 1, gameVersions: ["1.20.1", "Fabric"], downloadUrl: null, fileLength: 8, hashes: [{ algo: 1, value: sha("mod-data") }], dependencies: [] } } : { data: { classId: 6, allowModDistribution: false } });
      }
      if (url.includes("/version/a1")) return Response.json(version("a", [{ project_id: "b", version_id: "b1", dependency_type: "required" }]));
      if (url.includes("/version/b1")) return Response.json(version("b"));
      return Response.json({ project_type: "mod", client_side: "required" });
    };
    assert.equal((await resolveMods(query, "a", "a1", signal())).length, 2);
    await assert.rejects(resolveContentFile({ ...query, provider: "curseforge" }, "1", "2", signal()), /không cho tải/);
    globalThis.fetch = async (input) => { assert(String(input).includes("facets=")); return Response.json({ hits: [], total_hits: 0 }); };
    assert.equal((await searchContent(query, signal())).more, false);
  } finally { globalThis.fetch = original; }
});

test("CurseForge zip resolves pinned files and preserves overrides; cancelled imports do not finish", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-cf-pack-test-"));
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("forgecdn.net")) return new Response("mod-data");
      if (url.includes("/files/")) return Response.json({ data: { id: 2, modId: 1, displayName: "Pinned", fileName: "pinned.jar", isAvailable: true, releaseType: 1, gameVersions: ["1.20.1", "Forge"], downloadUrl: "https://edge.forgecdn.net/pinned.jar", fileLength: 8, hashes: [{ algo: 1, value: sha("mod-data") }], dependencies: [] } });
      return Response.json({ data: { classId: 6, slug: "example", allowModDistribution: true } });
    };
    const manifest = { manifestType: "minecraftModpack", manifestVersion: 1, name: "CF fixture", minecraft: { version: "1.20.1", modLoaders: [{ id: "forge-47.4.10", primary: true }] }, files: [{ projectID: 1, fileID: 2, required: true }], overrides: "overrides" };
    const archive = path.join(root, "pack.zip");
    await writeFile(archive, zip({ "manifest.json": JSON.stringify(manifest), "overrides/config/a.txt": "custom" }));
    const pack = await unpackPack(archive, path.join(root, "stage"), signal(), () => {});
    assert.equal(pack.loader, "Forge");
    assert.equal(await readFile(path.join(root, "stage/payload/game/mods/pinned.jar"), "utf8"), "mod-data");
    assert.equal(await readFile(path.join(root, "stage/payload/game/config/a.txt"), "utf8"), "custom");
    const controller = new AbortController(); controller.abort();
    await assert.rejects(unpackPack(archive, path.join(root, "cancel"), controller.signal, () => {}));
  } finally { globalThis.fetch = original; await rm(root, { recursive: true, force: true }); }
});
