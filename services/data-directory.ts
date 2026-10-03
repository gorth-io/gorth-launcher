import { app } from "electron";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { getDataDirectory } from "@/lib/utils/data-directory";

export function configureDataDirectory() {
  const previous = app.getPath("userData");
  const explicitDirectory = app.commandLine.getSwitchValue("user-data-dir");
  const target = explicitDirectory
    ? path.resolve(explicitDirectory)
    : getDataDirectory(app.getPath("appData"));
  if (
    !explicitDirectory &&
    !existsSync(target) &&
    previous !== target &&
    existsSync(previous)
  ) {
    // Never copy a live Chromium/SQLite profile. Keep the old profile untouched.
    if (
      lstatSync(path.join(previous, "SingletonLock"), { throwIfNoEntry: false })
    ) {
      throw new Error(
        "Close the previous Launcher instance before migrating its data to " +
          target,
      );
    }
    mkdirSync(path.dirname(target), { recursive: true });
    const staging = mkdtempSync(
      path.join(path.dirname(target), ".Launcher-migration-"),
    );
    cpSync(previous, staging, {
      recursive: true,
      filter: (source) =>
        !["SingletonLock", "SingletonCookie", "SingletonSocket"].includes(
          path.basename(source),
        ),
    });
    renameSync(staging, target);
  }
  mkdirSync(target, { recursive: true });
  // Configure before ready: Chromium, cookies, caches and application files use this root.
  app.setPath("userData", target);
  app.setPath("sessionData", target);
  app.setAppLogsPath(path.join(target, "logs"));
}
