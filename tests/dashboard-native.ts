import assert from "node:assert/strict";
import { type AddressInfo } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { app, BrowserWindow } from "electron";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-dashboard-test-")),
);
void app
  .whenReady()
  .then(async () => {
    const server = createHttpServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end("<div id='root'></div>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      await window.loadURL(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      );
      const css = readdirSync("dist/assets").find((name) =>
        /^index-.*\.css$/.test(name),
      );
      assert(css, "Build the renderer before running dashboard tests");
      await window.webContents.insertCSS(
        readFileSync(path.join("dist/assets", css), "utf8"),
      );
      await window.webContents.executeJavaScript(
        readFileSync(".vite/dashboard-renderer.js", "utf8"),
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
              JSON.stringify(await run("window.dashboardTest.errors")),
          );
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      };
      const heights = () =>
        run(
          "Array.from(document.querySelectorAll('[data-slot=sidebar-menu-button], button')).filter(b => b.getBoundingClientRect().height > 0).map(b => ({ text: b.textContent, height: b.getBoundingClientRect().height, size: b.dataset.size }))",
        );
      await run("window.dashboardTest.render('common')");
      await wait("document.querySelector('a[href=bookmarks]')");
      const initial = await heights();
      assert(
        initial.every(
          (item: { height: number; size: string }) =>
            item.height === (item.size === "lg" ? 56 : 36),
        ),
        JSON.stringify(initial),
      );
      assert.equal(
        await run(
          "document.querySelector('a[href=\"settings/help\"]').getAttribute('aria-current')",
        ),
        "page",
      );
      await run("document.querySelector('a[href=bookmarks]').click()");
      assert.deepEqual(await run("window.dashboardTest.calls"), ["bookmarks"]);
      assert(
        !window.webContents.getURL().endsWith("/bookmarks"),
        "Navigation must stay inside the desktop chrome",
      );
      await run(
        "document.querySelector('[aria-label=\"Close sidebar\"]').click()",
      );
      assert.deepEqual(await run("window.dashboardTest.calls"), [
        "bookmarks",
        "close",
      ]);
      for (const mode of ["large", "compact"]) {
        await run(`window.dashboardTest.render('${mode}')`);
        await wait("document.querySelector('[aria-label=\"Switch team\"]')");
        await wait(
          `Array.from(document.querySelectorAll('[data-slot=sidebar-menu-button]')).length === 2 && Array.from(document.querySelectorAll('[data-slot=sidebar-menu-button]')).every(button => button.getBoundingClientRect().height === ${mode === "large" ? 56 : 36})`,
        );
        const sizes = await heights();
        assert(
          sizes.length === 2 &&
            sizes.every(
              (item: { height: number }) =>
                item.height === (mode === "large" ? 56 : 36),
            ),
          JSON.stringify(sizes),
        );
      }
      assert.deepEqual(await run("window.dashboardTest.errors"), []);
      await run("window.dashboardTest.render('collapsed')");
      await wait("document.querySelector('[data-state=collapsed]')");
      await wait(
        "Array.from(document.querySelectorAll('[data-slot=sidebar-menu-button]')).every(button => button.getBoundingClientRect().height === (button.dataset.size === 'lg' ? 56 : 36))",
      );
      const collapsed = await heights();
      assert(
        collapsed.length > 0 &&
          collapsed.every(
            (item: { height: number; size: string }) =>
              item.height === (item.size === "lg" ? 56 : 36),
          ),
        JSON.stringify(collapsed),
      );
      console.log(
        "Dashboard: desktop navigation, active secondary route, close callback, h-9 buttons and h-14 large team/user triggers passed.",
      );
    } finally {
      window.destroy();
      server.close();
    }
  })
  .then(
    () => app.exit(0),
    (error) => {
      console.error(error);
      app.exit(1);
    },
  );
