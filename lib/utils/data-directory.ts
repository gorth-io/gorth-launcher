import os from "node:os";
import path from "node:path";

// Node-only helper shared by Electron main and Drizzle CLI.
export function getDataDirectory(appData?: string) {
  const base = appData ?? (process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support")
    : process.platform === "win32"
      ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"));
  return path.join(base, "Gorth", "Launcher");
}
