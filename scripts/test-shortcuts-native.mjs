import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import electron from "electron";
const sqlPlugin = {
  name: "sql",
  setup(build) {
    build.onLoad({ filter: /\.sql\?raw$/ }, async ({ path }) => ({
      contents: await readFile(path.replace(/\?raw$/, ""), "utf8"),
      loader: "text",
    }));
    build.onResolve({ filter: /\.sql\?raw$/ }, ({ path, resolveDir }) => ({
      path: resolveDir + "/" + path,
    }));
  },
};
await build({
  entryPoints: ["tests/shortcuts-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/shortcuts-preload.cjs",
});
await build({
  entryPoints: ["tests/shortcuts-native.test.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  plugins: [sqlPlugin],
  outfile: ".vite/shortcuts-native-test.cjs",
});
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/shortcuts-native-test.cjs"], {
  stdio: "inherit",
  env,
});
process.exitCode = result.status ?? 1;
