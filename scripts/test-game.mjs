import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
await build({
  entryPoints: ["tests/game.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".vite/game-test.cjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
});
const result = spawnSync(process.execPath, ["--test", ".vite/game-test.cjs"], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
