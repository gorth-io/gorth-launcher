import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { mkdir, stat } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import type {
  GameCommand,
  GameResult,
  GameSnapshot,
  GameStatus,
} from "@/lib/utils/interface";
import { resolveGameSession } from "@/lib/auth/service";
import {
  installGame,
  injector,
  launchArguments,
  validateInstance,
} from "./install";
import { memoryLimit } from "./java";
import { getJavaEnvironment } from "@/lib/utils/environment";
import { readJson } from "./files";
import { manifest } from "./metadata";
import { supportedRelease } from "./catalog";
import type { createLibraryStore } from "@/lib/library/store";
import type { Instance } from "@/lib/utils/interface";
import { contentIsBusy } from "@/lib/content/state";
export const gameIsBusy = () => active !== null || contentIsBusy();
export async function synchronizeGameLibrary(instances: Instance[]) {
  const ids = new Set(instances.map((item) => item.id));
  for (const id of jobs.keys())
    if (!ids.has(id) && active?.id !== id) jobs.delete(id);
  for (const item of instances) {
    if (jobs.has(item.id)) continue;
    try {
      const receipt = await readJson<{
        version: string;
        loader?: string;
        loaderVersion?: string | null;
      }>(path.join(root(), "instances", item.id, "installed.json"));
      if (
        receipt.version === item.version &&
        (receipt.loader ?? "Vanilla") === item.loader &&
        (receipt.loaderVersion ?? null) === (item.loaderVersion ?? null)
      )
        jobs.set(item.id, {
          instanceId: item.id,
          version: item.version,
          phase: "ready",
          message: "Đã cài đặt · Temurin",
          completed: 0,
          total: 0,
          logs: [],
        });
    } catch {
      /* An instance can exist before its first installation. */
    }
  }
  broadcast(true);
}
const jobs = new Map<string, GameStatus>();
let active: {
  id: string;
  controller: AbortController;
  child?: ChildProcess;
  stopTimer?: ReturnType<typeof setTimeout>;
} | null = null;
let lastBroadcast = 0;
const root = () => path.join(app.getPath("userData"), "minecraft");
const snapshot = (): GameSnapshot => ({
  directory: root(),
  jobs: [...jobs.values()],
  activeId: active?.id ?? null,
});
function broadcast(force = false) {
  if (!force && Date.now() - lastBroadcast < 150) return;
  lastBroadcast = Date.now();
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("game:changed", snapshot());
}
function update(id: string, values: Partial<GameStatus>, force = false) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, values);
  broadcast(force);
}
async function work(command: Extract<GameCommand, { instance: unknown }>) {
  const task = active!;
  const { instance, settings } = command;
  try {
    memoryLimit(settings.memory);
    const game = await installGame(
      root(),
      instance,
      settings,
      task.controller.signal,
      (message, completed, total) =>
        update(instance.id, {
          phase: "downloading",
          message,
          completed,
          total,
        }),
    );
    if (command.action === "install") {
      update(
        instance.id,
        {
          phase: "ready",
          message: "Đã cài Minecraft " + instance.version + " · Temurin",
        },
        true,
      );
      return;
    }
    task.controller.signal.throwIfAborted();
    update(
      instance.id,
      { phase: "starting", message: "Chuẩn bị tài khoản game…" },
      true,
    );
    const session = await resolveGameSession();
    task.controller.signal.throwIfAborted();
    const agent = session.authlibRoot
      ? await injector(root(), task.controller.signal)
      : undefined;
    const args = launchArguments(game, session, settings.memory, agent);
    task.controller.signal.throwIfAborted();
    const child = spawn(game.java, args, {
      cwd: game.gameDir,
      env: getJavaEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    task.child = child;
    const redact = (value: string) =>
      session.accessToken.length > 1
        ? value.replaceAll(session.accessToken, "[REDACTED]")
        : value;
    const collect = () => {
      const decoder = new StringDecoder("utf8");
      let remainder = "";
      return (chunk: Buffer) => {
        remainder += decoder.write(chunk);
        const lines = remainder.split(/\r?\n/);
        remainder = lines.pop() ?? "";
        const job = jobs.get(instance.id)!;
        // Never emit an incomplete token split across chunks.
        for (const line of lines) job.logs.push(redact(line).slice(0, 2000));
        if (remainder.length > 32_000) remainder = "";
        job.logs = job.logs.slice(-200);
        broadcast();
      };
    };
    child.stdout?.on("data", collect());
    child.stderr?.on("data", collect());
    child.once("spawn", () =>
      update(
        instance.id,
        {
          phase: "running",
          message: "Minecraft đang chạy · Eclipse Temurin",
        },
        true,
      ),
    );
    await new Promise<void>((resolve, reject) => {
      child.once("error", () =>
        reject(new Error("Không khởi chạy được Java. Kiểm tra Temurin.")),
      );
      child.once("close", (code, signal) => {
        if (task.stopTimer) clearTimeout(task.stopTimer);
        if (task.controller.signal.aborted || code === 0) {
          update(
            instance.id,
            {
              phase: "ready",
              message: task.controller.signal.aborted
                ? "Đã dừng Minecraft."
                : "Minecraft đã đóng.",
            },
            true,
          );
          resolve();
        } else
          reject(
            new Error(
              "Minecraft thoát bất thường (" +
                (code ?? signal) +
                "). Xem nhật ký trong Tải xuống.",
            ),
          );
      });
    });
  } catch (error) {
    update(
      instance.id,
      {
        phase: task.controller.signal.aborted ? "cancelled" : "error",
        message: task.controller.signal.aborted
          ? "Đã hủy. Các file đã tải được giữ để tiếp tục."
          : error instanceof Error
            ? error.message
            : "Không thể tải/chạy Minecraft.",
      },
      true,
    );
  } finally {
    if (active === task) active = null;
    broadcast(true);
  }
}
function parse(raw: unknown): GameCommand {
  if (!raw || typeof raw !== "object")
    throw new Error("Yêu cầu game không hợp lệ.");
  const c = raw as GameCommand;
  if (
    (c.action === "stop" || c.action === "cancel") &&
    typeof c.id === "string"
  )
    return c;
  if (
    (c.action === "install" || c.action === "play") &&
    c.settings &&
    typeof c.settings.javaPath === "string" &&
    c.settings.javaPath.length < 4096
  ) {
    validateInstance(c.instance);
    memoryLimit(c.settings.memory);
    return c;
  }
  throw new Error("Yêu cầu game không hợp lệ.");
}
export function cancelGame() {
  if (!active) return;
  active.controller.abort();
  if (active.child) {
    update(
      active.id,
      { phase: "stopping", message: "Đang dừng Minecraft…" },
      true,
    );
    active.child.kill();
    if (!active.stopTimer) {
      const child = active.child;
      active.stopTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
      active.stopTimer.unref();
    }
  }
}
export async function registerGameIpc(
  library: Awaited<ReturnType<typeof createLibraryStore>>,
) {
  await synchronizeGameLibrary(library.snapshot().instances);
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted game sender");
  };
  ipcMain.handle("game:snapshot", (event) => {
    trusted(event);
    return snapshot();
  });
  ipcMain.handle("game:open-directory", async (event, id?: unknown) => {
    trusted(event);
    try {
      let directory = root();
      if (id !== undefined) {
        if (
          typeof id !== "string" ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
          !jobs.has(id)
        )
          throw new Error("Instance không hợp lệ.");
        directory = path.join(directory, "instances", id, "game");
        if (!(await stat(directory)).isDirectory())
          throw new Error("Chưa có thư mục game.");
      } else {
        await mkdir(directory, { recursive: true });
      }
      const error = await shell.openPath(directory);
      return { ok: !error, error: error || undefined };
    } catch {
      return { ok: false, error: "Không mở được thư mục. Hãy tải game trước." };
    }
  });
  ipcMain.handle("game:versions", async (event) => {
    trusted(event);
    return (await manifest(root(), AbortSignal.timeout(20_000))).versions
      .filter(supportedRelease)
      .map((v) => ({ id: v.id, type: v.type }));
  });
  ipcMain.handle("game:command", (event, raw: unknown): GameResult => {
    trusted(event);
    try {
      const command = parse(raw);
      if (command.action === "stop" || command.action === "cancel") {
        if (active?.id !== command.id)
          throw new Error("Instance này không có tác vụ đang chạy.");
        cancelGame();
        return { ok: true, snapshot: snapshot() };
      }
      if (!("instance" in command)) throw new Error("Yêu cầu không hợp lệ.");
      if (library.isWorking())
        throw new Error("Đang xử lý dữ liệu instance. Vui lòng chờ.");
      command.instance = library.getInstance(command.instance.id);
      command.settings = library.snapshot().settings;
      validateInstance(command.instance);
      if (gameIsBusy())
        throw new Error("Hãy chờ hoặc dừng game/tác vụ hiện tại.");
      active = { id: command.instance.id, controller: new AbortController() };
      jobs.set(active.id, {
        instanceId: active.id,
        version: command.instance.version,
        phase: "checking",
        message: "Đang kiểm tra Minecraft và Temurin…",
        completed: 0,
        total: 0,
        logs: [],
      });
      broadcast(true);
      void work(command);
      return { ok: true, snapshot: snapshot() };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Yêu cầu game thất bại.",
        snapshot: snapshot(),
      };
    }
  });
  await synchronizeGameLibrary(library.snapshot().instances);
}
