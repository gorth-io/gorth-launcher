import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({ entryPoints: ["tests/content.test.ts"], bundle: true, external: ["axios"], platform: "node", format: "cjs", outfile: ".vite/content-test.cjs" });
const result = spawnSync(process.execPath, ["--test", ".vite/content-test.cjs"], { stdio: "inherit", env: { ...process.env, CURSEFORGE_API_KEY: "test-fixture-key" } });
process.exitCode = result.status ?? 1;
