import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-auth-ui-test-")),
);

app
  .whenReady()
  .then(async () => {
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
      const assets = path.resolve("dist/assets");
      const stylesheet = readdirSync(assets).find((name) =>
        /^index-.*\.css$/.test(name),
      )!;
      const css = readFileSync(path.join(assets, stylesheet), "utf8");
      const script = readFileSync(".vite/auth-screen-renderer.js", "utf8");
      await window.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent('<div id="root" style="height:100vh"></div>'),
      );
      await window.webContents.insertCSS(css);
      await window.webContents.executeJavaScript(script);
      const run = (source: string) =>
        window.webContents.executeJavaScript(source);
      const wait = async (expression: string) => {
        const deadline = Date.now() + 5000;
        while (!(await run(expression))) {
          assert(Date.now() < deadline, "UI state did not settle");
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      };
      await wait('Boolean(document.querySelector("header input"))');
      assert.equal(
        await run(
          'document.querySelectorAll("header .lucide-panel-left").length',
        ),
        0,
      );
      const dimensions = await run(
        '(() => { const header = document.querySelector("header"); const back = header.querySelector("button"); return { height: header.getBoundingClientRect().height, input: header.querySelector("input").getBoundingClientRect().height, text: back.textContent.trim(), label: back.getAttribute("aria-label") }; })()',
      );
      assert.equal(dimensions.height, 56);
      assert.equal(dimensions.input, 36);
      assert.equal(dimensions.text, "");
      assert.equal(dimensions.label, "Quay lại trang hồ sơ Gorth");
      assert(
        await run('Boolean(document.querySelector("header .lucide-undo-2"))'),
      );
      await run("window.authUiTest.setLoading(true)");
      await wait(
        'Boolean(document.querySelector("header button:last-child svg.animate-spin"))',
      );
      assert.equal(
        await run('document.querySelectorAll(".animate-spin").length'),
        1,
      );
      assert.equal(
        await run('document.querySelector("[role=status]").textContent.trim()'),
        "",
      );
      await run("window.authUiTest.setLoading(false)");
      await wait('!document.querySelector(".animate-spin")');
      await run('document.querySelector("header button").click()');
      await wait('Boolean(document.querySelector("[data-route]"))');
      assert.equal(await run("window.authUiTest.cancelled"), 1);
      assert.equal(
        await run(
          'document.querySelector("[data-route]").getAttribute("data-route")',
        ),
        "gorth://settings/profile",
      );
      await run("window.authUiTest.open()");
      await wait('Boolean(document.querySelector("header input"))');
      await new Promise((resolve) => setTimeout(resolve, 100));
      await run("window.authUiTest.finish(false)");
      await new Promise((resolve) => setTimeout(resolve, 650));
      assert.equal(
        await run("window.authUiTest.returned"),
        1,
        "Failure must not auto-navigate",
      );
      await run("window.authUiTest.finish(true)");
      await wait('Boolean(document.querySelector("[data-route]"))');
      assert.equal(await run("window.authUiTest.returned"), 2);
      await run("window.authUiTest.showNavigation()");
      await wait('Boolean(document.querySelector("[data-current-page]"))');
      assert.equal(
        await run('document.querySelectorAll("header input").length'),
        0,
      );
      assert.equal(
        await run(
          'document.querySelector("header button:nth-child(2)").disabled',
        ),
        true,
      );
      assert.equal(
        await run(
          'document.querySelector("header button:nth-child(3)").disabled',
        ),
        true,
      );
      await run('document.querySelector("header button").click()');
      await wait(
        'document.querySelector("header button").getAttribute("aria-expanded") === "false"',
      );
      await run('document.querySelector("[data-go-library]").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "library"',
      );
      await run('document.querySelector("[data-go-accounts]").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "accounts"',
      );
      await run('document.querySelector("header button:nth-child(2)").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "library"',
      );
      await run('document.querySelector("header button:nth-child(3)").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "accounts"',
      );
      await run('document.querySelector("header button:nth-child(2)").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "library"',
      );
      await run('document.querySelector("[data-go-settings]").click()');
      await wait(
        'document.querySelector("[data-current-page]").textContent === "settings"',
      );
      assert.equal(
        await run(
          'document.querySelector("header button:nth-child(3)").disabled',
        ),
        true,
        "New navigation must discard forward history",
      );
      assert.equal(BrowserWindow.getAllWindows().length, 1);
      console.info(
        "Auth renderer: h-14 bar, h-9 input, icon back to profile, success-only automatic return and no popup passed.",
      );
    } finally {
      window.destroy();
    }
  })
  .then(() => app.exit(0))
  .catch((error: unknown) => {
    console.error("Auth renderer regression failed (test fixture only).");
    console.error(
      error instanceof Error
        ? error.message.split("\n")[0]
        : "Unknown fixture error",
    );
    app.exit(1);
  });
