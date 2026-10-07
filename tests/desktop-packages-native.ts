import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { app, BrowserWindow, ipcMain } from "electron";
import { desktopRouter, type DesktopContext } from "@/main/rpc/router";
import { handleRpcRequest } from "@/main/rpc/transport";
import { isRpcRendererUrl } from "@/main/rpc/sender";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-packages-test-")),
);
void app
  .whenReady()
  .then(async () => {
    const server = createServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end("<div id='root'></div>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.resolve(".vite/desktop-packages-preload.cjs"),
      },
    });
    const context: DesktopContext = {
      snapshot: () => ({
        instances: [],
        trash: [],
        instanceSettings: {},
        settings: { memory: 4, javaPath: "" },
      }),
      settings: async (settings) => ({
        ok: true,
        snapshot: { instances: [], trash: [], instanceSettings: {}, settings },
      }),
    };
    ipcMain.handle("desktop:rpc", (event, input: unknown) => {
      assert(
        event.sender === window.webContents &&
          event.senderFrame === event.sender.mainFrame,
      );
      assert(isRpcRendererUrl(event.sender.getURL(), origin + "/"));
      return handleRpcRequest(desktopRouter, input, context);
    });
    try {
      await window.loadURL(origin);
      const css = readdirSync("dist/assets").find((name) =>
        /^index-.*\.css$/.test(name),
      );
      assert(css, "Build the renderer before testing");
      await window.webContents.insertCSS(
        readFileSync(path.join("dist/assets", css), "utf8"),
      );
      await window.webContents.executeJavaScript(
        readFileSync(".vite/desktop-packages-renderer.js", "utf8"),
      );
      const run = (expression: string) =>
        window.webContents.executeJavaScript(expression);
      const wait = async (expression: string) => {
        const deadline = Date.now() + 5000;
        while (!(await run(expression))) {
          assert(
            Date.now() < deadline,
            expression +
              "\n" +
              JSON.stringify(await run("window.desktopPackagesTest.errors")),
          );
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      };
      await wait(
        "document.querySelector('[data-rpc-state]')?.textContent === 'ready'",
      );
      await wait(
        "document.querySelectorAll('tbody tr[data-index]').length > 0",
      );
      assert(
        (await run(
          "document.querySelectorAll('tbody tr[data-index]').length",
        )) < 100,
        "500 rows must be virtualized",
      );
      await run(
        "document.querySelector('[data-slot=table-container]').parentElement.scrollTop = 100000",
      );
      await wait("document.querySelector('tr[data-index=\"499\"]')");
      const typeSearch = async (value: string) =>
        run(
          "(() => { const input = document.querySelector('input[aria-label=\"Search items\"]'); " +
            "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, " +
            JSON.stringify(value) +
            "); " +
            "input.dispatchEvent(new Event('input', { bubbles: true })); })()",
        );
      await typeSearch("Item 499");
      await wait(
        "document.querySelectorAll('tbody tr[data-index]').length === 1 && document.querySelector('tbody').textContent.includes('Item 499')",
      );
      await typeSearch("");
      await wait("document.querySelector('tr[data-index=\"0\"]')");
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Value').click()",
      );
      await wait("document.querySelector('th[aria-sort=descending]')");
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Value').click()",
      );
      await wait(
        "document.querySelector('tr[data-index=\"0\"]')?.textContent === 'Item 11'",
      );
      await run(
        "document.querySelector('[role=slider]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }))",
      );
      await wait(
        "document.querySelector('[data-ranger-value]')?.textContent === '7'",
      );
      await run(`(() => {
      const handle = document.querySelector('[role=slider]');
      const track = handle.parentElement.getBoundingClientRect();
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: track.x + track.width / 2 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: track.x + track.width }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    })()`);
      await wait(
        "document.querySelector('[data-ranger-value]')?.textContent === '16'",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Go to help').click()",
      );
      await wait(
        "document.querySelector('[data-location]')?.textContent === '/settings/help'",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Back').click()",
      );
      await wait(
        "document.querySelector('[data-location]')?.textContent === '/home'",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Forward').click()",
      );
      await wait(
        "document.querySelector('[data-location]')?.textContent === '/settings/help'",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Go home').click()",
      );
      await wait(
        "document.querySelector('[data-location]')?.textContent === '/home'",
      );
      assert.equal(
        window.webContents.getURL(),
        origin + "/",
        "Router must not navigate the Electron shell",
      );
      assert.deepEqual(await run("window.desktopPackagesTest.errors"), []);
      console.log(
        "Desktop packages: RPC over isolated preload, Query, Router, sorting/filtering/virtual rows and Ranger passed",
      );
    } finally {
      window.destroy();
      server.close();
    }
  })
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
