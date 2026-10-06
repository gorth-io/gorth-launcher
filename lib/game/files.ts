import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { parseHttpsUrl } from "@/lib/utils/schema";
import type { Artifact } from "@/lib/utils/interface";
import { transferProgress } from "./transfer";
const hosts = new Set([
  "piston-meta.mojang.com",
  "launchermeta.mojang.com",
  "piston-data.mojang.com",
  "launcher.mojang.com",
  "libraries.minecraft.net",
  "resources.download.minecraft.net",
  "api.adoptium.net",
  "github.com",
  "release-assets.githubusercontent.com",
  "objects.githubusercontent.com",
  "authlib-injector.yushi.moe",
  "meta.fabricmc.net",
  "maven.fabricmc.net",
  "maven.minecraftforge.net",
  "maven.neoforged.net",
  "cdn.modrinth.com",
  "edge.forgecdn.net",
  "mediafilez.forgecdn.net",
  "media.forgecdn.net",
  "raw.githubusercontent.com",
  "gitlab.com",
]);
export function safePath(root: string, relative: string) {
  if (
    !relative ||
    relative.includes("\\") ||
    relative.includes(":") ||
    path.posix.isAbsolute(relative) ||
    relative.split("/").some((p) => p === ".." || p === "." || !p)
  )
    throw new Error("Đường dẫn tải không hợp lệ.");
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep))
    throw new Error("Đường dẫn nằm ngoài thư mục game.");
  return result;
}
export async function response(
  url: string,
  signal: AbortSignal,
): Promise<Response> {
  for (let redirects = 0; redirects < 6; redirects++) {
    const target = parseHttpsUrl(url);
    if (
      target.protocol !== "https:" ||
      !hosts.has(target.hostname) ||
      target.username ||
      target.password ||
      (target.port && target.port !== "443")
    )
      throw new Error("Nguồn tải không được phép.");
    const result = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      headers: { "User-Agent": "GorthLauncher/0.0.0" },
    });
    if (
      result.status >= 300 &&
      result.status < 400 &&
      result.headers.has("location")
    ) {
      url = parseHttpsUrl(
        new URL(result.headers.get("location")!, target).href,
      ).href;
      await result.body?.cancel();
      continue;
    }
    if (!result.ok)
      throw new Error("Tải dữ liệu thất bại (HTTP " + result.status + ").");
    return result;
  }
  throw new Error("Quá nhiều chuyển hướng khi tải.");
}
export async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  return (await response(url, signal)).json() as Promise<T>;
}
export async function digest(file: string, algorithm: string) {
  const hash = createHash(algorithm);
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest("hex");
}
export async function download(
  artifact: Artifact,
  file: string,
  signal: AbortSignal,
) {
  const hash = artifact.sha512 ?? artifact.sha256 ?? artifact.sha1;
  const algorithm = artifact.sha512
    ? "sha512"
    : artifact.sha256
      ? "sha256"
      : "sha1";
  if (
    !hash ||
    !new RegExp(
      "^[a-f0-9]{" +
        (algorithm === "sha512" ? 128 : algorithm === "sha256" ? 64 : 40) +
        "}$",
    ).test(hash)
  )
    throw new Error("Thiếu checksum tải xuống.");
  try {
    const info = await stat(file);
    if (
      (artifact.size === undefined || info.size === artifact.size) &&
      (await digest(file, algorithm)) === hash
    )
      return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    const temp = file + "." + randomUUID() + ".part";
    try {
      const result = await response(artifact.url, signal);
      if (!result.body) throw new Error("Không nhận được file tải xuống.");
      let bytes = 0;
      const verifier = createHash(algorithm);
      const report = transferProgress.getStore();
      const guard = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length;
          report?.(chunk.length);
          if (bytes > (artifact.size ?? 1024 ** 3)) {
            callback(new Error("File tải vượt kích thước dự kiến."));
            return;
          }
          verifier.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(result.body as never),
        guard,
        createWriteStream(temp, { flags: "wx" }),
        { signal },
      );
      if (
        (artifact.size !== undefined && bytes !== artifact.size) ||
        verifier.digest("hex") !== hash
      )
        throw new Error("Checksum tải xuống không khớp.");
      await rename(temp, file);
      return;
    } catch (error) {
      await rm(temp, { force: true });
      if (signal.aborted || attempt === 2) throw error;
    }
  }
}
export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}
