/// <reference types="vite/client" />

// Main-process environment only. No OAuth client secret belongs in a desktop build.
export const ssoOAuthClientId =
  import.meta.env?.VITE_SSO_OAUTH_CLIENT_ID ??
  process.env.VITE_SSO_OAUTH_CLIENT_ID ??
  "";
export const ssoClientUrl =
  import.meta.env?.VITE_SSO_CLIENT_URL ?? process.env.VITE_SSO_CLIENT_URL ?? "";
export const ssoServerUrl =
  import.meta.env?.VITE_SSO_SERVER_URL ?? process.env.VITE_SSO_SERVER_URL ?? "";
export const appUrl =
  import.meta.env?.VITE_APP_URL ?? process.env.VITE_APP_URL ?? "";
export const ssoAccessToken =
  import.meta.env?.VITE_SSO_ACCESS_TOKEN ??
  process.env.VITE_SSO_ACCESS_TOKEN ??
  "";
export const ssoRefreshToken =
  import.meta.env?.VITE_SSO_REFRESH_TOKEN ??
  process.env.VITE_SSO_REFRESH_TOKEN ??
  "";
export const ssoSessionApp =
  import.meta.env?.VITE_SSO_SESSION_APP ??
  process.env.VITE_SSO_SESSION_APP ??
  "";
export const ssoOAuthState =
  import.meta.env?.VITE_SSO_OAUTH_STATE ??
  process.env.VITE_SSO_OAUTH_STATE ??
  "";
export const ssoOAuthCodeVerifier =
  import.meta.env?.VITE_SSO_OAUTH_CODE_VERIFIER ??
  process.env.VITE_SSO_OAUTH_CODE_VERIFIER ??
  "";
export const ssoOAuthReturnTo =
  import.meta.env?.VITE_SSO_OAUTH_RETURN_TO ??
  process.env.VITE_SSO_OAUTH_RETURN_TO ??
  "";
export const ssoOAuthIssuer =
  import.meta.env?.VITE_SSO_OAUTH_ISSUER ??
  process.env.VITE_SSO_OAUTH_ISSUER ??
  "";
export const ssoOAuthNonce =
  import.meta.env?.VITE_SSO_OAUTH_NONCE ??
  process.env.VITE_SSO_OAUTH_NONCE ??
  "";

// Better Auth's issuer includes its /auth base path; callback stays app-owned.
export const ssoIssuer = ssoClientUrl
  ? new URL("/auth", ssoClientUrl).href
  : "";
export const ssoRedirectUri = appUrl
  ? new URL("/auth/callback", appUrl).href
  : "";
export const elyClientId = process.env.ELY_CLIENT_ID ?? "";
export const gorthGameUrl = process.env.GORTH_GAME_AUTH_URL ?? "";
export const javaHome = process.env.JAVA_HOME ?? "";
export const curseforgeApiKey = process.env.CURSEFORGE_API_KEY ?? "";

export function getJavaEnvironment(
  custom: Record<string, string> = {},
  gpu: "default" | "high-performance" | "integrated" = "default",
) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|CLASSPATH|CURSEFORGE_API_KEY)$/i.test(
        key,
      )
    )
      delete env[key];
  }
  Object.assign(env, custom);
  if (process.platform === "linux" && gpu === "high-performance") {
    env.DRI_PRIME = "1";
    env.__NV_PRIME_RENDER_OFFLOAD = "1";
    env.__GLX_VENDOR_LIBRARY_NAME = "nvidia";
  } else if (process.platform === "linux" && gpu === "integrated") {
    env.DRI_PRIME = "0";
    delete env.__NV_PRIME_RENDER_OFFLOAD;
    delete env.__GLX_VENDOR_LIBRARY_NAME;
  }
  return env;
}
