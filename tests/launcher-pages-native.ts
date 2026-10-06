import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { app, BrowserWindow } from "electron";

void app
  .whenReady()
  .then(async () => {
    const server = createServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end("<div id='root' style='padding:24px'></div>");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
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
      const styles = path.resolve("dist/assets");
      const css = readdirSync(styles).find((name) =>
        /^index-.*\.css$/.test(name),
      )!;
      await window.webContents.insertCSS(
        readFileSync(path.join(styles, css), "utf8"),
      );
      await window.webContents.executeJavaScript(
        readFileSync(".vite/launcher-pages-renderer.js", "utf8"),
      );
      await window.webContents.executeJavaScript(
        "document.documentElement.classList.add('dark')",
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
              JSON.stringify(await run("window.pagesTest.errors")),
          );
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };
      const pages = [
        "home",
        "library",
        "accounts",
        "console",
        "gallery",
        "settings",
        "instance",
        "notifications",
        "mods",
        "modpacks",
        "resourcepacks",
        "shaders",
      ];
      for (const page of pages) {
        for (const empty of [false, true]) {
          await run(
            `window.pagesTest.render(${JSON.stringify(page)}, ${empty})`,
          );
          await wait(
            `document.querySelector('[data-test-page="${page}"]')?.textContent.length > 0`,
          );
          await new Promise((resolve) => setTimeout(resolve, 50));
          assert.deepEqual(await run("window.pagesTest.errors"), [], page);
          const heights = await run(
            "Array.from(document.querySelectorAll('button')).filter(b => b.getBoundingClientRect().height > 0).map(b => ({ text: b.textContent, height: b.getBoundingClientRect().height }))",
          );
          assert(
            heights.every((item: { height: number }) => item.height === 36),
            `${page}: ${JSON.stringify(heights)}`,
          );
          if (page === "gallery" && !empty)
            await wait(
              "document.querySelector('img[alt=" +
                JSON.stringify("test.png") +
                "]')?.src.startsWith('data:image/')",
            );
        }
      }
      await run("window.pagesTest.render('home')");
      await wait("document.querySelector('[data-test-page=home]')");
      await run(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
      const screenshotDirectory = mkdtempSync(
        path.join(tmpdir(), "gorth-launcher-pages-"),
      );
      writeFileSync(
        path.join(screenshotDirectory, "home.png"),
        (await window.webContents.capturePage()).toPNG(),
      );
      console.log(`UI preview: ${screenshotDirectory}/home.png`);
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Stop').click()",
      );
      assert((await run("window.pagesTest.calls")).includes("stop"));
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Create Instance').click()",
      );
      assert((await run("window.pagesTest.calls")).includes("create-version"));
      await run("window.pagesTest.render('console')");
      await wait(
        "document.querySelector('pre')?.textContent.includes('Test error')",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Export').click()",
      );
      assert((await run("window.pagesTest.calls")).includes("export"));
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim()==='Clear').click()",
      );
      await wait(
        "document.querySelector('pre')?.textContent.includes('Chưa có log')",
      );
      await run("window.pagesTest.setLogs(['[INFO] New streamed line'])");
      await wait(
        "document.querySelector('pre')?.textContent.includes('New streamed line')",
      );
      await run("window.pagesTest.render('settings')");
      await wait(
        "document.querySelector('[aria-label=\"Launcher settings sections\"]')",
      );
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent==='Launch History').click()",
      );
      await wait("document.body.innerText.includes('Chưa có phiên chơi.')");
      await run("window.pagesTest.render('notifications')");
      await wait("document.querySelector('[data-test-page=notifications]')");
      await run(
        "Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đánh dấu đã đọc')).click()",
      );
      assert((await run("window.pagesTest.calls")).includes("read"));
      console.log(
        "Launcher pages: 12 routes, populated/empty states, h-9 buttons, gallery preview, Stop, console export, settings and notification actions passed.",
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
