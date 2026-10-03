import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  gorthIssuer,
  gorthClientId,
  gorthRedirectUri,
} from "@/lib/utils/environment";
import { parseHttpUrl } from "@/lib/utils/schema";
import { trustedUrl, tokenSet } from "./model";
import type { LauncherSession, Tokens } from "@/lib/utils/interface";
import { requestJson, formRequest } from "./http";

export const gorthBinding = () => gorthIssuer + "|" + gorthClientId;
async function metadata(signal?: AbortSignal) {
  if (!gorthIssuer) throw new Error("Chưa cấu hình VITE_GORTH_SSO_ISSUER.");
  const issuer = trustedUrl(parseHttpUrl(gorthIssuer).href, true);
  const data = await requestJson(
    new URL("/.well-known/openid-configuration", issuer),
    {},
    signal,
  );
  if (data.issuer !== gorthIssuer)
    throw new Error("Issuer Gorth không khớp cấu hình.");
  const endpoint = (key: string) => {
    if (typeof data[key] !== "string")
      throw new Error("Thiếu endpoint OIDC: " + key);
    const url = trustedUrl(data[key], true);
    if (url.origin !== issuer.origin)
      throw new Error("Endpoint OIDC khác origin đã cấu hình.");
    return url;
  };
  return {
    authorize: endpoint("authorization_endpoint"),
    token: endpoint("token_endpoint"),
    jwks: endpoint("jwks_uri"),
    userinfo: endpoint("userinfo_endpoint"),
    revoke:
      typeof data.revocation_endpoint === "string"
        ? endpoint("revocation_endpoint")
        : null,
    requiresIssuer:
      data.authorization_response_iss_parameter_supported === true,
  };
}
async function verifyIdentity(
  raw: unknown,
  jwks: URL,
  nonce?: string,
  accessToken?: unknown,
  code?: string,
) {
  if (typeof raw !== "string") throw new Error("Thiếu ID token Gorth.");
  const { payload, protectedHeader } = await jwtVerify(
    raw,
    createRemoteJWKSet(jwks),
    {
      issuer: gorthIssuer,
      audience: gorthClientId,
      algorithms: ["RS256", "ES256", "EdDSA"],
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    },
  );
  if (
    !payload.sub ||
    (nonce && payload.nonce !== nonce) ||
    (payload.azp && payload.azp !== gorthClientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== gorthClientId)
  )
    throw new Error("ID token Gorth không hợp lệ.");
  if (payload.at_hash !== undefined) {
    if (typeof accessToken !== "string")
      throw new Error("Thiếu access token để kiểm tra ID token.");
    const hash = createHash(
      protectedHeader.alg === "EdDSA" ? "sha512" : "sha256",
    )
      .update(accessToken, "ascii")
      .digest();
    if (
      payload.at_hash !==
      hash.subarray(0, hash.length / 2).toString("base64url")
    )
      throw new Error("Access token không khớp ID token.");
  }
  if (payload.c_hash !== undefined && code !== undefined) {
    const hash = createHash(
      protectedHeader.alg === "EdDSA" ? "sha512" : "sha256",
    )
      .update(code, "ascii")
      .digest();
    if (
      payload.c_hash !== hash.subarray(0, hash.length / 2).toString("base64url")
    )
      throw new Error("Authorization code does not match ID token.");
  }
  return {
    id: payload.sub,
    name: typeof payload.name === "string" ? payload.name : payload.sub,
  };
}
export async function loginGorth(
  open: (url: string) => Promise<void>,
  signal: AbortSignal,
): Promise<LauncherSession> {
  const config = await metadata(signal);
  const redirect = parseHttpUrl(gorthRedirectUri);
  if (
    redirect.protocol !== "http:" ||
    redirect.hostname !== "127.0.0.1" ||
    !redirect.port ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password
  )
    throw new Error("Callback phải là HTTP 127.0.0.1 với port cố định.");
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const server = createServer();
  let resolveCode!: (code: string) => void;
  let rejectCode!: (reason: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // Consume early aborts before awaiting the browser opening.
  void codePromise.catch(() => {});
  let consumed = false;
  server.on("request", (req, res) => {
    let url: URL;
    try {
      if ((req.url?.length ?? 0) > 8192) throw new Error("Oversized callback");
      url = parseHttpUrl(new URL(req.url ?? "/", redirect.origin).href);
    } catch {
      res.writeHead(400).end("Invalid callback.");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (
      req.method !== "GET" ||
      req.headers.host !== redirect.host ||
      url.pathname !== redirect.pathname
    ) {
      res.writeHead(404).end();
      return;
    }
    const returned = url.searchParams.get("state") ?? "";
    if (
      consumed ||
      url.searchParams.getAll("state").length !== 1 ||
      Buffer.byteLength(returned) !== Buffer.byteLength(state) ||
      !timingSafeEqual(Buffer.from(returned), Buffer.from(state))
    ) {
      res.writeHead(400).end("Invalid callback.");
      return;
    }
    consumed = true;
    if (
      (config.requiresIssuer || url.searchParams.has("iss")) &&
      (url.searchParams.getAll("iss").length !== 1 ||
        url.searchParams.get("iss") !== gorthIssuer)
    ) {
      res.writeHead(400).end("Invalid issuer.");
      rejectCode(new Error("Callback issuer mismatch."));
      return;
    }
    if (
      url.searchParams.has("error") ||
      url.searchParams.getAll("code").length !== 1 ||
      !url.searchParams.get("code")
    ) {
      res.writeHead(400).end("Đăng nhập đã bị từ chối.");
      rejectCode(new Error("Đăng nhập Gorth bị từ chối."));
      return;
    }
    res.end("Đã nhận phản hồi. Bạn có thể quay lại Gorth Launcher.");
    resolveCode(url.searchParams.get("code")!);
  });
  const abort = () => rejectCode(new Error("Đã hủy đăng nhập."));
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => rejectCode(new Error("Đăng nhập hết thời gian chờ.")),
    180_000,
  );
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(Number(redirect.port), "127.0.0.1", resolve);
    });
    for (const [key, value] of Object.entries({
      client_id: gorthClientId,
      redirect_uri: redirect.href,
      response_type: "code",
      scope: "openid profile email offline_access",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }))
      config.authorize.searchParams.set(key, value);
    await open(config.authorize.href);
    const code = await codePromise;
    signal.throwIfAborted();
    const data = await formRequest(
      config.token,
      {
        grant_type: "authorization_code",
        code,
        client_id: gorthClientId,
        redirect_uri: redirect.href,
        code_verifier: verifier,
      },
      signal,
    );
    const identity = await verifyIdentity(
      data.id_token,
      config.jwks,
      nonce,
      data.access_token,
      code,
    );
    const tokens = tokenSet(data, gorthBinding());
    const profile = await userInfo(
      config.userinfo,
      tokens.accessToken,
      identity.id,
      signal,
    );
    return { ...identity, ...profile, tokens };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    server.close();
    server.closeAllConnections();
  }
}
export async function refreshGorth(
  session: LauncherSession,
  signal: AbortSignal,
): Promise<LauncherSession> {
  const old: Tokens = session.tokens;
  if (old.binding !== gorthBinding() || !old.refreshToken)
    throw new Error("Cần đăng nhập lại Gorth.");
  const config = await metadata(signal);
  const data = await formRequest(
    config.token,
    {
      grant_type: "refresh_token",
      client_id: gorthClientId,
      refresh_token: old.refreshToken,
    },
    signal,
  );
  let identity = { id: session.id, name: session.name };
  if (data.id_token)
    identity = await verifyIdentity(
      data.id_token,
      config.jwks,
      undefined,
      data.access_token,
    );
  if (identity.id !== session.id)
    throw new Error("Danh tính Gorth thay đổi khi refresh.");
  const tokens = tokenSet(data, gorthBinding(), old);
  const profile = await userInfo(
    config.userinfo,
    tokens.accessToken,
    identity.id,
    signal,
  );
  return { ...identity, ...profile, tokens };
}

async function userInfo(
  url: URL,
  accessToken: string,
  subject: string,
  signal: AbortSignal,
) {
  const info = await requestJson(
    url,
    { headers: { Authorization: "Bearer " + accessToken } },
    signal,
  );
  if (info.sub !== subject)
    throw new Error("Danh tính userinfo không khớp ID token.");
  return {
    name: typeof info.name === "string" && info.name ? info.name : subject,
    email: typeof info.email === "string" ? info.email : undefined,
    username:
      typeof info.preferred_username === "string"
        ? info.preferred_username
        : undefined,
  };
}

export async function revokeGorth(tokens: Tokens, signal: AbortSignal) {
  if (tokens.binding !== gorthBinding())
    throw new Error("Không thu hồi token thuộc cấu hình SSO khác.");
  const config = await metadata(signal);
  if (!config.revoke)
    throw new Error("SSO chưa cung cấp endpoint thu hồi token.");
  const entries = [
    ["refresh_token", tokens.refreshToken],
    ["access_token", tokens.accessToken],
  ] as const;
  const results = await Promise.allSettled(
    entries
      .filter(([, token]) => !!token)
      .map(async ([hint, token]) => {
        const response = await fetch(config.revoke!, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: gorthClientId,
            token: token!,
            token_type_hint: hint,
          }),
        });
        if (!response.ok) throw new Error("SSO không thu hồi được token.");
        await response.body?.cancel();
      }),
  );
  if (results.some((result) => result.status === "rejected"))
    throw new Error(
      "Đã đăng xuất trên thiết bị nhưng chưa thu hồi được token tại SSO.",
    );
}
