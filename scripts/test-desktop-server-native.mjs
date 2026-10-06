import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createAdaptorServer } from "@hono/node-server";
import electron from "electron";
const probe = createAdaptorServer({ fetch: () => new Response("probe") });
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
await build({
  entryPoints: ["tests/desktop-server-native.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "vite"],
  outfile: ".vite/server-native.cjs",
  define: { "import.meta.env": "undefined" },
});
await build({
  entryPoints: ["tests/desktop-server-native-preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outfile: ".vite/server-native-preload.cjs",
});
const nativeEnvironment = { ...process.env };
delete nativeEnvironment.ELECTRON_RUN_AS_NODE;
const result = spawnSync(electron, [".vite/server-native.cjs"], {
  stdio: "inherit",
  timeout: 60_000,
  env: { ...nativeEnvironment, VITE_APP_URL: `http://localhost:${port}` },
});
process.exitCode = result.status ?? 1;
