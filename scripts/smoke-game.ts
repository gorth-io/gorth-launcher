// Explicit integration test: uses only the directory passed on the command line.
// pnpm exec esbuild scripts/smoke-game.ts --bundle --platform=node --format=cjs --outfile=.vite/smoke-game.cjs
// node .vite/smoke-game.cjs /absolute/test/minecraft Forge 1.20.1 47.4.10 [--play]
import path from "node:path";
import { spawn } from "node:child_process";
import { installGame, launchArguments } from "../lib/game/install";
import { getJavaEnvironment } from "../lib/utils/environment";

async function main() {
  const [root, loader, version, loaderVersion] = process.argv.slice(2);
  if (!root || !path.isAbsolute(root) || !loader || !version) throw new Error("Pass absolute test directory, loader, Minecraft version and loader version (use - for Vanilla).");
  const instance = { id: "smoke-" + loader.toLowerCase() + "-" + version.replaceAll(".", "-"), name: "Integration test", version, loader, loaderVersion: loaderVersion === "-" ? null : loaderVersion, createdAt: Date.now() };
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  let last = 0;
  const game = await installGame(root, instance, { memory: 4, javaPath: "" }, controller.signal, (message, done, total) => {
    if (Date.now() - last > 3000) { console.log(message, done, total); last = Date.now(); }
  });
  console.log("INSTALLED", game.version.id, game.java, game.gameDir);
  const directory = process.argv.find((value) => value.startsWith("--game-dir="))?.slice("--game-dir=".length);
  if (directory) { if (!path.isAbsolute(directory)) throw new Error("Test game directory must be absolute."); game.gameDir = directory; }
  if (!process.argv.includes("--play")) return;
  const args = launchArguments(game, { username: "SmokePlayer", uuid: "69e8d187b85c3d9bb9a2e408728de318", accessToken: "0", authlibRoot: "" }, 4);
  const child = spawn(game.java, args, { cwd: game.gameDir, env: getJavaEnvironment(), stdio: "inherit" });
  let stoppedByTest = false;
  const timer = setTimeout(() => { stoppedByTest = true; child.kill("SIGTERM"); }, 60_000);
  const exit = await new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  console.log("GAME EXIT", exit);
  if (exit.code !== 0 && !(stoppedByTest && (exit.signal === "SIGTERM" || exit.code === 143))) process.exitCode = 1;
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
