import { upsertUserProfile } from "@/services/user-profile";
import { BrowserWindow, ipcMain } from "electron";
import {
  openAuthView,
  closeAuthView,
  clearAuthBrowserSession,
  registerAuthViewIpc,
} from "@/main/services/auth-view";
import type {
  AuthCommand,
  AuthData,
  AuthResult,
  AuthSnapshot,
  GameAccount,
} from "@/lib/utils/interface";
import {
  ssoIssuer,
  ssoOAuthClientId,
  ssoRedirectUri,
} from "@/lib/utils/environment";
import { emptyAuthData, offlineUuid, username } from "./model";
import { readVault, writeVault, vaultExists } from "./vault";
import { gorthBinding, loginGorth, refreshGorth, revokeGorth } from "./gorth";
import { elyBinding } from "./ely";
import { gameBinding } from "./gorth-game";
import { AuthHttpError } from "./http";

let data: AuthData = emptyAuthData();
let loaded: Promise<void> | undefined;
let unlocked = false;
let pending: AuthSnapshot["pending"] = null;
let operation: AbortController | null = null;
function load() {
  return (loaded ??= readVault()
    .then((value) => {
      data = value;
      unlocked = true;
    })
    .catch((error) => {
      loaded = undefined;
      throw error;
    }));
}
function expectedBinding(account: GameAccount) {
  return account.provider === "ely" ? elyBinding() : gameBinding();
}
function snapshot(): AuthSnapshot {
  return {
    locked: !unlocked && vaultExists(),
    launcher: data.launcher
      ? {
          id: data.launcher.id,
          name: data.launcher.name,
          email: data.launcher.email,
          username: data.launcher.username,
          image: data.launcher.image,
          emailVerified: data.launcher.emailVerified,
          expiresAt: data.launcher.tokens.expiresAt,
          canRefresh:
            !!data.launcher.tokens.refreshToken &&
            data.launcher.tokens.binding === gorthBinding(),
          needsLogin:
            data.launcher.tokens.expiresAt <= Date.now() ||
            data.launcher.tokens.binding !== gorthBinding(),
        }
      : null,
    accounts: data.accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      username: a.username,
      uuid: a.uuid,
      expiresAt: a.tokens?.expiresAt ?? null,
      needsLogin:
        a.provider !== "offline" &&
        (!a.tokens ||
          a.tokens.expiresAt <= Date.now() ||
          a.tokens.binding !== expectedBinding(a)),
    })),
    selectedAccountId: data.selectedAccountId,
    pending,
    providers: {
      gorthLauncher: !!(ssoIssuer && ssoOAuthClientId && ssoRedirectUri),
      ely: false,
      gorthGame: false,
    },
  };
}
function changed() {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("auth:changed", snapshot());
}
async function save(next: AuthData) {
  await writeVault(next);
  data = next;
  changed();
}
async function upsert(account: GameAccount) {
  await save({
    ...data,
    accounts: [...data.accounts.filter((a) => a.id !== account.id), account],
    selectedAccountId: data.selectedAccountId ?? account.id,
  });
}
function command(value: unknown): AuthCommand {
  if (!value || typeof value !== "object")
    throw new Error("Yêu cầu auth không hợp lệ.");
  const c = value as Record<string, unknown>;
  if (c.action === "offline.add" && typeof c.username === "string")
    return { action: c.action, username: c.username };
  if (
    ["game.select", "game.remove", "game.refresh"].includes(String(c.action)) &&
    typeof c.id === "string" &&
    c.id.length <= 100
  )
    return { action: c.action, id: c.id } as AuthCommand;
  if (
    c.action === "gorth.game.login" &&
    typeof c.username === "string" &&
    typeof c.password === "string"
  )
    return { action: c.action, username: c.username, password: c.password };
  if (
    [
      "launcher.login",
      "launcher.register",
      "launcher.unlock",
      "launcher.logout",
      "launcher.refresh",
      "ely.login",
      "cancel",
    ].includes(String(c.action))
  )
    return { action: c.action } as AuthCommand;
  throw new Error("Yêu cầu auth không hợp lệ.");
}
function publicError(error: unknown) {
  if (error instanceof AuthHttpError) {
    if (error.code === "invalid_grant" || error.status === 401)
      return "Phiên đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.code === "access_denied") return "Đăng nhập bị từ chối.";
    if (error.code === "invalid_client")
      return "Client ID chưa đăng ký hoặc chưa được bật cho luồng đăng nhập này.";
    return "Dịch vụ xác thực từ chối yêu cầu. Kiểm tra cấu hình hoặc đăng nhập lại.";
  }
  if (error instanceof Error && /[À-ỹ]/u.test(error.message))
    return error.message;
  return "Không thể hoàn tất xác thực. Kiểm tra kết nối và cấu hình nhà cung cấp.";
}
async function refreshAccount(account: GameAccount, signal: AbortSignal) {
  signal.throwIfAborted();
  if (account.provider !== "offline")
    throw new Error(
      "Online game accounts are not enabled yet. Use an offline profile.",
    );
  return account;
}
async function execute(
  raw: unknown,
  owner: BrowserWindow,
): Promise<AuthResult> {
  let ownOperation: AbortController | null = null;
  let completed = false;
  let c: AuthCommand | undefined;
  try {
    c = command(raw);
    if (c.action === "ely.login" || c.action === "gorth.game.login")
      throw new Error("Hiện tại chỉ hỗ trợ đăng nhập Gorth SSO.");
    if (c.action === "cancel") {
      operation?.abort();
      return { ok: true, snapshot: snapshot() };
    }
    if (operation)
      throw new Error(
        "Một thao tác tài khoản đang chạy. Hãy hủy hoặc chờ hoàn tất.",
      );
    ownOperation = new AbortController();
    operation = ownOperation;
    const signal = ownOperation.signal;
    await load();
    signal.throwIfAborted();
    if (c.action === "launcher.unlock") {
      if (
        data.launcher &&
        data.launcher.tokens.binding === gorthBinding() &&
        data.launcher.tokens.expiresAt <= Date.now() + 30_000 &&
        data.launcher.tokens.refreshToken
      ) {
        const next = await refreshGorth(data.launcher, signal);
        signal.throwIfAborted();
        upsertUserProfile(next);
        await save({ ...data, launcher: next });
      }
      return { ok: true, snapshot: snapshot() };
    }
    switch (c.action) {
      case "offline.add": {
        const name = username(c.username.trim());
        const uuid = offlineUuid(name);
        if (
          data.accounts.some(
            (a) =>
              a.provider === "offline" &&
              a.username.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error("Tài khoản Offline đã tồn tại.");
        await upsert({
          id: "offline:" + uuid,
          provider: "offline",
          username: name,
          uuid,
        });
        break;
      }
      case "game.select":
      case "game.remove":
      case "game.refresh": {
        const id = c.id;
        const account = data.accounts.find((a) => a.id === id);
        if (!account) throw new Error("Không tìm thấy tài khoản game.");
        if (c.action === "game.select")
          await save({ ...data, selectedAccountId: account.id });
        else if (c.action === "game.remove") {
          const accounts = data.accounts.filter((a) => a.id !== account.id);
          await save({
            ...data,
            accounts,
            selectedAccountId:
              data.selectedAccountId === account.id
                ? (accounts[0]?.id ?? null)
                : data.selectedAccountId,
          });
        } else await upsert(await refreshAccount(account, signal));
        break;
      }
      case "launcher.login":
      case "launcher.register": {
        const mode = c.action === "launcher.register" ? "register" : "login";
        pending = {
          provider: "gorth",
          expiresAt: Date.now() + (mode === "register" ? 600_000 : 180_000),
        };
        changed();
        const session = await loginGorth(
          (url, receiveCallback) =>
            openAuthView(owner, url, receiveCallback, ownOperation!, mode),
          signal,
          mode,
        );
        signal.throwIfAborted();
        upsertUserProfile(session);
        await save({ ...data, launcher: session });
        completed = true;
        break;
      }
      case "launcher.logout": {
        const previous = data.launcher;
        await save({ ...data, launcher: null });
        await clearAuthBrowserSession();
        if (previous) await revokeGorth(previous.tokens, signal);
        break;
      }
      case "launcher.refresh": {
        if (!data.launcher) throw new Error("Chưa đăng nhập launcher.");
        const next = await refreshGorth(data.launcher, signal);
        signal.throwIfAborted();
        upsertUserProfile(next);
        await save({
          ...data,
          launcher: next,
        });
        break;
      }
    }
    return { ok: true, snapshot: { ...snapshot(), pending: null } };
  } catch (error) {
    if (
      ownOperation &&
      unlocked &&
      (c?.action === "launcher.refresh" ||
        (c?.action === "launcher.unlock" &&
          data.launcher &&
          data.launcher.tokens.expiresAt <= Date.now() + 30_000))
    ) {
      data = { ...data, launcher: null };
      try {
        await save(data);
      } catch {
        return {
          ok: false,
          error:
            "Phiên đã hết hạn nhưng không cập nhật được kho khóa. Hãy mở khóa rồi đăng nhập lại.",
          snapshot: snapshot(),
        };
      }
    } else if (
      ownOperation &&
      c?.action === "game.refresh" &&
      error instanceof AuthHttpError &&
      (["invalid_grant", "invalid_token"].includes(error.code) ||
        [401, 403].includes(error.status))
    ) {
      const id = c.id;
      await save({
        ...data,
        accounts: data.accounts.map((a) =>
          a.id === id ? { ...a, tokens: undefined } : a,
        ),
      });
    }
    return {
      ok: false,
      error: ownOperation?.signal.aborted
        ? "Đã hủy đăng nhập."
        : publicError(error),
      snapshot: { ...snapshot(), ...(ownOperation ? { pending: null } : {}) },
    };
  } finally {
    if (ownOperation && operation === ownOperation) {
      closeAuthView(owner, completed);
      operation = null;
      pending = null;
      changed();
    }
  }
}
export function registerAuthIpc() {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error("Untrusted auth sender");
    return window;
  };
  registerAuthViewIpc(trusted);
  ipcMain.handle("auth:snapshot", async (event) => {
    trusted(event);
    try {
      return { ok: true, snapshot: snapshot() };
    } catch {
      return {
        ok: false,
        error: "Không mở được kho tài khoản. Dữ liệu được giữ nguyên.",
        snapshot: snapshot(),
      };
    }
  });
  ipcMain.handle("auth:command", async (event, value: unknown) => {
    const owner = trusted(event);
    return execute(value, owner);
  });
}
export function cancelAuth() {
  operation?.abort();
}
// Main-process-only API for the future launch engine. Never expose this over IPC.
export async function resolveGameSession(accountId?: string | null) {
  await load();
  if (operation) throw new Error("Tài khoản đang được cập nhật.");
  const account = data.accounts.find(
    (a) => a.id === (accountId || data.selectedAccountId),
  );
  if (!account) throw new Error("Chọn tài khoản game trước khi chơi.");
  if (account.provider === "offline")
    return {
      username: account.username,
      uuid: account.uuid,
      accessToken: "0",
      authlibRoot: null,
    };
  throw new Error(
    "Online game accounts are not enabled yet. Use an offline profile.",
  );
}

export function getAuthenticatedUserId() {
  const current = snapshot().launcher;
  return unlocked && current && !current.needsLogin ? current.id : null;
}
