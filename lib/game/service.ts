import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import type {
  GameCommand,
  GameResult,
  GameSnapshot,
  GameStatus,
  Instance,
  InstanceSettings,
  PlaySession,
} from "@/lib/utils/interface";
import { resolveGameSession } from "@/lib/auth/service";
import {
  installGame,
  injector,
  legacyArguments,
  launchArguments,
  validateInstance,
} from "./install";
import { memoryLimit } from "./java";
import { getJavaEnvironment } from "@/lib/utils/environment";
import { readJson } from "./files";
import { manifest } from "./metadata";
import { supportedRelease } from "./catalog";
import type { createLibraryStore } from "@/services/library-store";
import { contentIsBusy } from "@/lib/content/state";
import { transferProgress } from "./transfer";

interface WorkCommand {
  action: "install" | "play";
  instance: Instance;
  settings: InstanceSettings;
}
interface Task {
  id: string;
  command: WorkCommand;
  controller: AbortController;
  child?: ChildProcess;
  stopTimer?: ReturnType<typeof setTimeout>;
  state: "queued" | "downloading" | "paused" | "starting" | "running";
  progressAt: number;
  progressValue: number;
}
const jobs = new Map<string, GameStatus>(),
  tasks = new Map<string, Task>();
const queue: string[] = [];
let downloadingId: string | null = null,
  lastBroadcast = 0;
let shuttingDown = false;
let historyProvider = () => [] as PlaySession[];
const root = () => path.join(app.getPath("userData"), "minecraft");
export const gameIsBusy = () => tasks.size > 0 || contentIsBusy();
const activeIds = () =>
  [...tasks.values()]
    .filter((task) => task.state === "running")
    .map((task) => task.id);
const snapshot = (): GameSnapshot => ({
  directory: root(),
  jobs: [...jobs.values()],
  activeId: activeIds()[0] ?? downloadingId,
  activeIds: activeIds(),
  downloadingId,
  queue: [...queue],
  history: historyProvider(),
});
function broadcast(force = false) {
  if (!force && Date.now() - lastBroadcast < 150) return;
  lastBroadcast = Date.now();
  const value = snapshot();
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("game:changed", value);
}
function update(id: string, values: Partial<GameStatus>, force = false) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, values);
  broadcast(force);
}
function refreshQueue() {
  queue.forEach((id, index) =>
    update(id, {
      queuePosition: index + 1,
      phase:
        tasks.get(id)?.state === "downloading"
          ? "downloading"
          : tasks.get(id)?.state === "paused"
            ? "paused"
            : "queued",
    }),
  );
  broadcast(true);
}
export function diagnoseCrash(logs: string[]) {
  const text = logs.slice(-100).join("\n").toLowerCase();
  if (text.includes("outofmemoryerror"))
    return "Minecraft hết RAM. Hãy tăng RAM tối đa hoặc giảm mod/resource pack.";
  if (
    text.includes("modresolutionexception") ||
    text.includes("missing mandatory dependencies")
  )
    return "Có mod thiếu dependency hoặc không tương thích phiên bản.";
  if (text.includes("unsupportedclassversionerror"))
    return "Java runtime không đúng phiên bản Minecraft/mod loader.";
  if (text.includes("glfw error") || text.includes("opengl"))
    return "Có thể là lỗi GPU/OpenGL. Hãy cập nhật driver hoặc kiểm tra tùy chọn GPU.";
  if (text.includes("mixin") || text.includes("failed to load class"))
    return "Có khả năng xung đột mod hoặc Mixin.";
  return "Hãy xem các dòng ERROR cuối console và crash report để xác định mod gây lỗi.";
}
async function lifecycle(
  value: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  signal: AbortSignal,
) {
  const parts = legacyArguments(value);
  if (!parts.length) return;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(parts[0], parts.slice(1), {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    const abort = () => child.kill();
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", () =>
      reject(new Error("Không chạy được lệnh vòng đời: " + parts[0])),
    );
    child.once("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(new Error("Lệnh vòng đời thoát với mã " + code + "."));
    });
  });
}
function releaseDownload(id: string) {
  if (downloadingId === id) downloadingId = null;
  const index = queue.indexOf(id);
  if (index >= 0) queue.splice(index, 1);
  refreshQueue();
  void schedule();
}
async function launch(
  task: Task,
  game: Awaited<ReturnType<typeof installGame>>,
  record: (session: PlaySession) => void,
) {
  const { instance, settings } = task.command,
    session = await resolveGameSession(settings.accountId),
    agent = session.authlibRoot
      ? await injector(root(), task.controller.signal)
      : undefined,
    environment = getJavaEnvironment(
      settings.environment,
      settings.gpuPreference,
    );
  if (settings.preLaunchCommand)
    await lifecycle(
      settings.preLaunchCommand,
      game.gameDir,
      environment,
      task.controller.signal,
    );
  task.controller.signal.throwIfAborted();
  update(
    instance.id,
    { phase: "starting", message: "Đang khởi chạy Minecraft…" },
    true,
  );
  const child = spawn(
    game.java,
    launchArguments(game, session, settings, agent),
    {
      cwd: game.gameDir,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  task.child = child;
  task.state = "running";
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
      for (const line of lines) job.logs.push(redact(line).slice(0, 2000));
      if (remainder.length > 32_000) remainder = "";
      job.logs = job.logs.slice(-1000);
      broadcast();
    };
  };
  child.stdout?.on("data", collect());
  child.stderr?.on("data", collect());
  const startedAt = Date.now();
  child.once("spawn", () =>
    update(
      instance.id,
      { phase: "running", message: "Minecraft đang chạy · Eclipse Temurin" },
      true,
    ),
  );
  const exit = await new Promise<{
    code: number | null;
    signal: string | null;
  }>((resolve, reject) => {
    child.once("error", () =>
      reject(new Error("Không khởi chạy được Java. Kiểm tra Temurin.")),
    );
    child.once("close", (code, signal) => {
      if (task.stopTimer) clearTimeout(task.stopTimer);
      resolve({ code, signal });
    });
  });
  const endedAt = Date.now(),
    crashed = !task.controller.signal.aborted && exit.code !== 0;
  record({
    id: randomUUID(),
    instanceId: instance.id,
    startedAt,
    endedAt,
    duration: endedAt - startedAt,
    exitCode: exit.code,
    crashed,
  });
  if (settings.postExitCommand && !task.controller.signal.aborted)
    await lifecycle(
      settings.postExitCommand,
      game.gameDir,
      environment,
      task.controller.signal,
    );
  if (crashed) {
    const hint = diagnoseCrash(jobs.get(instance.id)?.logs ?? []);
    update(
      instance.id,
      {
        phase: "crashed",
        message: `Minecraft crash (${exit.code ?? exit.signal}).`,
        crashHint: hint,
      },
      true,
    );
  } else
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
}
async function work(task: Task, record: (session: PlaySession) => void) {
  const { instance, settings } = task.command;
  try {
    task.state = "downloading";
    task.progressAt = Date.now();
    task.progressValue = 0;
    update(
      instance.id,
      {
        phase: "checking",
        message: "Đang kiểm tra Minecraft và Temurin…",
        queuePosition: null,
      },
      true,
    );
    let transferred = 0;
    const started = Date.now();
    const game = await transferProgress.run(
      (bytes) => {
        transferred += bytes;
        update(instance.id, {
          speed: transferred / Math.max((Date.now() - started) / 1000, 0.1),
        });
      },
      () =>
        installGame(
          root(),
          instance,
          settings,
          task.controller.signal,
          (message, completed, total) => {
            const now = Date.now(),
              delta = completed - task.progressValue,
              seconds = Math.max((now - task.progressAt) / 1000, 0.001),
              speed =
                delta > 0
                  ? delta / seconds
                  : (jobs.get(instance.id)?.speed ?? 0);
            if (delta > 0) {
              task.progressAt = now;
              task.progressValue = completed;
            }
            update(instance.id, {
              phase: "downloading",
              message,
              completed,
              total,
              eta:
                speed > 0 && total > completed
                  ? (total - completed) / speed
                  : null,
            });
          },
        ),
    );
    if (task.command.action === "install") {
      tasks.delete(instance.id);
      releaseDownload(instance.id);
      update(
        instance.id,
        {
          phase: "ready",
          message: `Đã cài Minecraft ${instance.version} · Temurin`,
          speed: 0,
          eta: null,
        },
        true,
      );
      return;
    }
    task.state = "starting";
    task.controller.signal.throwIfAborted();
    releaseDownload(instance.id);
    await launch(task, game, record);
    tasks.delete(instance.id);
  } catch (error) {
    const paused = task.controller.signal.reason === "pause";
    releaseDownload(instance.id);
    if (paused) {
      task.state = "paused";
      task.controller = new AbortController();
      update(
        instance.id,
        {
          phase: "paused",
          message: "Đã tạm dừng. File hoàn tất được giữ lại.",
          speed: 0,
          eta: null,
        },
        true,
      );
      return;
    }
    tasks.delete(instance.id);
    update(
      instance.id,
      {
        phase: task.controller.signal.aborted ? "cancelled" : "error",
        message: task.controller.signal.aborted
          ? "Đã hủy. Các file hoàn tất được giữ lại."
          : error instanceof Error
            ? error.message
            : "Không thể tải/chạy Minecraft.",
        speed: 0,
        eta: null,
      },
      true,
    );
  } finally {
    broadcast(true);
  }
}
async function schedule() {
  if (downloadingId || shuttingDown) return;
  const id = queue.find((value) => tasks.get(value)?.state === "queued");
  if (!id) return;
  downloadingId = id;
  const task = tasks.get(id)!;
  void work(task, recordSession);
}
let recordSession: (session: PlaySession) => void = () => undefined;
export async function synchronizeGameLibrary(instances: Instance[]) {
  const ids = new Set(instances.map((item) => item.id));
  for (const id of jobs.keys())
    if (!ids.has(id) && !tasks.has(id)) jobs.delete(id);
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
          speed: 0,
          eta: null,
          queuePosition: null,
        });
    } catch {
      /* not installed */
    }
  }
  broadcast(true);
}
function parse(raw: unknown): GameCommand {
  if (!raw || typeof raw !== "object")
    throw new Error("Yêu cầu game không hợp lệ.");
  const command = raw as GameCommand;
  if (
    ["stop", "cancel", "pause", "resume"].includes(command.action) &&
    "id" in command &&
    typeof command.id === "string"
  )
    return command;
  if (
    (command.action === "install" || command.action === "play") &&
    "instance" in command
  ) {
    validateInstance(command.instance);
    return command;
  }
  throw new Error("Yêu cầu game không hợp lệ.");
}
function stopTask(id: string, cancel = false) {
  const task = tasks.get(id);
  if (!task) throw new Error("Instance này không có tác vụ đang chạy.");
  if (task.state === "queued" || task.state === "paused") {
    const index = queue.indexOf(id);
    if (index >= 0) queue.splice(index, 1);
    tasks.delete(id);
    update(
      id,
      {
        phase: "cancelled",
        message: "Đã hủy khỏi hàng đợi.",
        queuePosition: null,
      },
      true,
    );
    refreshQueue();
    return;
  }
  task.controller.abort(cancel ? "cancel" : "stop");
  if (task.child) {
    update(id, { phase: "stopping", message: "Đang dừng Minecraft…" }, true);
    task.child.kill();
    task.stopTimer = setTimeout(() => task.child?.kill("SIGKILL"), 5000);
    task.stopTimer.unref();
  }
}
export function cancelGame() {
  shuttingDown = true;
  for (const id of [...tasks.keys()])
    try {
      stopTask(id, true);
    } catch {
      /* shutdown */
    }
}
export async function registerGameIpc(
  library: Awaited<ReturnType<typeof createLibraryStore>>,
) {
  historyProvider = library.playHistory;
  recordSession = library.recordPlaySession;
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
  ipcMain.handle("game:open-directory", async (event, value?: unknown) => {
    trusted(event);
    try {
      let directory = root();
      if (value !== undefined) {
        if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
          throw new Error();
        library.getInstance(value);
        directory = path.join(directory, "instances", value, "game");
        if (!(await stat(directory)).isDirectory()) throw new Error();
      } else await mkdir(directory, { recursive: true });
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
      .map((version) => ({ id: version.id, type: version.type }));
  });
  ipcMain.handle("game:export-log", async (event, raw) => {
    trusted(event);
    try {
      const id = String(raw?.id ?? "");
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !jobs.has(id))
        throw new Error("Instance không hợp lệ.");
      const selected = await dialog.showSaveDialog(
        BrowserWindow.fromWebContents(event.sender)!,
        {
          defaultPath: `${id}-console.log`,
          filters: [{ name: "Log", extensions: ["log"] }],
        },
      );
      if (selected.canceled || !selected.filePath) return { ok: true };
      await writeFile(selected.filePath, jobs.get(id)!.logs.join("\n"));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Không xuất được console.",
      };
    }
  });
  ipcMain.handle("game:command", (event, raw: unknown): GameResult => {
    trusted(event);
    try {
      const command = parse(raw);
      if ("id" in command) {
        const task = tasks.get(command.id);
        if (command.action === "pause") {
          if (!task || !["queued", "downloading"].includes(task.state))
            throw new Error("Chỉ có thể tạm dừng tác vụ tải.");
          if (task.state === "downloading") task.controller.abort("pause");
          else {
            task.state = "paused";
            update(
              command.id,
              { phase: "paused", message: "Đã tạm dừng." },
              true,
            );
          }
        } else if (command.action === "resume") {
          if (!task || task.state !== "paused")
            throw new Error("Tác vụ chưa tạm dừng.");
          task.state = "queued";
          if (!queue.includes(command.id)) queue.push(command.id);
          refreshQueue();
          void schedule();
        } else stopTask(command.id, command.action === "cancel");
        return { ok: true, snapshot: snapshot() };
      }
      if (library.isWorking() || contentIsBusy())
        throw new Error("Đang xử lý dữ liệu instance hoặc nội dung.");
      command.instance = library.getInstance(command.instance.id);
      validateInstance(command.instance);
      const settings = library.snapshot().instanceSettings[command.instance.id];
      if (!settings) throw new Error("Không tìm thấy cấu hình instance.");
      memoryLimit(settings.memoryMin);
      memoryLimit(settings.memoryMax);
      if (tasks.has(command.instance.id))
        throw new Error("Instance này đã có tác vụ hoặc đang chạy.");
      const task: Task = {
        id: command.instance.id,
        command: { ...command, settings },
        controller: new AbortController(),
        state: "queued",
        progressAt: Date.now(),
        progressValue: 0,
      };
      tasks.set(task.id, task);
      queue.push(task.id);
      jobs.set(task.id, {
        instanceId: task.id,
        version: command.instance.version,
        phase: "queued",
        message: "Đang chờ tải xuống…",
        completed: 0,
        total: 0,
        logs: [],
        speed: 0,
        eta: null,
        queuePosition: queue.length,
      });
      refreshQueue();
      void schedule();
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
}
