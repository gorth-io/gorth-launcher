import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/http.test.ts"],
  bundle: true,
  jsx: "automatic",
  external: [
    "axios",
    "react",
    "react-dom/*",
    "@tanstack/react-query",
    "@base-ui/react/*",
    "lucide-react",
    "cn",
    "zod",
  ],
  platform: "node",
  format: "esm",
  outfile: ".vite/http-test.mjs",
});
const result = spawnSync(process.execPath, ["--test", ".vite/http-test.mjs"], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
