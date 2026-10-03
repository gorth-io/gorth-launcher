import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/library.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".vite/library-test.cjs",
  plugins: [{ name: "sql", setup(build) {
    build.onLoad({ filter: /\.sql\?raw$/ }, async ({ path }) => ({ contents: await readFile(path.replace(/\?raw$/, ""), "utf8"), loader: "text" }));
    build.onResolve({ filter: /\.sql\?raw$/ }, ({ path, resolveDir }) => ({ path: resolveDir + "/" + path }));
  } }],
});
const result = spawnSync(process.execPath, ["--test", ".vite/library-test.cjs"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
