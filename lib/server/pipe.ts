import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

// Forge and Electron use this local IPC endpoint, never a second TCP port.
export function getDesktopPipe(root: string) {
  const id = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex")
    .slice(0, 16);
  if (process.platform === "win32")
    return { path: `\\\\.\\pipe\\gorth-desktop-${id}`, directory: null };
  const directory = path.join(
    tmpdir(),
    `gd-${process.getuid?.() ?? "user"}-${id}`,
  );
  return { path: path.join(directory, "server.sock"), directory };
}
