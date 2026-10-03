import path from "node:path";
import { mkdir, writeFile, rename, rm, copyFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import extract from "extract-zip";
import type {
  Artifact,
  GameIdentity,
  Instance,
  InstalledGame,
  Settings,
} from "@/lib/utils/interface";
import { download, json, readJson, safePath } from "./files";
import { argumentsFor, libraryFiles, versionMetadata } from "./metadata";
import { ensureJava, memoryLimit } from "./java";
import { supportedLoader } from "./catalog";
import { installLoader } from "./loaders";
export function validateInstance(value: Instance) {
  if (
    !value ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) ||
    typeof value.version !== "string" ||
    !/^[a-zA-Z0-9._-]{1,60}$/.test(value.version) ||
    value.version === "." ||
    value.version === ".."
  )
    throw new Error("Instance không hợp lệ.");
  if (!supportedLoader(value))
    throw new Error(
      "Tổ hợp Minecraft/mod loader không được hỗ trợ. Hãy tạo instance từ danh sách ổn định.",
    );
  return value;
}
export async function installGame(
  root: string,
  instance: Instance,
  settings: Settings,
  signal: AbortSignal,
  progress: (message: string, done: number, total: number) => void,
): Promise<InstalledGame> {
  validateInstance(instance);
  let version = await versionMetadata(root, instance.version, signal);
  const major = version.javaVersion?.majorVersion ?? 8;
  // Temurin starts at 8/17; Java 17 also runs the Java 16-based 1.17 releases.
  const runtime = major === 16 ? 17 : major;
  progress("Kiểm tra Eclipse Temurin " + runtime, 0, 0);
  const java = await ensureJava(
    root,
    settings.javaPath,
    signal,
    (message) => progress(message, 0, 0),
    runtime,
  );
  const instanceRoot = safePath(root, "instances/" + instance.id);
  const gameDir = path.join(instanceRoot, "game");
  await mkdir(gameDir, { recursive: true });
  const indexFile = safePath(
    root,
    "assets/indexes/" + version.assetIndex.id + ".json",
  );
  progress("Đang tải asset index", 0, 0);
  await download(version.assetIndex, indexFile, signal);
  const assets = await readJson<{
    objects: Record<string, { hash: string; size: number }>;
    virtual?: boolean;
    map_to_resources?: boolean;
  }>(indexFile);
  if (!assets.objects)
    throw new Error("Định dạng assets chưa hỗ trợ cho phiên bản này.");
  let { jars, natives } = libraryFiles(version, root);
  const client = safePath(
    root,
    "versions/" + version.id + "/" + version.id + ".jar",
  );
  const files: { artifact: Artifact; file: string }[] = [
    ...jars,
    ...natives,
    { artifact: version.downloads.client, file: client },
  ];
  let logConfig: string | undefined;
  if (version.logging?.client) {
    logConfig = safePath(
      root,
      "assets/log_configs/" + version.logging.client.file.id,
    );
    files.push({ artifact: version.logging.client.file, file: logConfig });
  }
  for (const item of Object.values(assets.objects)) {
    if (!/^[a-f0-9]{40}$/.test(item.hash))
      throw new Error("Asset hash không hợp lệ.");
    const suffix = item.hash.slice(0, 2) + "/" + item.hash;
    files.push({
      artifact: {
        url: "https://resources.download.minecraft.net/" + suffix,
        sha1: item.hash,
        size: item.size,
      },
      file: safePath(root, "assets/objects/" + suffix),
    });
  }
  const unique = [...new Map(files.map((file) => [file.file, file])).values()];
  let cursor = 0;
  let completed = 0;
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  progress("Đang kiểm tra và tải game", 0, unique.length);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, async () => {
      try {
        while (cursor < unique.length) {
          combined.throwIfAborted();
          const file = unique[cursor++];
          await download(file.artifact, file.file, combined);
          completed++;
          progress("Đang kiểm tra và tải game", completed, unique.length);
        }
      } catch (error) {
        controller.abort();
        throw error;
      }
    }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  if (assets.virtual || assets.map_to_resources) {
    for (const [name, item] of Object.entries(assets.objects)) {
      signal.throwIfAborted();
      const source = safePath(
        root,
        "assets/objects/" + item.hash.slice(0, 2) + "/" + item.hash,
      );
      const destinations = [
        ...(assets.virtual
          ? [
              safePath(
                root,
                "assets/virtual/" + version.assetIndex.id + "/" + name,
              ),
            ]
          : []),
        ...(assets.map_to_resources
          ? [safePath(gameDir, "resources/" + name)]
          : []),
      ];
      for (const target of destinations) {
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(source, target);
      }
    }
  }
  version = await installLoader(
    root,
    instance,
    version,
    java,
    signal,
    (message) => progress(message, 0, 0),
  );
  ({ jars, natives } = libraryFiles(version, root));
  for (const item of [...jars, ...natives]) {
    signal.throwIfAborted();
    await download(item.artifact, item.file, signal);
  }
  signal.throwIfAborted();
  progress("Giải nén thư viện native", unique.length, unique.length);
  const nativeDir = path.join(instanceRoot, "natives");
  const staging = nativeDir + "." + randomUUID();
  await mkdir(staging, { recursive: true });
  try {
    let unpacked = 0;
    for (const native of natives) {
      signal.throwIfAborted();
      await extract(native.file, {
        dir: staging,
        onEntry(entry) {
          if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000)
            throw new Error("Native archive chứa symlink không hợp lệ.");
          unpacked += entry.uncompressedSize;
          if (unpacked > 1024 ** 3)
            throw new Error("Native archive vượt kích thước cho phép.");
        },
      });
    }
    await rm(nativeDir, { recursive: true, force: true });
    await rename(staging, nativeDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  const receipt = path.join(instanceRoot, "installed.json");
  await writeFile(
    receipt + ".tmp",
    JSON.stringify({
      version: instance.version,
      profileId: version.id,
      loader: instance.loader,
      loaderVersion: instance.loaderVersion ?? null,
      java,
      installedAt: Date.now(),
    }),
  );
  await rename(receipt + ".tmp", receipt);
  return {
    version,
    java,
    gameDir,
    gameAssets: assets.map_to_resources
      ? path.join(gameDir, "resources")
      : assets.virtual
        ? path.join(root, "assets", "virtual", version.assetIndex.id)
        : path.join(root, "assets"),
    natives: nativeDir,
    // Forge/NeoForge supply the patched client through their own libraries.
    // Adding the raw Mojang client creates duplicate Java modules/packages.
    classpath: [
      ...jars.map((j) => j.file),
      ...(["Forge", "NeoForge"].includes(instance.loader) ? [] : [client]),
    ],
    root,
    logConfig,
  };
}
export async function injector(root: string, signal: AbortSignal) {
  const metadata = await json<{
    download_url: string;
    checksums: { sha256: string };
  }>("https://authlib-injector.yushi.moe/artifact/latest.json", signal);
  const file = path.join(root, "authlib", "authlib-injector.jar");
  await download(
    { url: metadata.download_url, sha256: metadata.checksums.sha256 },
    file,
    signal,
  );
  return file;
}
export function launchArguments(
  game: InstalledGame,
  session: GameIdentity,
  memory: number,
  agent?: string,
) {
  const variables: Record<string, string> = {
    natives_directory: game.natives,
    launcher_name: "GorthLauncher",
    launcher_version: "0.0.0",
    classpath: game.classpath.join(path.delimiter),
    classpath_separator: path.delimiter,
    library_directory: path.join(game.root, "libraries"),
    auth_player_name: session.username,
    version_name: game.version.id,
    game_directory: game.gameDir,
    assets_root: path.join(game.root, "assets"),
    assets_index_name: game.version.assetIndex.id,
    auth_uuid: session.uuid,
    auth_access_token: session.accessToken,
    auth_session:
      session.accessToken === "0"
        ? "0"
        : "token:" + session.accessToken + ":" + session.uuid,
    game_assets:
      game.gameAssets ??
      path.join(game.root, "assets", "virtual", game.version.assetIndex.id),
    clientid: "",
    auth_xuid: "",
    user_type: "mojang",
    version_type: game.version.type,
    user_properties: "{}",
    resolution_width: "1280",
    resolution_height: "720",
  };
  if (session.authlibRoot && !agent)
    throw new Error("Thiếu authlib-injector cho tài khoản online.");
  const jvm = argumentsFor(
    game.version.arguments?.jvm ?? [
      "-Djava.library.path=${natives_directory}",
      "-cp",
      "${classpath}",
    ],
    variables,
  );
  const args = ["-Xms512m", "-Xmx" + memoryLimit(memory) + "G", ...jvm];
  if (agent && session.authlibRoot)
    args.push("-javaagent:" + agent + "=" + session.authlibRoot);
  if (game.logConfig && game.version.logging?.client)
    args.push(
      game.version.logging.client.argument.replace("${path}", game.logConfig),
    );
  return [
    ...args,
    game.version.mainClass,
    ...argumentsFor(
      game.version.arguments?.game ??
        legacyArguments(game.version.minecraftArguments ?? ""),
      variables,
    ),
  ];
}

export function legacyArguments(value: string) {
  return (value.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map((part) =>
    part.replace(/^(["'])(.*)\1$/, "$2"),
  );
}
