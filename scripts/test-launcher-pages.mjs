import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import electron from "electron";

await build({
  entryPoints: ["tests/launcher-pages-renderer.tsx"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: ".vite/launcher-pages-renderer.js",
  loader: { ".png": "dataurl" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
await build({
  entryPoints: ["tests/launcher-pages-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/launcher-pages-native.cjs",
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/launcher-pages-native.cjs"], {
  stdio: "inherit",
  timeout: 60000,
  env: environment,
});
process.exitCode = result.status ?? 1;
