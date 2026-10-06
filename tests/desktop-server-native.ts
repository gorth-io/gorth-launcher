import assert from "node:assert/strict";
import { app, BrowserWindow } from "electron";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  startDesktopServer,
  stopDesktopServer,
} from "@/services/desktop-server";
import { registerAuthCallback } from "@/services/auth-callback";
import { upsertUserProfile, getUserProfile } from "@/services/user-profile";
import { createDesktopDevServer } from "@/lib/server/vite";
import { appUrl } from "@/lib/utils/environment";

app.setPath(
  "userData",
  mkdtempSync(path.join(tmpdir(), "gorth-server-native-")),
);
awaitTest();
async function awaitTest() {
  await app.whenReady();
  let window: BrowserWindow | undefined;
  let vite:
    Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
  let identityId: string | null = "native-user";
  try {
    upsertUserProfile({
      id: "native-user",
      name: "Native Test",
      emailVerified: true,
    });
    const fixture = path.resolve("tests/fixtures/server");
    await startDesktopServer(false, fixture, () => identityId);
    window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.resolve(".vite/server-native-preload.cjs"),
      },
    });
    await window.loadURL(appUrl + "/assets/index.html");
    assert.equal(
      await window.webContents.executeJavaScript(
        "document.querySelector('h1').textContent",
      ),
      "Desktop server fixture",
    );
    assert.equal((await fetch(appUrl + "/health")).status, 200);
    assert.equal((await fetch(appUrl + "/user/profile")).status, 403);
    let profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.body.profile.ssoUserId, "native-user");
    assert.equal(
      (
        await window.webContents.executeJavaScript(
          "window.testDesktop.profileData()",
        )
      ).ssoUserId,
      "native-user",
    );
    identityId = null;
    profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 401);
    assert.equal(
      await window.webContents.executeJavaScript(
        "window.testDesktop.profileData()",
      ),
      null,
    );
    assert.equal(getUserProfile("native-user")?.name, "Native Test");
    stopDesktopServer();
    // Forge uses Vite on the public port; Hono uses only an OS IPC endpoint in main.
    const { createServer } = await import("vite");
    vite = await createServer({
      configFile: false,
      root: fixture,
      server: {
        ...createDesktopDevServer(
          app.getAppPath(),
          Number(new URL(appUrl).port),
        ),
        hmr: false,
      },
    });
    await startDesktopServer(true, fixture, () => identityId);
    await vite.listen();
    await window.loadURL(appUrl + "/assets/index.html");
    assert.equal((await fetch(appUrl + "/health")).status, 200);
    identityId = "native-user";
    profile = await window.webContents.executeJavaScript(
      "window.testDesktop.profile()",
    );
    assert.equal(profile.status, 200);
    let consumed = false;
    const remove = registerAuthCallback((value) => {
      if (
        consumed ||
        new URL(value).searchParams.get("state") !== "native-state"
      )
        return false;
      consumed = true;
      return true;
    });
    try {
      assert.equal(
        (
          await fetch(
            appUrl + "/auth/callback?state=native-state&code=test-code",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(
            appUrl + "/auth/callback?state=native-state&code=test-code",
          )
        ).status,
        400,
      );
    } finally {
      remove();
    }
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    console.log(
      "Native desktop: packaged assets/API, sandboxed profile bridge, logout cache, same-port Vite/Hono and callback replay protection passed.",
    );
  } catch {
    process.exitCode = 1;
    console.error(
      "Native desktop server test failed; no credentials or callback URLs were logged.",
    );
  } finally {
    window?.destroy();
    stopDesktopServer();
    await vite?.close();
    app.exit(process.exitCode ?? 0);
  }
}
