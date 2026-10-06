import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
await build({
  entryPoints: ["tests/auth.test.ts"],
  external: ["axios"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/auth-test.mjs",
});
await build({
  entryPoints: ["tests/auth-service.test.ts"],
  external: ["axios"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/auth-service-test.mjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
});
await build({
  entryPoints: ["tests/auth-view.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/auth-view-test.mjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
});
const result = spawnSync(
  process.execPath,
  [
    "--test",
    ".vite/auth-test.mjs",
    ".vite/auth-service-test.mjs",
    ".vite/auth-view-test.mjs",
  ],
  {
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
