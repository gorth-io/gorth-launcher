import assert from "node:assert/strict";

const targets = await fetch("http://127.0.0.1:9338/json").then((r) => r.json());
const target = targets.find((t) => t.type === "page" && t.title === "Gorth Launcher");
assert(target, "Start the launcher with remote debugging port 9338 and isolated user data");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const response = JSON.parse(event.data);
  if (response.method === "Runtime.exceptionThrown") errors.push(response.params);
  if (response.id) { pending.get(response.id)?.(response); pending.delete(response.id); }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  assert(!response.error, JSON.stringify(response.error));
  assert(!response.result.exceptionDetails, JSON.stringify(response.result.exceptionDetails));
  return response.result.result?.value;
};
const until = async (expression, timeout = 60_000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out: " + expression + "\n" + await evaluate("document.body.innerText"));
};
const click = (label) => evaluate(`(() => { const root=document.querySelector('[data-slot=dialog-content]') ?? document; const button=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)} && !b.disabled && b.getClientRects().length); if(!button) throw new Error('Missing enabled button: '+${JSON.stringify(label)}); button.click(); })()`);
const change = (selector, value, tag = "HTMLSelectElement", event = "change") => evaluate(`(() => {const element=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${tag}.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
try {
  await send("Runtime.enable");
  await click("Tổng quan");
  await until("!document.querySelector('webview')");
  await click("Mod & modpack");
  await until("document.querySelectorAll('form select').length===3");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('form select')[1].options].map(o=>o.value)"), ["modpack", "mod", "shader", "resourcepack"]);
  if (process.argv.includes("--assets")) {
    for (const [kind, query, label] of [["mod", "Just Enough Items", "Mod"], ["shader", "Complementary", "Shader"], ["resourcepack", "Faithful", "Texture pack"]]) {
      await evaluate(`(()=>{ const select=document.querySelectorAll('form select')[1]; select.value=${JSON.stringify(kind)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await change('form input', query, "HTMLInputElement", "input");
      await click("Tìm kiếm");
      await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify("Xem " + label)} && !b.disabled)`);
      await click("Xem " + label);
      await until("document.querySelector('webview') && document.querySelector('aside select')?.options.length > 0 && !document.querySelector('aside select').disabled");
      assert((await evaluate("document.querySelector('webview').getAttribute('src')")).startsWith("https://modrinth.com/" + kind + "/"));
      await until("!document.querySelector('webview').isLoading()");
      console.log("PASS live category website and release selection", kind, await evaluate("document.querySelector('webview').getTitle()"));
      await click("Kết quả");
      await until("!document.querySelector('webview')");
    }
    assert.deepEqual(errors, []);
    process.exitCode = 0;
  } else {
  await change("form select:nth-of-type(1)", "modrinth");
  await evaluate("(()=>{ const select=document.querySelectorAll('form select')[2]; select.value='5'; select.dispatchEvent(new Event('change',{bubbles:true})); })()");
  await change('form input', "Fabulously Optimized", "HTMLInputElement", "input");
  await click("Tìm kiếm");
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Xem Modpack' && !b.disabled)");
  await click("Xem Modpack");
  await until("document.querySelector('webview') && document.querySelector('aside select')?.options.length > 0 && !document.querySelector('aside select').disabled");
  assert(await evaluate("!!document.querySelector('[data-slot=sidebar]')"));
  assert(await evaluate("document.querySelector('webview').getAttribute('src').startsWith('https://modrinth.com/modpack/')"));
  assert.equal(await evaluate("document.querySelector('webview').previousElementSibling.getBoundingClientRect().height"), 56);
  assert(await evaluate("!!document.querySelector('button[aria-label=\"Quay lại kết quả\"]')"));
  assert.equal(await evaluate("Math.round(document.querySelector('aside').getBoundingClientRect().right)"), await evaluate("window.innerWidth"));
  assert.equal(await evaluate("document.body.innerText.includes('v0.0.0')"), false);
  const option = await evaluate("[...document.querySelector('aside select').options].find(o=>o.textContent.includes('6.5.0'))?.value");
  assert(option, "Expected known stable FO 6.5.0 in release list");
  await change("aside select", option);
  await until("!document.querySelector('webview').isLoading()");
  const isolation = await evaluate("document.querySelector('webview').executeJavaScript('({api:typeof window.electronAPI,node:typeof process,require:typeof require,title:document.title})')");
  assert.equal(isolation.api, "undefined"); assert.equal(isolation.node, "undefined"); assert.equal(isolation.require, "undefined");
  console.log("PASS project website loaded with isolated renderer", isolation.title);
  await click("Cài đặt modpack");
  await until("!!document.querySelector('[data-slot=dialog-content]')");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('webview')).display"), "none");
  assert.equal(await evaluate("document.querySelector('[data-slot=dialog-content] select').value"), option);
  await click("Đóng");
  await until("!document.querySelector('[data-slot=dialog-content]')");
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('webview')).display"), "none");
  if (process.argv.includes("--install")) {
    const before = await evaluate("window.electronAPI.library.snapshot().then(s=>s.instances.map(i=>i.id))");
    await click("Cài đặt modpack"); await until("!!document.querySelector('[data-slot=dialog-content]')");
    await click("Cài đặt");
    await until("document.body.innerText.includes('Đã tạo instance.')", 600_000);
    const snapshot = await evaluate("window.electronAPI.library.snapshot()");
    const created = snapshot.instances.find((instance) => !before.includes(instance.id));
    assert(created); assert.equal(created.version, "1.21.1"); assert.equal(created.loader, "Fabric");
    await until("!document.querySelector('[data-slot=dialog-content]')");
    await click("Mở thư viện instance");
    await until(`document.body.innerText.includes(${JSON.stringify(created.name)})`);
    console.log("PASS modpack installed from dialog into SQLite/library", created);
  }
  assert.deepEqual(errors, []);
  console.log("PASS sidebar retained, four categories, project webview, release picker and install dialog, no renderer exceptions");
  }
} finally { socket.close(); }
