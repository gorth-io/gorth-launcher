import path from "node:path";
import {
  mkdir,
  lstat,
  readdir,
  copyFile,
  stat,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { z } from "zod";
import extract from "extract-zip";
import { safePath, readJson, download, digest } from "@/lib/game/files";
import { supportedLoader } from "@/lib/game/catalog";
import { resolveContentFile } from "./providers";
import type { Instance, Artifact } from "@/lib/utils/interface";
import type { ContentProvider, ContentQuery } from "./interface";

export interface ModpackReceipt {
  version: 1;
  name?: string;
  source: {
    provider: ContentProvider;
    projectId: string;
    versionId: string;
  } | null;
  files: Record<string, string>;
}
const packReceiptName = ".gorth-modpack.json";

async function treeHashes(
  root: string,
  current = root,
  result: Record<string, string> = {},
) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const file = contentPath(current, entry.name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error("Modpack chứa symlink.");
    if (info.isDirectory()) await treeHashes(root, file, result);
    else if (info.isFile())
      result[path.relative(root, file).split(path.sep).join("/")] =
        await digest(file, "sha1");
  }
  return result;
}

export async function readModpackReceipt(instanceRoot: string) {
  try {
    const value = await readJson<ModpackReceipt>(
      path.join(instanceRoot, packReceiptName),
    );
    if (value.version !== 1 || !value.files || typeof value.files !== "object")
      throw new Error("Metadata modpack không hợp lệ.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function setModpackSource(
  payload: string,
  source: ModpackReceipt["source"],
) {
  const receipt = await readModpackReceipt(payload);
  if (!receipt) throw new Error("Thiếu metadata modpack.");
  await writeFile(
    path.join(payload, packReceiptName),
    JSON.stringify({ ...receipt, source }),
  );
}

export async function mergeModpackUpdate(
  instanceRoot: string,
  payload: string,
) {
  const previous = await readModpackReceipt(instanceRoot);
  const next = await readModpackReceipt(payload);
  if (!previous?.source || !next?.source)
    throw new Error("Modpack không có nguồn cập nhật.");
  if (
    previous.source.provider !== next.source.provider ||
    previous.source.projectId !== next.source.projectId
  )
    throw new Error("Nguồn modpack cập nhật không khớp instance.");
  const liveGame = path.join(instanceRoot, "game");
  const nextGame = path.join(payload, "game");
  const safeLiveFile = async (relative: string) => {
    const parts = relative.split("/");
    let directory = liveGame;
    const rootInfo = await lstat(directory);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
      throw new Error("Thư mục game không an toàn.");
    for (const segment of parts.slice(0, -1)) {
      directory = contentPath(directory, segment);
      try {
        await mkdir(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error("Modpack không ghi qua thư mục symlink.");
    }
    return contentPath(liveGame, relative);
  };
  const finalFiles: Record<string, string> = {};
  for (const [relative, oldHash] of Object.entries(previous.files)) {
    if (relative in next.files) continue;
    const target = await safeLiveFile(relative);
    try {
      if ((await digest(target, "sha1")) === oldHash) await rm(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const [relative, newHash] of Object.entries(next.files)) {
    const source = contentPath(nextGame, relative);
    const target = await safeLiveFile(relative);
    const oldHash = previous.files[relative];
    let currentHash: string | undefined;
    try {
      currentHash = await digest(target, "sha1");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!currentHash || (oldHash && currentHash === oldHash)) {
      await mkdir(path.dirname(target), { recursive: true });
      const temporary = target + ".gorth-update";
      await copyFile(source, temporary);
      await rename(temporary, target);
      finalFiles[relative] = newHash;
    } else if (currentHash === newHash) finalFiles[relative] = newHash;
    else if (oldHash) finalFiles[relative] = oldHash;
    // Existing untracked/modified files remain untouched and untracked.
  }
  const receipt = path.join(instanceRoot, packReceiptName);
  await writeFile(
    receipt + ".tmp",
    JSON.stringify({ ...next, files: finalFiles }),
  );
  await rename(receipt + ".tmp", receipt);
}

export function contentPath(root: string, relative: string) {
  if (
    [...relative].some((character) => character.charCodeAt(0) < 32) ||
    relative
      .split("/")
      .some(
        (part) =>
          /[<>"|?*]|[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw new Error("Tên file modpack không an toàn.");
  return safePath(root, relative);
}
export function packRuntime(dependencies: Record<string, string>) {
  const names: Record<string, string> = {
    forge: "Forge",
    neoforge: "NeoForge",
    "fabric-loader": "Fabric",
  };
  if (
    Object.keys(dependencies).some((key) => key !== "minecraft" && !names[key])
  )
    throw new Error("Pack dùng Quilt hoặc dependency runtime chưa hỗ trợ.");
  const loaders = Object.keys(names).filter((key) => dependencies[key]);
  if (loaders.length > 1) throw new Error("Pack khai báo nhiều mod loader.");
  const runtime = {
    version: dependencies.minecraft,
    loader: loaders.length ? names[loaders[0]] : "Vanilla",
    loaderVersion: loaders.length ? dependencies[loaders[0]] : null,
  };
  if (
    !runtime.version ||
    !/^[a-zA-Z0-9._-]{1,60}$/.test(runtime.version) ||
    !supportedLoader(runtime)
  )
    throw new Error(
      "Pack yêu cầu " +
        runtime.loader +
        " " +
        (runtime.loaderVersion ?? "") +
        " / Minecraft " +
        runtime.version +
        ", ngoài danh sách ổn định được hỗ trợ. Không tự đổi loader của pack.",
    );
  return runtime;
}
const mrSchema = z.object({
  formatVersion: z.literal(1),
  game: z.literal("minecraft"),
  name: z.string().trim().min(1).max(200),
  dependencies: z.record(z.string(), z.string()),
  files: z
    .array(
      z.object({
        path: z.string().max(1024),
        hashes: z.object({
          sha1: z.string().regex(/^[a-f0-9]{40}$/),
          sha512: z.string().regex(/^[a-f0-9]{128}$/),
        }),
        downloads: z.array(z.string().url()).min(1).max(10),
        fileSize: z
          .number()
          .int()
          .min(0)
          .max(1024 ** 3),
        env: z
          .object({ client: z.enum(["required", "optional", "unsupported"]) })
          .optional(),
      }),
    )
    .max(10000),
});
const cfSchema = z.object({
  manifestType: z.literal("minecraftModpack"),
  manifestVersion: z.literal(1),
  name: z.string().trim().min(1).max(200),
  minecraft: z.object({
    version: z.string(),
    modLoaders: z
      .array(z.object({ id: z.string(), primary: z.boolean() }))
      .max(4),
  }),
  files: z
    .array(
      z.object({
        projectID: z.number().int().positive(),
        fileID: z.number().int().positive(),
        required: z.boolean(),
      }),
    )
    .max(10000),
  overrides: z.string().min(1).max(200),
});
async function copyOverrides(
  source: string,
  target: string,
  signal: AbortSignal,
) {
  let entries;
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    signal.throwIfAborted();
    const from = contentPath(source, entry.name),
      to = contentPath(target, entry.name);
    const info = await lstat(from);
    if (info.isSymbolicLink()) throw new Error("Pack chứa symlink.");
    if (info.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyOverrides(from, to, signal);
    } else if (info.isFile()) {
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);
    } else throw new Error("Pack chứa file đặc biệt.");
  }
}
export async function unpackPack(
  archive: string,
  staging: string,
  signal: AbortSignal,
  progress: (message: string, done?: number, total?: number) => void,
): Promise<Omit<Instance, "id" | "createdAt">> {
  if ((await stat(archive)).size > 1024 ** 3)
    throw new Error("Archive modpack vượt 1 GB.");
  const unpacked = path.join(staging, "archive");
  const game = path.join(staging, "payload", "game");
  await mkdir(game, { recursive: true });
  let bytes = 0,
    count = 0;
  const seen = new Set<string>();
  await extract(archive, {
    dir: unpacked,
    onEntry(entry) {
      signal.throwIfAborted();
      const name = entry.fileName.replace(/\/$/, "");
      contentPath(unpacked, name);
      bytes += entry.uncompressedSize;
      if (
        ++count > 50000 ||
        bytes > 4 * 1024 ** 3 ||
        ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000
      )
        throw new Error("Archive chứa symlink hoặc vượt giới hạn giải nén.");
      const key = name.normalize("NFC").toLowerCase();
      if (!entry.fileName.endsWith("/") && seen.has(key))
        throw new Error("Archive có tên file trùng nhau.");
      seen.add(key);
    },
  });
  signal.throwIfAborted();
  const files: { relative: string; artifact: Artifact }[] = [];
  let name: string;
  let runtime: ReturnType<typeof packRuntime>;
  let overrides: string[];
  const mr = path.join(unpacked, "modrinth.index.json");
  let isModrinth = false;
  try {
    isModrinth = (await stat(mr)).isFile();
  } catch {
    /* CurseForge manifest below. */
  }
  const manifest = isModrinth ? mr : path.join(unpacked, "manifest.json");
  if ((await stat(manifest)).size > 5 * 1024 ** 2)
    throw new Error("Manifest modpack quá lớn.");
  if (isModrinth) {
    const pack = mrSchema.parse(await readJson(manifest));
    name = pack.name;
    runtime = packRuntime(pack.dependencies);
    overrides = ["overrides", "client-overrides"];
    for (const file of pack.files) {
      if (file.env?.client === "unsupported" || file.env?.client === "optional")
        continue;
      files.push({
        relative: file.path,
        artifact: {
          url: file.downloads[0],
          sha1: file.hashes.sha1,
          sha512: file.hashes.sha512,
          size: file.fileSize,
        },
      });
    }
  } else {
    const pack = cfSchema.parse(await readJson(manifest));
    const primary = pack.minecraft.modLoaders.filter(
      (loader) => loader.primary,
    );
    if (primary.length !== 1 || pack.minecraft.modLoaders.length !== 1)
      throw new Error("Pack phải có đúng một primary loader.");
    const match = /^(forge|neoforge|fabric)-(.+)$/.exec(primary[0].id);
    if (!match) throw new Error("Loader pack không hỗ trợ (không dùng Quilt).");
    name = pack.name;
    runtime = packRuntime({
      minecraft: pack.minecraft.version,
      [match[1] === "fabric" ? "fabric-loader" : match[1]]: match[2],
    });
    overrides = [pack.overrides];
    contentPath(unpacked, pack.overrides);
    const query: ContentQuery = {
      provider: "curseforge",
      kind: "mod",
      query: "",
      offset: 0,
      version: runtime.version,
      loader: runtime.loader,
    };
    for (const file of pack.files.filter((item) => item.required)) {
      progress("Đang đọc manifest CurseForge", files.length, pack.files.length);
      const resolved = await resolveContentFile(
        query,
        String(file.projectID),
        String(file.fileID),
        signal,
        true,
      );
      if (
        path.basename(resolved.filename) !== resolved.filename ||
        !resolved.filename.endsWith(
          resolved.directory === "mods" ? ".jar" : ".zip",
        )
      )
        throw new Error("Tên file mod không hợp lệ.");
      files.push({
        relative: (resolved.directory ?? "mods") + "/" + resolved.filename,
        artifact: resolved.artifact,
      });
    }
  }
  const targets = new Set<string>();
  let total = 0;
  for (const file of files) {
    contentPath(game, file.relative);
    const key = file.relative.normalize("NFC").toLowerCase();
    if (targets.has(key)) throw new Error("Manifest có đường dẫn trùng nhau.");
    targets.add(key);
    total += file.artifact.size ?? 0;
  }
  if (total > 20 * 1024 ** 3) throw new Error("Modpack vượt 20 GB.");
  for (let index = 0; index < files.length; index++) {
    signal.throwIfAborted();
    progress("Đang tải file modpack", index, files.length);
    await download(
      files[index].artifact,
      contentPath(game, files[index].relative),
      signal,
    );
  }
  for (const folder of overrides)
    await copyOverrides(contentPath(unpacked, folder), game, signal);
  signal.throwIfAborted();
  await writeFile(
    path.join(staging, "payload", packReceiptName),
    JSON.stringify({
      version: 1,
      name: name.slice(0, 200),
      source: null,
      files: await treeHashes(game),
    } satisfies ModpackReceipt),
  );
  return { name: name.slice(0, 60), ...runtime };
}
