import { build } from "esbuild";
import { spawnSync } from "node:child_process";

await build({
  entryPoints: ["tests/instance-data.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".vite/instance-data-test.cjs",
});
const result = spawnSync(process.execPath, ["--test", ".vite/instance-data-test.cjs"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
