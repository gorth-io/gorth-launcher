import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["tests/dashboard-renderer.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: ".vite/dashboard-renderer.js",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
await build({
  entryPoints: ["tests/dashboard-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/dashboard-native.cjs",
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/dashboard-native.cjs"], {
  stdio: "inherit",
  timeout: 30000,
  env: environment,
});
if (result.error) console.error(result.error);
if (result.signal)
  console.error(`Electron test exited with signal ${result.signal}`);
process.exitCode = result.status ?? 1;
