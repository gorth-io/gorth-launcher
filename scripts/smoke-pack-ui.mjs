import assert from "node:assert/strict";
const targets = await fetch("http://127.0.0.1:9338/json").then((response) => response.json());
const ws = new WebSocket(targets.find((item) => item.type === "page" && item.title === "Gorth Launcher").webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", (event) => { const data = JSON.parse(event.data); if (data.id) { pending.get(data.id)(data.result); pending.delete(data.id); } if (data.method === "Runtime.exceptionThrown") console.error(data.params); });
const evaluate = (expression) => new Promise((resolve, reject) => { pending.set(++id, (result) => result.exceptionDetails ? reject(new Error(JSON.stringify(result.exceptionDetails))) : resolve(result.result?.value)); ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })); });
const query = { provider: "modrinth", kind: "modpack", query: "Fabulously Optimized", version: "1.21.1", loader: "Fabric", offset: 0 };
const search = await evaluate(`window.electronAPI.content.search(${JSON.stringify(query)})`);
assert(search.ok, search.error);
const project = search.data.projects.find((item) => item.name === "Fabulously Optimized"); assert(project);
// Stable release fixture. Install only; do not start the pack's mods in this test.
const result = await evaluate(`window.electronAPI.content.install(${JSON.stringify({ query, projectId: project.id, versionId: "N276l2ON" })})`);
assert(result.ok, result.error);
const snapshot = await evaluate("window.electronAPI.library.snapshot()");
const pack = snapshot.instances.find((item) => item.name.includes("Fabulously")); assert(pack);
assert.equal(pack.loaderVersion, "0.19.3"); assert.equal(pack.version, "1.21.1");
console.log("PASS live Modrinth modpack import into SQLite", pack);
ws.close();
