import { createHash } from "node:crypto";
import type { AuthData, Tokens } from "@/lib/utils/interface";
import { parseHttpUrl } from "@/lib/utils/schema";
export function emptyAuthData(): AuthData {
  return { version: 1, launcher: null, accounts: [], selectedAccountId: null };
}
export function username(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_]{3,16}$/.test(value))
    throw new Error("Tên Minecraft cần 3–16 ký tự chữ, số hoặc dấu gạch dưới.");
  return value;
}
export function offlineUuid(name: string) {
  const bytes = createHash("md5")
    .update("OfflinePlayer:" + username(name), "utf8")
    .digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes.toString("hex");
}
export function profile(value: unknown): { username: string; uuid: string } {
  const data = value as { name?: unknown; id?: unknown };
  const name = username(data?.name);
  if (typeof data.id !== "string") throw new Error("Hồ sơ game không hợp lệ.");
  const uuid = data.id.replaceAll("-", "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(uuid)) throw new Error("UUID game không hợp lệ.");
  return { username: name, uuid };
}
export function trustedUrl(value: string, allowLoopback = false) {
  const url = parseHttpUrl(value);
  const local =
    allowLoopback && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Auth URL cần HTTPS (HTTP chỉ cho localhost).");
  return url;
}
export function tokenSet(
  data: Record<string, unknown>,
  binding: string,
  previous?: Tokens,
): Tokens {
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    String(data.token_type).toLowerCase() !== "bearer"
  )
    throw new Error("Phản hồi token không hợp lệ.");
  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === "string"
        ? data.refresh_token
        : previous?.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    binding,
  };
}
