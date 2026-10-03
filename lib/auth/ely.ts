import { setTimeout as delay } from "node:timers/promises";
import { elyClientId } from "@/lib/utils/environment";
import { parseHttpsUrl } from "@/lib/utils/schema";
import { profile, tokenSet } from "./model";
import type { GameAccount } from "@/lib/utils/interface";
import { AuthHttpError, formRequest, requestJson } from "./http";
const root = "https://account.ely.by";
const scopes = "account_info offline_access minecraft_server_session";
export const elyBinding = () => root + "|" + elyClientId;
async function account(
  data: Record<string, unknown>,
  signal: AbortSignal,
  old?: GameAccount,
): Promise<GameAccount> {
  if (
    typeof data.scope === "string" &&
    !data.scope.split(" ").includes("minecraft_server_session")
  )
    throw new Error("Ely.by chưa cấp quyền phiên Minecraft.");
  const tokens = tokenSet(data, elyBinding(), old?.tokens);
  const player = profile(
    await requestJson(
      root + "/api/mojang/services/minecraft/profile",
      { headers: { Authorization: "Bearer " + tokens.accessToken } },
      signal,
    ),
  );
  if (old && old.uuid !== player.uuid)
    throw new Error("Hồ sơ Ely.by thay đổi khi refresh.");
  return { id: "ely:" + player.uuid, provider: "ely", ...player, tokens };
}
export async function loginEly(
  open: (url: string) => Promise<void>,
  showCode: (code: string, url: string, expiresAt: number) => void,
  signal: AbortSignal,
) {
  if (!elyClientId) throw new Error("Chưa cấu hình ELY_CLIENT_ID.");
  const data = await formRequest(
    root + "/api/oauth2/v1/devicecode",
    { client_id: elyClientId, scope: scopes },
    signal,
  );
  if (
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_uri !== "string" ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  )
    throw new Error("Phản hồi device login không hợp lệ.");
  const verifyUrl = parseHttpsUrl(data.verification_uri);
  if (verifyUrl.origin !== root || verifyUrl.username || verifyUrl.password)
    throw new Error("URL xác thực Ely.by không hợp lệ.");
  const expiresAt = Date.now() + Math.min(data.expires_in, 900) * 1000;
  let interval =
    typeof data.interval === "number" && Number.isFinite(data.interval)
      ? Math.max(5, data.interval)
      : 5;
  showCode(data.user_code, verifyUrl.href, expiresAt);
  await open(verifyUrl.href);
  while (Date.now() < expiresAt) {
    await delay(interval * 1000, undefined, { signal });
    if (Date.now() >= expiresAt) break;
    try {
      return await account(
        await formRequest(
          root + "/api/oauth2/v1/token",
          {
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: elyClientId,
            device_code: data.device_code,
          },
          signal,
        ),
        signal,
      );
    } catch (error) {
      if (
        error instanceof AuthHttpError &&
        error.code === "authorization_pending"
      )
        continue;
      if (error instanceof AuthHttpError && error.code === "slow_down") {
        interval += 5;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Mã Ely.by hết hạn. Vui lòng đăng nhập lại.");
}
export async function refreshEly(old: GameAccount, signal: AbortSignal) {
  if (old.tokens?.binding !== elyBinding() || !old.tokens.refreshToken)
    throw new Error("Cần đăng nhập lại Ely.by.");
  return account(
    await formRequest(
      root + "/api/oauth2/v1/token",
      {
        grant_type: "refresh_token",
        client_id: elyClientId,
        refresh_token: old.tokens.refreshToken,
        scope: scopes,
      },
      signal,
    ),
    signal,
    old,
  );
}
