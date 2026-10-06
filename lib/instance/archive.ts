import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import {
  lstat,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { once } from "node:events";
import extract from "extract-zip";
import { contentPath } from "@/lib/content/packs";

const table = Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++)
    value = (value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1) >>> 0;
  return value;
});
async function fileCrc(file: string) {
  let crc = 0xffffffff;
  for await (const chunk of createReadStream(file))
    for (const byte of chunk as Buffer)
      crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
async function files(
  root: string,
  current = root,
  result: { file: string; name: string; size: number }[] = [],
) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const file = path.join(current, entry.name),
      info = await lstat(file);
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
      throw new Error("Instance chứa symlink hoặc file đặc biệt.");
    if (entry.isDirectory()) await files(root, file, result);
    else
      result.push({
        file,
        name: path.relative(root, file).split(path.sep).join("/"),
        size: info.size,
      });
    if (result.length > 100_000)
      throw new Error("Instance có quá nhiều file để xuất.");
  }
  return result;
}
export async function zipDirectory(root: string, destination: string) {
  const entries = await files(root),
    output = createWriteStream(destination, { flags: "wx" });
  let offset = 0;
  const central: Buffer[] = [];
  const write = async (data: Buffer) => {
    if (!output.write(data)) await once(output, "drain");
    offset += data.length;
  };
  try {
    for (const entry of entries) {
      const name = Buffer.from(entry.name),
        crc = await fileCrc(entry.file),
        start = offset;
      const local = Buffer.concat([
        u32(0x04034b50),
        u16(20),
        u16(0x800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.size),
        u32(entry.size),
        u16(name.length),
        u16(0),
        name,
      ]);
      await write(local);
      for await (const chunk of createReadStream(entry.file))
        await write(chunk as Buffer);
      central.push(
        Buffer.concat([
          u32(0x02014b50),
          u16(20),
          u16(20),
          u16(0x800),
          u16(0),
          u16(0),
          u16(0),
          u32(crc),
          u32(entry.size),
          u32(entry.size),
          u16(name.length),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          u32(0),
          u32(start),
          name,
        ]),
      );
    }
    const start = offset;
    for (const item of central) await write(item);
    const size = offset - start;
    await write(
      Buffer.concat([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(central.length),
        u16(central.length),
        u32(size),
        u32(start),
        u16(0),
      ]),
    );
    output.end();
    await once(output, "close");
  } catch (error) {
    output.destroy();
    throw error;
  }
}

export async function safeExtract(archive: string, target: string) {
  if ((await stat(archive)).size > 4 * 1024 ** 3)
    throw new Error("Archive vượt 4 GB.");
  let total = 0,
    count = 0;
  const seen = new Set<string>();
  await extract(archive, {
    dir: target,
    onEntry(entry) {
      const name = entry.fileName.replace(/\/$/, "");
      contentPath(target, name);
      total += entry.uncompressedSize;
      const key = name.normalize("NFC").toLowerCase();
      if (
        ++count > 100_000 ||
        total > 30 * 1024 ** 3 ||
        ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000 ||
        seen.has(key)
      )
        throw new Error("Archive không an toàn hoặc vượt giới hạn.");
      seen.add(key);
    },
  });
}

export async function writeExportMetadata(
  staging: string,
  instance: {
    name: string;
    version: string;
    loader: string;
    loaderVersion?: string | null;
  },
) {
  await writeFile(
    path.join(staging, "instance.cfg"),
    `InstanceType=OneSix\nname=${instance.name.replace(/[\r\n=]/g, " ")}\n`,
  );
  const uid =
    instance.loader === "Fabric"
      ? "net.fabricmc.fabric-loader"
      : instance.loader === "Forge"
        ? "net.minecraftforge"
        : instance.loader === "NeoForge"
          ? "net.neoforged"
          : null;
  const components = [
    { uid: "net.minecraft", version: instance.version, important: true },
    ...(uid ? [{ uid, version: instance.loaderVersion, important: true }] : []),
  ];
  await writeFile(
    path.join(staging, "mmc-pack.json"),
    JSON.stringify({ formatVersion: 1, components }, null, 2),
  );
  await writeFile(
    path.join(staging, "gorth-instance.json"),
    JSON.stringify({ formatVersion: 1, ...instance }, null, 2),
  );
}

export async function locateImportRoot(root: string) {
  let current = root;
  for (let depth = 0; depth < 4; depth++) {
    const names = await readdir(current);
    if (
      names.some((name) =>
        [
          "instance.cfg",
          "mmc-pack.json",
          "instance.json",
          "manifest.json",
          "gorth-instance.json",
        ].includes(name),
      )
    )
      return current;
    const directories = [] as string[];
    for (const name of names) {
      const file = path.join(current, name);
      if ((await lstat(file)).isDirectory()) directories.push(file);
    }
    if (directories.length !== 1) break;
    current = directories[0];
  }
  throw new Error(
    "Không tìm thấy metadata Prism/MultiMC/FTB trong nguồn import.",
  );
}
export async function jsonIfExists(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
