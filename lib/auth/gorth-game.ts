import { randomUUID } from "node:crypto";
import { gorthGameUrl } from "@/lib/utils/environment";
import { parseHttpUrl } from "@/lib/utils/schema";
import { profile, trustedUrl } from "./model";
import type { GameAccount } from "@/lib/utils/interface";
import { requestJson } from "./http";
export const gameBinding = () => gorthGameUrl;
async function yggdrasil(
  action: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
) {
  if (!gorthGameUrl)
    throw new Error(
      "Chưa cấu hình dịch vụ Minecraft Gorth (GORTH_GAME_AUTH_URL).",
    );
  const root = trustedUrl(gorthGameUrl, true);
  if (root.search) throw new Error("Auth root không được có query.");
  return requestJson(
    parseHttpUrl(root.href.replace(/\/$/, "") + "/authserver/" + action),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    signal,
  );
}
function parse(
  data: Record<string, unknown>,
  clientToken: string,
): GameAccount {
  if (
    typeof data.accessToken !== "string" ||
    !data.accessToken ||
    data.clientToken !== clientToken
  )
    throw new Error("Phản hồi phiên game Gorth không hợp lệ.");
  const player = profile(data.selectedProfile);
  return {
    id: "gorth:" + player.uuid,
    provider: "gorth",
    ...player,
    clientToken,
    tokens: {
      accessToken: data.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
      binding: gameBinding(),
    },
  };
}
export async function loginGorthGame(
  username: string,
  password: string,
  signal: AbortSignal,
) {
  if (
    !username.trim() ||
    username.length > 254 ||
    !password ||
    password.length > 1024
  )
    throw new Error("Vui lòng nhập tài khoản và mật khẩu game Gorth.");
  const clientToken = randomUUID();
  return parse(
    await yggdrasil(
      "authenticate",
      {
        agent: { name: "Minecraft", version: 1 },
        username,
        password,
        clientToken,
        requestUser: true,
      },
      signal,
    ),
    clientToken,
  );
}
export async function refreshGorthGame(old: GameAccount, signal: AbortSignal) {
  if (old.tokens?.binding !== gameBinding() || !old.clientToken)
    throw new Error("Cần đăng nhập lại game Gorth.");
  const next = parse(
    await yggdrasil(
      "refresh",
      {
        accessToken: old.tokens.accessToken,
        clientToken: old.clientToken,
        selectedProfile: { id: old.uuid, name: old.username },
      },
      signal,
    ),
    old.clientToken,
  );
  if (next.uuid !== old.uuid)
    throw new Error("Hồ sơ game Gorth thay đổi khi refresh.");
  return next;
}
