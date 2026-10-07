import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";
await build({
  entryPoints: ["tests/desktop-packages-renderer.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: ".vite/desktop-packages-renderer.js",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
await build({
  entryPoints: ["tests/desktop-packages-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/desktop-packages-preload.cjs",
});
await build({
  entryPoints: ["tests/desktop-packages-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/desktop-packages-native.cjs",
  define: { "import.meta.env": "{}" },
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/desktop-packages-native.cjs"], {
  stdio: "inherit",
  env: environment,
  timeout: 30000,
});
if (result.error) console.error(result.error);
if (result.signal) console.error("Electron test signal:", result.signal);
if (result.status !== 0) console.error("Electron test exit:", result.status);
process.exitCode = result.status ?? 1;
