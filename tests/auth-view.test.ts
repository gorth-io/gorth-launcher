import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { BrowserWindow as ElectronWindow } from "electron";
import { embeddedViews, handlers, calls } from "./electron-auth-mock";

test("Embedded auth rejects foreign origins/popups, validates bounds, hides callback codes and cleans up", async () => {
  process.env.VITE_SSO_CLIENT_URL = "http://localhost:3000";
  process.env.VITE_SSO_SERVER_URL = "http://localhost:8080";
  process.env.VITE_APP_URL = "http://localhost:5502";
  const callbackOrigin = process.env.VITE_APP_URL;
  const {
    allowedAuthNavigation,
    openAuthView,
    closeAuthView,
    registerAuthViewIpc,
  } = await import("../main/services/auth-view");
  assert(allowedAuthNavigation("http://localhost:3000/auth/sign-in"));
  assert(!allowedAuthNavigation("https://foreign.example/auth/sign-in"));
  assert(
    !allowedAuthNavigation("http://credentials@localhost:3000/auth/sign-in"),
  );
  assert(!allowedAuthNavigation("file:///etc/passwd"));
  assert(!allowedAuthNavigation(callbackOrigin + "/unexpected"));
  const children: unknown[] = [];
  const events: unknown[] = [];
  const root = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    getContentSize: () => [1280, 720],
    webContents: {
      isDestroyed: () => false,
      send: (_channel: string, value: unknown) => events.push(value),
    },
    contentView: {
      addChildView: (view: unknown) => {
        const index = children.indexOf(view);
        if (index >= 0) children.splice(index, 1);
        children.push(view);
      },
      removeChildView: (view: unknown) => {
        const index = children.indexOf(view);
        if (index >= 0) children.splice(index, 1);
      },
    },
  });
  const window = root as unknown as ElectronWindow;
  registerAuthViewIpc((event) => {
    if (!event) throw new Error("Untrusted sender");
    return window;
  });
  const controller = new AbortController();
  const callbacks: string[] = [];
  calls.navigationErrors.push(
    Object.assign(new Error("ERR_ABORTED"), { errno: -3 }),
  );
  await openAuthView(
    window,
    "http://localhost:3000/auth/oauth2/authorize?state=PRIVATE-STATE",
    (url) => {
      callbacks.push(url);
      return true;
    },
    controller,
    "register",
  );
  const view = embeddedViews.at(-1)!;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { error: string }).error,
    "",
  );
  calls.navigationErrors.push(
    Object.assign(new Error("ERR_ABORTED"), { errno: -3 }),
  );
  view.openHandler!({ url: "http://localhost:3000/auth/sign-in" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { error: string }).error,
    "",
  );
  calls.navigationErrors.push(
    Object.assign(new Error("ERR_QUIC_PROTOCOL_ERROR"), { errno: -356 }),
  );
  view.openHandler!({ url: "http://localhost:3000/auth/sign-in" });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert((handlers.get("auth:view-state")!({}) as { error: string }).error);
  assert.equal(children.length, 1);
  view.webContents.emit(
    "did-navigate",
    {},
    "http://localhost:3000/auth/sign-in?state=PRIVATE-STATE",
  );
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { url?: string }).url,
    "http://localhost:3000/auth/sign-in",
  );
  assert(!JSON.stringify(events).includes("PRIVATE-"));
  const prefs = (view.options as { webPreferences: Record<string, unknown> })
    .webPreferences;
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.preload, undefined);
  assert.equal(
    view.openHandler!({ url: "https://foreign.example" }).action,
    "deny",
  );
  assert.equal(children.length, 1);
  const before = view.bounds;
  handlers.get("auth:view-bounds")!(
    {},
    { x: -1, y: 0, width: 99999, height: 99999 },
  );
  assert.equal(view.bounds, before);
  handlers.get("auth:view-bounds")!(
    {},
    { x: 0, y: 112, width: 1280, height: 608 },
  );
  assert.deepEqual(view.bounds, { x: 0, y: 112, width: 1280, height: 608 });
  handlers.get("auth:view-visible")!({}, false);
  assert.equal(view.visible, false);
  handlers.get("auth:view-visible")!({}, true);
  assert.equal(view.visible, true);
  for (const channel of [
    "auth:view-state",
    "auth:view-bounds",
    "auth:view-reload",
    "auth:view-visible",
  ])
    assert.throws(() => handlers.get(channel)!(null), /Untrusted/);
  let blocked = false;
  const callback =
    callbackOrigin + "/auth/callback?code=PRIVATE-CODE&state=PRIVATE-STATE";
  view.webContents.emit(
    "will-redirect",
    {
      preventDefault: () => {
        blocked = true;
      },
    },
    callback,
  );
  assert(blocked);
  assert.deepEqual(callbacks, [callback]);
  assert.equal(view.visible, false);
  assert(!JSON.stringify(events).includes("PRIVATE-"));
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { completed?: boolean }).completed,
    undefined,
  );
  // Only the verified auth service is allowed to mark a completed login.
  closeAuthView(window, true);
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { completed?: boolean }).completed,
    true,
  );
  assert.equal(children.length, 0);
  assert.equal(view.closed, true);
  const delivered = events.length;
  view.webContents.emit("did-stop-loading");
  assert.equal(
    events.length,
    delivered,
    "Late native events must not reopen a closed auth screen",
  );
  await openAuthView(
    window,
    "http://localhost:3000/auth/sign-in",
    () => false,
    controller,
    "login",
  );
  controller.abort();
  assert.equal(children.length, 0);
  assert.equal(
    (handlers.get("auth:view-state")!({}) as { completed?: boolean }).completed,
    false,
  );
});
