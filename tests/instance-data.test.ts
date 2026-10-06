import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { safeExtract, zipDirectory } from "@/lib/instance/archive";
import {
  nbtString,
  readServersNbt,
  serverCompounds,
  setNbtString,
  setServerCompounds,
  writeServersNbt,
} from "@/lib/instance/nbt";

test("servers.dat round trip preserves and updates server compounds", () => {
  const root = {};
  const first = {};
  setNbtString(first, "name", "Gorth");
  setNbtString(first, "ip", "play.gorth.local");
  setServerCompounds(root, [first]);
  const parsed = readServersNbt(writeServersNbt(root));
  const items = serverCompounds(parsed);
  assert.equal(nbtString(items[0], "name"), "Gorth");
  assert.equal(nbtString(items[0], "ip"), "play.gorth.local");
  setNbtString(items[0], "name", "Renamed");
  assert.equal(
    nbtString(serverCompounds(readServersNbt(writeServersNbt(parsed)))[0], "name"),
    "Renamed",
  );
});

test("instance ZIP export can be safely restored with nested world data", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "gorth-instance-data-"));
  try {
    const source = path.join(temporary, "source"), archive = path.join(temporary, "world.zip"), restored = path.join(temporary, "restored");
    await mkdir(path.join(source, "region"), { recursive: true });
    await writeFile(path.join(source, "level.dat"), "level");
    await writeFile(path.join(source, "region", "r.0.0.mca"), "region");
    await zipDirectory(source, archive);
    await mkdir(restored);
    await safeExtract(archive, restored);
    assert.equal(await readFile(path.join(restored, "level.dat"), "utf8"), "level");
    assert.equal(await readFile(path.join(restored, "region", "r.0.0.mca"), "utf8"), "region");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
