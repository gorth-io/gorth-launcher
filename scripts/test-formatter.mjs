import { build } from "esbuild";
import { spawnSync } from "node:child_process";

await build({
  entryPoints: [
    "tests/formatter.test.ts",
    "tests/formatter-architecture.test.ts",
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["typescript"],
  outdir: ".vite/formatter-tests",
  outExtension: { ".js": ".cjs" },
});
const result = spawnSync(
  process.execPath,
  [
    "--test",
    ".vite/formatter-tests/formatter.test.cjs",
    ".vite/formatter-tests/formatter-architecture.test.cjs",
  ],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
