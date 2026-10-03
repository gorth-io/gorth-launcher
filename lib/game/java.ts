import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import extract from "extract-zip";
import { download, json } from "./files";
import { javaHome, getJavaEnvironment } from "@/lib/utils/environment";
const exec = promisify(execFile);
export async function checkJava(file: string, major = 17) {
  const { stdout, stderr } = await exec(
    file,
    ["-XshowSettings:properties", "-version"],
    { timeout: 15_000, env: getJavaEnvironment(), maxBuffer: 128 * 1024 },
  );
  const output = stdout + stderr;
  if (
    !new RegExp(
      "java\\.version\\s*=\\s*" +
        (major === 8 ? "(?:1\\.8|8)" : major) +
        "(?:[.\\s+_-])",
    ).test(output) ||
    !/java\.vendor\s*=\s*(?:Eclipse Adoptium|Temurin)(?:\r?\n|$)/.test(output)
  )
    throw new Error(
      "Cần Eclipse Temurin " + major + ". Java đã chọn không đúng bản yêu cầu.",
    );
  const arch = /os\.arch\s*=\s*(\S+)/.exec(output)?.[1];
  if (
    process.arch === "arm64"
      ? arch !== "aarch64"
      : !["amd64", "x86_64"].includes(arch ?? "")
  )
    throw new Error("Kiến trúc Temurin phải khớp launcher (x64/ARM64).");
  return file;
}
async function findJava(
  root: string,
  major: number,
  depth = 4,
): Promise<string | null> {
  const direct = path.join(
    root,
    "bin",
    process.platform === "win32" ? "java.exe" : "java",
  );
  try {
    return await checkJava(direct, major);
  } catch {
    /* try nested runtime folders */
  }
  if (!depth) return null;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries)
    if (entry.isDirectory()) {
      const found = await findJava(
        path.join(root, entry.name),
        major,
        depth - 1,
      );
      if (found) return found;
    }
  return null;
}
export async function ensureJava(
  root: string,
  custom: string,
  signal: AbortSignal,
  status: (message: string) => void,
  major = 17,
) {
  if (custom) {
    if (!path.isAbsolute(custom))
      throw new Error("Đường dẫn Java phải là đường dẫn tuyệt đối.");
    return checkJava(custom, major);
  }
  const candidates: string[] = [];
  if (javaHome)
    candidates.push(
      path.join(
        javaHome,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      ),
    );
  if (process.platform === "darwin") {
    try {
      const { stdout } = await exec(
        "/usr/libexec/java_home",
        ["-v", major === 8 ? "1.8" : String(major), "-F"],
        { timeout: 5000 },
      );
      candidates.push(path.join(stdout.trim(), "bin/java"));
    } catch {
      /* download if absent */
    }
  }
  for (const candidate of candidates)
    try {
      return await checkJava(candidate, major);
    } catch {
      /* only Temurin 17 */
    }
  const managed = path.join(
    root,
    "runtime",
    "temurin-" + major + "-" + process.platform + "-" + process.arch,
  );
  const existing = await findJava(managed, major);
  if (existing) return existing;
  if (
    !["x64", "arm64"].includes(process.arch) ||
    !["win32", "darwin", "linux"].includes(process.platform)
  )
    throw new Error("Nền tảng chưa hỗ trợ Temurin tự động.");
  status("Đang tải Eclipse Temurin " + major + "…");
  const osName =
    process.platform === "darwin"
      ? "mac"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x64";
  const releases = await json<
    {
      binary: {
        package: { link: string; checksum: string; size: number; name: string };
      };
    }[]
  >(
    "https://api.adoptium.net/v3/assets/latest/" +
      major +
      "/hotspot?architecture=" +
      arch +
      "&image_type=jre&os=" +
      osName +
      "&vendor=eclipse",
    signal,
  );
  const archive = releases[0]?.binary.package;
  if (!archive)
    throw new Error("Không tìm thấy Temurin " + major + " phù hợp.");
  const archivePath = path.join(
    root,
    "runtime",
    "temurin-" +
      major +
      "-" +
      osName +
      "-" +
      arch +
      (osName === "windows" ? ".zip" : ".tar.gz"),
  );
  await download(
    { url: archive.link, sha256: archive.checksum, size: archive.size },
    archivePath,
    signal,
  );
  const staging = managed + ".staging";
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    if (osName === "windows") await extract(archivePath, { dir: staging });
    else
      await exec("/usr/bin/tar", ["-xzf", archivePath, "-C", staging], {
        signal,
        timeout: 120_000,
      });
    signal.throwIfAborted();
    const found = await findJava(staging, major);
    if (!found) throw new Error("Temurin tải về không hợp lệ.");
    const relative = path.relative(staging, found);
    await rm(managed, { recursive: true, force: true });
    await rename(staging, managed);
    return path.join(managed, relative);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
export function memoryLimit(value: number) {
  const limit = Math.max(
    1,
    Math.min(64, Math.floor(os.totalmem() / 1024 ** 3) - 2),
  );
  if (!Number.isInteger(value) || value < 1 || value > limit)
    throw new Error("RAM phải nằm trong khoảng 1–" + limit + " GB.");
  return value;
}
