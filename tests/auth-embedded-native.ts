import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { app, BrowserWindow, WebContentsView } from "electron";
import { loginGorth } from "@/lib/auth/gorth";
import {
  openAuthView,
  clearAuthBrowserSession,
} from "@/main/services/auth-view";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-launcher-embedded-auth-")),
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
      await window.loadURL("data:text/html,<main>Desktop test shell</main>");
      await clearAuthBrowserSession();
      for (const mode of ["login", "register"] as const) {
        const controller = new AbortController();
        let authorization: URL | undefined;
        const pending = loginGorth(
          async (url, receive) => {
            authorization = new URL(url);
            await openAuthView(window, url, receive, controller, mode);
          },
          controller.signal,
          mode,
        );
        // Consume cancellation immediately, without logging any token or code.
        const completion = pending.then(
          () => {
            throw new Error(
              "Unexpected authenticated user in anonymous smoke test",
            );
          },
          (error: unknown) => error,
        );
        let view: WebContentsView | undefined;
        let loaded = false;
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
          view = window.contentView.children.find(
            (child) => child instanceof WebContentsView,
          ) as WebContentsView | undefined;
          if (view && !view.webContents.isLoading()) {
            const pathname = new URL(view.webContents.getURL()).pathname;
            if (
              pathname ===
              (mode === "register" ? "/auth/sign-up" : "/auth/sign-in")
            ) {
              loaded = await view.webContents.executeJavaScript(
                'Boolean(document.querySelector("input[type=email]") && document.querySelector("input[type=password]"))',
              );
              if (loaded) break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        assert(
          loaded,
          "Live SSO must display its login/sign-up form inside the existing window",
        );
        assert.equal(
          authorization?.searchParams.get("prompt"),
          mode === "register" ? "create" : null,
        );
        assert.equal(BrowserWindow.getAllWindows().length, 1);
        assert(view);
        const preferences = view.webContents.getLastWebPreferences();
        assert.equal(preferences.nodeIntegration, false);
        assert.equal(preferences.contextIsolation, true);
        assert.equal(preferences.sandbox, true);
        assert.equal(
          await view.webContents.executeJavaScript("typeof window.electronAPI"),
          "undefined",
        );
        await view.webContents.executeJavaScript(
          'window.open("https://untrusted.example", "_blank"); void 0;',
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        assert.equal(
          BrowserWindow.getAllWindows().length,
          1,
          "SSO must never create a popup window",
        );
        controller.abort();
        assert((await completion) instanceof Error);
        assert.equal(window.contentView.children.length, 0);
        console.info(
          "Embedded " +
            mode +
            ": live SSO form, sandbox, popup denial and cancellation passed.",
        );
      }
    } finally {
      window.destroy();
    }
  })
  .then(() => app.exit(0))
  .catch(() => {
    console.error(
      "Embedded SSO smoke test failed; no credentials or callback codes were logged.",
    );
    app.exit(1);
  });
