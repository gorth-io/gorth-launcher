import path from "node:path";
import {
  mkdir,
  lstat,
  link,
  rm,
  writeFile,
  rename,
  readdir,
} from "node:fs/promises";
import { digest, download, readJson } from "@/lib/game/files";
import { contentPath, readModpackReceipt } from "./packs";
import type {
  ContentFile,
  ContentInventory,
  ContentKind,
  ContentProvider,
  InstalledContent,
} from "./interface";
interface InstalledContentReceipt {
  provider: ContentProvider;
  projectId: string;
  versionId: string;
  filename: string;
  directory?: "mods" | "resourcepacks" | "shaderpacks" | "datapacks";
  worldName?: string;
  sha1?: string;
  requiredProjectIds?: string[];
  conflicts?: string[];
  enabled?: boolean;
}
const receiptName = "content.json";
const contentKind = (directory: string): Exclude<ContentKind, "modpack"> =>
  directory === "shaderpacks"
    ? "shader"
    : directory === "resourcepacks"
      ? "resourcepack"
      : directory === "datapacks"
        ? "datapack"
        : "mod";
const itemId = (item: InstalledContentReceipt) =>
  [
    item.provider,
    item.projectId,
    item.directory ?? "mods",
    item.worldName ?? "",
  ].join(":");

async function readReceipt(instance: string) {
  const receipt = path.join(instance, receiptName);
  try {
    const info = await lstat(receipt);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error("Metadata nội dung không hợp lệ.");
    const value = await readJson<InstalledContentReceipt[]>(receipt);
    if (!Array.isArray(value) || value.length > 10000)
      throw new Error("Metadata nội dung không hợp lệ.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function writeReceipt(
  instance: string,
  value: InstalledContentReceipt[],
) {
  const receipt = path.join(instance, receiptName);
  const temporary = receipt + ".tmp";
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, receipt);
}
function relativeDirectory(file: ContentFile, worldName?: string) {
  const directory = file.directory ?? "mods";
  if (directory !== "datapacks") return "game/" + directory;
  if (!worldName || path.basename(worldName) !== worldName)
    throw new Error("Hãy chọn world hợp lệ để cài data pack.");
  return "game/saves/" + worldName + "/datapacks";
}
export async function regularDirectory(root: string, relative: string) {
  let current = root;
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error("Thư mục dữ liệu không được là symlink.");
  for (const segment of relative.split("/")) {
    current = contentPath(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Thư mục mod không được là symlink.");
  }
  return current;
}
export async function installMods(
  root: string,
  instanceId: string,
  provider: ContentProvider,
  files: ContentFile[],
  staging: string,
  signal: AbortSignal,
  progress: (message: string, done: number, total: number) => void,
  options: { worldName?: string; replace?: boolean } = {},
) {
  const instance = await regularDirectory(root, "instances/" + instanceId);
  const directories = new Map<string, string>();
  for (const file of files) {
    const directory = file.directory ?? "mods";
    if (
      !["mods", "resourcepacks", "shaderpacks", "datapacks"].includes(directory)
    )
      throw new Error("Thư mục nội dung không hợp lệ.");
    directories.set(
      relativeDirectory(file, options.worldName),
      await regularDirectory(
        instance,
        relativeDirectory(file, options.worldName),
      ),
    );
  }
  const destination = (file: ContentFile) =>
    directories.get(relativeDirectory(file, options.worldName))!;
  const installed = await readReceipt(instance);
  const names = new Set<string>();
  for (const file of files) {
    if (
      path.basename(file.filename) !== file.filename ||
      !file.filename.endsWith(
        (file.directory ?? "mods") === "mods" ? ".jar" : ".zip",
      )
    )
      throw new Error("Mod phải là JAR; shader/texture pack phải là ZIP.");
    contentPath(destination(file), file.filename);
    const key = file.filename.normalize("NFC").toLowerCase();
    if (names.has(key)) throw new Error("Dependency có tên file trùng nhau.");
    names.add(key);
    if (
      installed.some(
        (item) =>
          item.provider === provider &&
          item.projectId === file.projectId &&
          item.versionId !== file.versionId &&
          !options.replace,
      )
    )
      throw new Error(
        "Instance đã có phiên bản khác của mod này. Không tự ghi đè mod đang có.",
      );
    const conflicts = new Set(file.conflicts ?? []);
    if (
      installed.some(
        (item) =>
          item.enabled !== false &&
          (conflicts.has(item.projectId) ||
            item.conflicts?.includes(file.projectId)),
      ) ||
      files.some((item) => item !== file && conflicts.has(item.projectId))
    )
      throw new Error("Nội dung xung đột với mod đã cài: " + file.filename);
  }
  for (let index = 0; index < files.length; index++) {
    signal.throwIfAborted();
    progress("Tải mod và dependency", index, files.length);
    await download(
      files[index].artifact,
      contentPath(staging, files[index].filename),
      signal,
    );
  }
  const added: string[] = [],
    backups: { from: string; to: string }[] = [];
  const temp = path.join(staging, "content.json");
  try {
    for (const file of files) {
      signal.throwIfAborted();
      const target = contentPath(destination(file), file.filename);
      const previous = installed.find(
        (item) =>
          item.provider === provider && item.projectId === file.projectId,
      );
      if (
        previous &&
        previous.versionId !== file.versionId &&
        options.replace
      ) {
        const previousDirectory = previous.directory ?? "mods";
        const previousRoot =
          previousDirectory === "datapacks"
            ? await regularDirectory(
                instance,
                "game/saves/" + previous.worldName + "/datapacks",
              )
            : await regularDirectory(instance, "game/" + previousDirectory);
        const previousFile = contentPath(
          previousRoot,
          previous.filename + (previous.enabled === false ? ".disabled" : ""),
        );
        if (
          previous.sha1 &&
          (await digest(previousFile, "sha1")) !== previous.sha1
        )
          throw new Error(
            "File đã được người dùng thay đổi; không tự cập nhật: " +
              previous.filename,
          );
        const backup = contentPath(staging, "backup-" + backups.length);
        await rename(previousFile, backup);
        backups.push({ from: backup, to: previousFile });
      }
      try {
        const info = await lstat(target);
        if (
          info.isSymbolicLink() ||
          !info.isFile() ||
          (await digest(target, "sha1")) !== file.artifact.sha1
        )
          throw new Error(
            "Không ghi đè file mod khác đang có: " + file.filename,
          );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await link(contentPath(staging, file.filename), target);
        added.push(target);
      }
    }
    const next: InstalledContentReceipt[] = [
      ...installed.filter(
        (item) =>
          !files.some(
            (file) =>
              item.provider === provider && item.projectId === file.projectId,
          ),
      ),
      ...files.map((file) => ({
        provider,
        projectId: file.projectId,
        versionId: file.versionId,
        filename: file.filename,
        directory: file.directory ?? "mods",
        ...(file.directory === "datapacks"
          ? { worldName: options.worldName }
          : {}),
        sha1: file.artifact.sha1,
        requiredProjectIds: file.required.flatMap((item) =>
          item.projectId ? [item.projectId] : [],
        ),
        conflicts: file.conflicts ?? [],
        enabled: true,
      })),
    ];
    await writeFile(temp, JSON.stringify(next));
    signal.throwIfAborted();
    await rename(temp, path.join(instance, receiptName));
  } catch (error) {
    for (const target of added) await rm(target, { force: true });
    for (const backup of backups) await rename(backup.from, backup.to);
    throw error;
  }
}

async function listFiles(directory: string) {
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) return [];
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.length > 10000) throw new Error("Thư mục chứa quá nhiều file.");
    return entries
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function contentInventory(
  root: string,
  instanceId: string,
): Promise<ContentInventory> {
  const instance = contentPath(root, "instances/" + instanceId);
  const game = contentPath(instance, "game");
  const receipt = await readReceipt(instance);
  const worlds: string[] = [];
  try {
    const entries = await readdir(path.join(game, "saves"), {
      withFileTypes: true,
    });
    worlds.push(
      ...entries
        .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
        .map((entry) => entry.name),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const locations: { directory: string; root: string; worldName?: string }[] = [
    { directory: "mods", root: path.join(game, "mods") },
    { directory: "resourcepacks", root: path.join(game, "resourcepacks") },
    { directory: "shaderpacks", root: path.join(game, "shaderpacks") },
    ...worlds.map((worldName) => ({
      directory: "datapacks",
      worldName,
      root: path.join(game, "saves", worldName, "datapacks"),
    })),
  ];
  const items: ContentInventory["items"] = [];
  let migratedReceipt = false;
  for (const location of locations) {
    for (const filename of await listFiles(location.root)) {
      if (!/\.(jar|zip)(?:\.disabled)?$/i.test(filename)) continue;
      const enabled = !filename.endsWith(".disabled");
      const base = enabled ? filename : filename.slice(0, -9);
      const managed = receipt.find(
        (item) =>
          (item.directory ?? "mods") === location.directory &&
          item.filename === base &&
          (item.worldName ?? "") === (location.worldName ?? ""),
      );
      const checksum = await digest(path.join(location.root, filename), "sha1");
      if (managed && !managed.sha1) {
        managed.sha1 = checksum;
        managed.directory =
          location.directory as InstalledContentReceipt["directory"];
        managed.worldName = location.worldName;
        migratedReceipt = true;
      }
      items.push({
        id: managed
          ? itemId(managed)
          : "file:" +
            location.directory +
            ":" +
            (location.worldName ?? "") +
            ":" +
            base,
        provider: managed?.provider ?? null,
        kind: contentKind(location.directory),
        projectId: managed?.projectId ?? null,
        versionId: managed?.versionId ?? null,
        filename: base,
        directory: location.directory,
        ...(location.worldName ? { worldName: location.worldName } : {}),
        enabled,
        managed: Boolean(managed),
        modified: Boolean(managed?.sha1 && managed.sha1 !== checksum),
      });
    }
  }
  if (migratedReceipt) await writeReceipt(instance, receipt);
  const pack = await readModpackReceipt(instance);
  if (pack?.source) {
    let modified = false;
    for (const [relative, checksum] of Object.entries(pack.files)) {
      try {
        if ((await digest(contentPath(game, relative), "sha1")) !== checksum) {
          modified = true;
          break;
        }
      } catch {
        modified = true;
        break;
      }
    }
    items.unshift({
      id: "modpack:" + pack.source.provider + ":" + pack.source.projectId,
      provider: pack.source.provider,
      kind: "modpack",
      projectId: pack.source.projectId,
      versionId: pack.source.versionId,
      filename: pack.name ?? "Modpack " + pack.source.projectId,
      directory: "modpack",
      enabled: true,
      managed: true,
      modified,
    });
  }
  return { instanceId, worlds: worlds.sort(), items };
}

export async function mutateInstalledContent(
  root: string,
  instanceId: string,
  id: string,
  action: "enable" | "disable" | "remove",
) {
  const instance = contentPath(root, "instances/" + instanceId);
  const receipt = await readReceipt(instance);
  const item = receipt.find((entry) => itemId(entry) === id);
  if (!item)
    throw new Error("Chỉ có thể thay đổi nội dung do launcher quản lý.");
  if (
    (action === "remove" || action === "disable") &&
    receipt.some(
      (entry) =>
        entry.enabled !== false &&
        entry.projectId !== item.projectId &&
        entry.requiredProjectIds?.includes(item.projectId),
    )
  )
    throw new Error(
      "Không thể xóa dependency đang được nội dung khác sử dụng.",
    );
  const relative =
    (item.directory === "datapacks"
      ? "game/saves/" + item.worldName + "/datapacks/"
      : "game/" + (item.directory ?? "mods") + "/") + item.filename;
  const enabled = contentPath(instance, relative);
  const disabled = enabled + ".disabled";
  if (action === "remove") {
    await rm(item.enabled === false ? disabled : enabled, { force: true });
    await writeReceipt(
      instance,
      receipt.filter((entry) => entry !== item),
    );
  } else {
    const nextEnabled = action === "enable";
    if ((item.enabled !== false) !== nextEnabled)
      await rename(
        nextEnabled ? disabled : enabled,
        nextEnabled ? enabled : disabled,
      );
    item.enabled = nextEnabled;
    await writeReceipt(instance, receipt);
  }
}

export async function mutateExternalContent(
  root: string,
  instanceId: string,
  item: InstalledContent,
  action: "enable" | "disable" | "remove",
) {
  if (
    item.managed ||
    !["mods", "resourcepacks", "shaderpacks", "datapacks"].includes(
      item.directory,
    ) ||
    path.basename(item.filename) !== item.filename ||
    (item.directory === "datapacks" &&
      (!item.worldName || path.basename(item.worldName) !== item.worldName))
  )
    throw new Error("File nội dung ngoài không hợp lệ.");
  const instance = contentPath(root, "instances/" + instanceId);
  const relative =
    (item.directory === "datapacks"
      ? "game/saves/" + item.worldName + "/datapacks/"
      : "game/" + item.directory + "/") + item.filename;
  const enabled = contentPath(instance, relative);
  const disabled = enabled + ".disabled";
  if (action === "remove")
    await rm(item.enabled ? enabled : disabled, { force: true });
  else {
    const nextEnabled = action === "enable";
    if (item.enabled !== nextEnabled)
      await rename(
        nextEnabled ? disabled : enabled,
        nextEnabled ? enabled : disabled,
      );
  }
}
