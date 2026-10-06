import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["tests/auth-embedded-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/auth-embedded-native.cjs",
  define: { "import.meta.env": "undefined" },
});
const nativeEnvironment = { ...process.env };
delete nativeEnvironment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/auth-embedded-native.cjs"], {
  stdio: "inherit",
  timeout: 120_000,
  env: {
    ...nativeEnvironment,
    VITE_SSO_OAUTH_CLIENT_ID: "gorth-launcher",
    VITE_SSO_CLIENT_URL: "http://localhost:3000",
    VITE_SSO_SERVER_URL: "http://localhost:8080",
    VITE_APP_URL: "http://localhost:5502",
  },
});
process.exitCode = result.status ?? 1;
