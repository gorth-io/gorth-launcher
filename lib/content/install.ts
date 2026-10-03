import path from "node:path";
import { mkdir, lstat, link, rm, writeFile, rename } from "node:fs/promises";
import { digest, download, readJson } from "@/lib/game/files";
import { contentPath } from "./packs";
import type { ContentFile, ContentProvider } from "./interface";
interface InstalledMod {
  provider: ContentProvider;
  projectId: string;
  versionId: string;
  filename: string;
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
) {
  const instance = await regularDirectory(root, "instances/" + instanceId);
  const directories = new Map<string, string>();
  for (const file of files) {
    const directory = file.directory ?? "mods";
    if (!["mods", "resourcepacks", "shaderpacks"].includes(directory))
      throw new Error("Thư mục nội dung không hợp lệ.");
    directories.set(
      directory,
      await regularDirectory(instance, "game/" + directory),
    );
  }
  const destination = (file: ContentFile) =>
    directories.get(file.directory ?? "mods")!;
  const receipt = path.join(instance, "content.json");
  let installed: InstalledMod[] = [];
  try {
    if (
      !(await lstat(receipt)).isFile() ||
      (await lstat(receipt)).isSymbolicLink()
    )
      throw new Error("Metadata mod không hợp lệ.");
    installed = await readJson<InstalledMod[]>(receipt);
    if (!Array.isArray(installed))
      throw new Error("Metadata mod không hợp lệ.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
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
          item.versionId !== file.versionId,
      )
    )
      throw new Error(
        "Instance đã có phiên bản khác của mod này. Không tự ghi đè mod đang có.",
      );
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
  const added: string[] = [];
  const temp = path.join(staging, "content.json");
  try {
    for (const file of files) {
      signal.throwIfAborted();
      const target = contentPath(destination(file), file.filename);
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
    const next = [
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
      })),
    ];
    await writeFile(temp, JSON.stringify(next));
    signal.throwIfAborted();
    await rename(temp, receipt);
  } catch (error) {
    for (const target of added) await rm(target, { force: true });
    throw error;
  }
}
