/// <reference types="vite/client" />

// Main-process environment only. No OAuth client secret belongs in a desktop build.
export const gorthIssuer = import.meta.env.VITE_GORTH_SSO_ISSUER ?? "";
export const gorthClientId =
  import.meta.env.VITE_GORTH_SSO_CLIENT_ID ?? "gorth-launcher";
export const gorthRedirectUri =
  import.meta.env.VITE_GORTH_SSO_REDIRECT_URI ??
  "http://127.0.0.1:43821/auth/callback";
export const elyClientId = process.env.ELY_CLIENT_ID ?? "";
export const gorthGameUrl = process.env.GORTH_GAME_AUTH_URL ?? "";
export const javaHome = process.env.JAVA_HOME ?? "";
export const curseforgeApiKey = process.env.CURSEFORGE_API_KEY ?? "";

export function getJavaEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|CLASSPATH|CURSEFORGE_API_KEY)$/i.test(
        key,
      )
    )
      delete env[key];
  }
  return env;
}
