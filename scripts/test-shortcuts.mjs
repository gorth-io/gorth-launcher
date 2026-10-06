import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/shortcuts.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/shortcuts-test.mjs",
});
const result = spawnSync(
  process.execPath,
  ["--test", ".vite/shortcuts-test.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
