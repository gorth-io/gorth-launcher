import os from "node:os";
import { supportedRelease } from "./catalog";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { download, json, readJson, safePath } from "./files";
import type { Argument, Artifact, Rule, Version } from "@/lib/utils/interface";
interface Manifest {
  versions: { id: string; type: string; url: string; sha1: string }[];
}
export const platform =
  process.platform === "darwin"
    ? "osx"
    : process.platform === "win32"
      ? "windows"
      : "linux";
export const architecture =
  process.arch === "arm64"
    ? "aarch64"
    : process.arch === "ia32"
      ? "x86"
      : "x86_64";
export function allowed(
  rules?: Rule[],
  context = {
    platform,
    architecture,
    version: os.release(),
    features: { has_custom_resolution: true } as Record<string, boolean>,
  },
) {
  if (!rules?.length) return true;
  let result = false;
  for (const rule of rules) {
    if (rule.os?.name && rule.os.name !== context.platform) continue;
    if (
      rule.os?.arch &&
      !new RegExp("^(?:" + rule.os.arch + ")$").test(context.architecture)
    )
      continue;
    if (rule.os?.version && !new RegExp(rule.os.version).test(context.version))
      continue;
    if (
      rule.features &&
      Object.entries(rule.features).some(
        ([key, value]) => (context.features[key] ?? false) !== value,
      )
    )
      continue;
    result = rule.action === "allow";
  }
  return result;
}
export function argumentsFor(
  values: (string | Argument)[],
  variables: Record<string, string>,
) {
  return values
    .flatMap((value) =>
      typeof value === "string"
        ? [value]
        : allowed(value.rules)
          ? Array.isArray(value.value)
            ? value.value
            : [value.value]
          : [],
    )
    .map((value) =>
      value.replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
        if (!(key in variables))
          throw new Error("Tham số Minecraft chưa hỗ trợ: " + key);
        return variables[key];
      }),
    );
}
export async function manifest(root: string, signal: AbortSignal) {
  const file = path.join(root, "version_manifest_v2.json");
  try {
    const data = await json<Manifest>(
      "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      signal,
    );
    if (!Array.isArray(data.versions))
      throw new Error("Manifest Minecraft không hợp lệ.");
    await mkdir(root, { recursive: true });
    const temporary = file + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, file);
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    try {
      return await readJson<Manifest>(file);
    } catch {
      throw error;
    }
  }
}
export async function versionMetadata(
  root: string,
  id: string,
  signal: AbortSignal,
) {
  const entry = (await manifest(root, signal)).versions.find(
    (v) => v.id === id,
  );
  if (!entry) throw new Error("Không tìm thấy phiên bản Minecraft: " + id);
  if (!supportedRelease(entry))
    throw new Error("Chỉ hỗ trợ Minecraft release từ 1.7.10 trở lên; không hỗ trợ snapshot.");
  const file = safePath(root, "versions/" + id + "/" + id + ".json");
  await download(entry, file, signal);
  const data = await readJson<Version>(file);
  if (data.id !== id || !data.mainClass)
    throw new Error("Metadata Minecraft không hợp lệ.");
  return data;
}
export function libraryFiles(version: Version, root: string) {
  const jars: { artifact: Artifact; file: string }[] = [];
  const natives: { artifact: Artifact; file: string }[] = [];
  for (const library of version.libraries) {
    if (!allowed(library.rules)) continue;
    const artifact = library.downloads?.artifact;
    if (artifact?.path)
      jars.push({
        artifact,
        file: safePath(root, "libraries/" + artifact.path),
      });
    const classifier = library.natives?.[platform]?.replace(
      "${arch}",
      process.arch === "ia32" ? "32" : "64",
    );
    const native = classifier
      ? library.downloads?.classifiers?.[classifier]
      : undefined;
    if (classifier && !native?.path)
      throw new Error("Thiếu thư viện native phù hợp hệ điều hành.");
    if (native?.path)
      natives.push({
        artifact: native,
        file: safePath(root, "libraries/" + native.path),
      });
  }
  return { jars, natives };
}
