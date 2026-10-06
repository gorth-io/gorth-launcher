import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
await build({
  entryPoints: ["tests/desktop-server.test.ts"],
  external: ["axios"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/desktop-server-test.mjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
});
await build({
  entryPoints: ["tests/auth-profile.test.ts"],
  external: ["axios"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".vite/auth-profile-test.mjs",
  alias: { electron: path.resolve("tests/electron-auth-mock.ts") },
  plugins: [
    {
      name: "verified-provider-fixture",
      setup(build) {
        build.onResolve({ filter: /^\.\/gorth$/ }, () => ({
          path: path.resolve("tests/auth-profile-provider-mock.ts"),
        }));
      },
    },
  ],
});
const result = spawnSync(
  process.execPath,
  ["--test", ".vite/desktop-server-test.mjs", ".vite/auth-profile-test.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
