import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import electron from "electron";

await build({
  entryPoints: ["tests/auth-screen-renderer.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: ".vite/auth-screen-renderer.js",
  alias: { "@/hooks/use-auth": path.resolve("tests/auth-screen-hook-mock.ts") },
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
});
await build({
  entryPoints: ["tests/auth-screen-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/auth-screen-native.cjs",
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/auth-screen-native.cjs"], {
  stdio: "inherit",
  timeout: 30000,
  env: environment,
});
process.exitCode = result.status ?? 1;
