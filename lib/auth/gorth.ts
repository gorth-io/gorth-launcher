import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { registerAuthCallback } from "@/services/auth-callback";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ssoIssuer,
  ssoOAuthClientId,
  ssoRedirectUri,
} from "@/lib/utils/environment";
import { parseHttpUrl } from "@/lib/utils/schema";
import { trustedUrl, tokenSet } from "./model";
import type { LauncherSession, Tokens } from "@/lib/utils/interface";
import { requestJson, formRequest } from "./http";
import { fetcher } from "@/lib/utils/fetcher";

export const gorthBinding = () => ssoIssuer + "|" + ssoOAuthClientId;
async function metadata(signal?: AbortSignal) {
  if (!ssoIssuer || !ssoOAuthClientId || !ssoRedirectUri)
    throw new Error(
      "Chưa cấu hình VITE_SSO_CLIENT_URL, VITE_SSO_OAUTH_CLIENT_ID hoặc VITE_APP_URL.",
    );
  const issuer = trustedUrl(parseHttpUrl(ssoIssuer).href, true);
  const data = await requestJson(
    new URL(
      issuer.pathname.replace(/\/$/, "") + "/.well-known/openid-configuration",
      issuer,
    ),
    {},
    signal,
  );
  if (data.issuer !== ssoIssuer)
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
      issuer: ssoIssuer,
      audience: ssoOAuthClientId,
      algorithms: ["RS256", "ES256", "EdDSA"],
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    },
  );
  if (
    !payload.sub ||
    (nonce && payload.nonce !== nonce) ||
    (payload.azp && payload.azp !== ssoOAuthClientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== ssoOAuthClientId)
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
  open: (
    url: string,
    receiveCallback: (url: string) => boolean,
  ) => Promise<void>,
  signal: AbortSignal,
  mode: "login" | "register" = "login",
): Promise<LauncherSession> {
  const config = await metadata(signal);
  const redirect = parseHttpUrl(ssoRedirectUri);
  if (
    redirect.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(redirect.hostname) ||
    !redirect.port ||
    redirect.search ||
    redirect.hash ||
    redirect.username ||
    redirect.password
  )
    throw new Error(
      "Callback phải là HTTP localhost hoặc 127.0.0.1 với port cố định.",
    );
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let resolveCode!: (code: string) => void;
  let rejectCode!: (reason: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // Consume early aborts before awaiting the browser opening.
  void codePromise.catch(() => {});
  let consumed = false;
  const receiveCallback = (value: string): boolean => {
    let url: URL;
    try {
      if (value.length > 8192) return false;
      url = parseHttpUrl(value);
    } catch {
      return false;
    }
    if (
      url.origin !== redirect.origin ||
      url.pathname !== redirect.pathname ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return false;
    }
    const returned = url.searchParams.get("state") ?? "";
    if (
      consumed ||
      url.searchParams.getAll("state").length !== 1 ||
      Buffer.byteLength(returned) !== Buffer.byteLength(state) ||
      !timingSafeEqual(Buffer.from(returned), Buffer.from(state))
    ) {
      return false;
    }
    consumed = true;
    if (
      (config.requiresIssuer || url.searchParams.has("iss")) &&
      (url.searchParams.getAll("iss").length !== 1 ||
        url.searchParams.get("iss") !== ssoIssuer)
    ) {
      rejectCode(new Error("Callback issuer mismatch."));
      return false;
    }
    if (
      url.searchParams.has("error") ||
      url.searchParams.getAll("code").length !== 1 ||
      !url.searchParams.get("code")
    ) {
      rejectCode(new Error("Đăng nhập Gorth bị từ chối."));
      return false;
    }
    resolveCode(url.searchParams.get("code")!);
    return true;
  };
  const unregisterCallback = registerAuthCallback(receiveCallback);
  const abort = () => rejectCode(new Error("Đã hủy đăng nhập."));
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => rejectCode(new Error("Đăng nhập hết thời gian chờ.")),
    mode === "register" ? 600_000 : 180_000,
  );
  try {
    signal.throwIfAborted();
    for (const [key, value] of Object.entries({
      client_id: ssoOAuthClientId,
      redirect_uri: redirect.href,
      response_type: "code",
      scope: "openid profile email offline_access",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }))
      config.authorize.searchParams.set(key, value);
    // Match the web applications: prompt=create preserves OAuth through sign-up/OTP.
    if (mode === "register")
      config.authorize.searchParams.set("prompt", "create");
    // Reuse a valid SSO session. Forcing login while the SSO form auto-resumes
    // an existing account would bounce endlessly between login and authorize.
    await open(config.authorize.href, receiveCallback);
    const code = await codePromise;
    signal.throwIfAborted();
    const data = await formRequest(
      config.token,
      {
        grant_type: "authorization_code",
        code,
        client_id: ssoOAuthClientId,
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
    unregisterCallback();
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
      client_id: ssoOAuthClientId,
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
    emailVerified:
      typeof info.email_verified === "boolean"
        ? info.email_verified
        : undefined,
    image:
      typeof info.picture === "string" && /^https?:\/\//i.test(info.picture)
        ? info.picture
        : undefined,
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
        const response = await fetcher<string>({
          url: config.revoke!,
          method: "POST",
          redirect: "error",
          signal,
          timeout: 20_000,
          responseType: "text",
          validateStatus: () => true,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: ssoOAuthClientId,
            token: token!,
            token_type_hint: hint,
          }),
        });
        if (response.status < 200 || response.status >= 300)
          throw new Error("SSO không thu hồi được token.");
      }),
  );
  if (results.some((result) => result.status === "rejected"))
    throw new Error(
      "Đã đăng xuất trên thiết bị nhưng chưa thu hồi được token tại SSO.",
    );
}
