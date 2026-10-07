import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/rpc.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/rpc-test.mjs",
});
const result = spawnSync(process.execPath, ["--test", ".vite/rpc-test.mjs"], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
