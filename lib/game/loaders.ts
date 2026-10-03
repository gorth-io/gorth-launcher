import path from "node:path";
import { mkdir, writeFile, readFile, rm, stat, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import extract from "extract-zip";
import type { Instance, Library, Version } from "@/lib/utils/interface";
import { getJavaEnvironment } from "@/lib/utils/environment";
import { download, digest, json, readJson, response, safePath } from "./files";

export function mavenPath(name: string) {
  const [coordinate, extension = "jar"] = name.split("@");
  const [group, artifact, version, classifier] = coordinate.split(":");
  if (!group || !artifact || !version)
    throw new Error("Maven coordinate không hợp lệ.");
  return (
    group.replaceAll(".", "/") +
    "/" +
    artifact +
    "/" +
    version +
    "/" +
    artifact +
    "-" +
    version +
    (classifier ? "-" + classifier : "") +
    "." +
    extension
  );
}

export function mergeVersion(base: Version, child: Version): Version {
  if (child.inheritsFrom !== base.id)
    throw new Error("Loader không khớp phiên bản Minecraft.");
  const libraries = new Map<string, Library>();
  for (const library of [...base.libraries, ...child.libraries]) {
    const [group, artifact, , classifier = ""] = library.name.split(":");
    libraries.set(group + ":" + artifact + ":" + classifier, library);
  }
  return {
    ...base,
    ...child,
    downloads: base.downloads,
    assetIndex: base.assetIndex,
    javaVersion: base.javaVersion,
    logging: base.logging,
    libraries: [...libraries.values()],
    arguments: {
      jvm: [...(base.arguments?.jvm ?? []), ...(child.arguments?.jvm ?? [])],
      game: [...(base.arguments?.game ?? []), ...(child.arguments?.game ?? [])],
    },
  };
}

async function normalizeLibraries(version: Version, signal: AbortSignal) {
  for (const library of version.libraries) {
    if (library.downloads?.artifact) continue;
    const relative = mavenPath(library.name);
    const url = (library.url ?? "https://libraries.minecraft.net/") + relative;
    const sha1 =
      library.sha1 ??
      (await (await response(url + ".sha1", signal)).text())
        .trim()
        .split(/\s/)[0];
    library.downloads = {
      ...library.downloads,
      artifact: { url, path: relative, sha1, size: library.size },
    };
  }
}

async function runInstaller(
  java: string,
  jar: string,
  root: string,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      java,
      ["-Djava.awt.headless=true", "-jar", jar, "--installClient", root],
      {
        cwd: path.dirname(jar),
        env: getJavaEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      },
    );
    let tail = "";
    let stopped = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      if (process.platform === "win32" || !child.pid) {
        child.kill(signal);
        return;
      }
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    const stop = () => {
      stopped = true;
      kill("SIGTERM");
      killTimer ??= setTimeout(() => kill("SIGKILL"), 5000);
    };
    signal.addEventListener("abort", stop, { once: true });
    const timeout = setTimeout(stop, 20 * 60_000);
    const output = (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-6000);
      progress(
        "Installer: " + tail.trim().split(/\r?\n/).at(-1)?.slice(0, 180),
      );
    };
    child.stdout.on("data", output);
    child.stderr.on("data", output);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      signal.removeEventListener("abort", stop);
      if (signal.aborted) reject(signal.reason);
      else if (stopped) reject(new Error("Installer quá thời gian cho phép."));
      else if (code !== 0)
        reject(new Error("Installer thất bại (" + code + "): " + tail));
      else resolve();
    });
    if (signal.aborted) stop();
  });
}

export async function installLoader(
  root: string,
  instance: Instance,
  base: Version,
  java: string,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  if (instance.loader === "Vanilla") return base;
  if (instance.loader === "Fabric") {
    const cache = safePath(root, "loaders/Fabric-" + instance.version + "-" + instance.loaderVersion + ".json");
    const profileId = "fabric-loader-" + instance.loaderVersion + "-" + instance.version;
    try {
      const cached = await readJson<Version>(cache);
      if (cached.id === profileId && cached.inheritsFrom === base.id && Array.isArray(cached.libraries) && cached.mainClass && cached.libraries.every((library) => library.downloads?.artifact?.sha1)) return mergeVersion(base, cached);
    } catch { /* Download an absent or malformed cached profile. */ }
    const child = await json<Version>(
      "https://meta.fabricmc.net/v2/versions/loader/" +
        instance.version +
        "/" +
        instance.loaderVersion +
        "/profile/json",
      signal,
    );
    await normalizeLibraries(child, signal);
    if (child.id !== profileId || child.inheritsFrom !== base.id) throw new Error("Fabric profile không đúng phiên bản đã chọn.");
    await mkdir(path.dirname(cache), { recursive: true });
    await writeFile(cache + ".tmp", JSON.stringify(child));
    await rename(cache + ".tmp", cache);
    return mergeVersion(base, child);
  }
  const legacy = instance.loader === "Forge" || instance.version === "1.20.1";
  const artifact = legacy ? "forge" : "neoforge";
  const coordinate = legacy
    ? instance.version + "-" + instance.loaderVersion
    : instance.loaderVersion!;
  const repository =
    instance.loader === "Forge"
      ? "https://maven.minecraftforge.net/net/minecraftforge/"
      : "https://maven.neoforged.net/releases/net/neoforged/";
  const url =
    repository +
    artifact +
    "/" +
    coordinate +
    "/" +
    artifact +
    "-" +
    coordinate +
    "-installer.jar";
  const directory = safePath(
    root,
    "loaders/" + instance.loader + "-" + coordinate,
  );
  const jar = path.join(directory, "installer.jar");
  progress(
    "Kiểm tra installer " + instance.loader + " " + instance.loaderVersion,
  );
  const checksums: Record<string, string> = {
    "Forge-1.20.1-47.4.10": "66bfea9963bfa60d88bab6b2750e74a958392715",
    "Forge-1.19.2-43.5.0": "0a45a1d96388403c5f16556df81165ba4d96987a",
    "NeoForge-1.20.1-47.1.106": "0c6074dd66487388258e1bb5d2a962d52080a22c",
    "NeoForge-21.1.217": "717df32b79f3e83e2c695ac8e9b0aa0a6fe530b1",
  };
  const sha1 = checksums[instance.loader + "-" + coordinate];
  if (!sha1) throw new Error("Installer chưa được ghim checksum.");
  await download({ url, sha1 }, jar, signal);
  const unpacked = path.join(directory, "metadata");
  await mkdir(unpacked, { recursive: true });
  try {
    let bytes = 0;
    await extract(jar, {
      dir: unpacked,
      onEntry(entry) {
        bytes += entry.uncompressedSize;
        if (
          bytes > 512 * 1024 ** 2 ||
          ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000
        )
          throw new Error("Installer archive không hợp lệ.");
      },
    });
    const child = await readJson<Version>(path.join(unpacked, "version.json"));
    if (child.inheritsFrom !== base.id)
      throw new Error("Installer không khớp Minecraft.");
    let ready = false;
    try {
      ready =
        (await readFile(path.join(directory, "completed"), "utf8")) === sha1;
      for (const library of child.libraries) {
        const file = library.downloads?.artifact;
        if (!file?.path) {
          ready = false;
          break;
        }
        const target = safePath(root, "libraries/" + file.path);
        if (
          !(await stat(target)).isFile() ||
          (file.sha1 && (await digest(target, "sha1")) !== file.sha1)
        ) {
          ready = false;
          break;
        }
      }
    } catch {
      ready = false;
    }
    if (!ready) {
      try {
        await writeFile(
          path.join(root, "launcher_profiles.json"),
          JSON.stringify({ profiles: {} }),
          { flag: "wx" },
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      await runInstaller(java, jar, root, signal, progress);
      signal.throwIfAborted();
      await writeFile(path.join(directory, "completed"), sha1);
    }
    await normalizeLibraries(child, signal);
    return mergeVersion(base, child);
  } finally {
    await rm(unpacked, { recursive: true, force: true });
  }
}
