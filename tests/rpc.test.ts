import assert from "node:assert/strict";
import { test } from "node:test";
import { createTRPCClient, httpLink } from "@trpc/client";
import {
  desktopRouter,
  type DesktopContext,
  type DesktopRouter,
} from "@/main/rpc/router";
import { handleRpcRequest } from "@/main/rpc/transport";
import { isRpcRendererUrl } from "@/main/rpc/sender";
import { createLauncherRouter, launcherPages } from "@/lib/navigation";
import { createDesktopClient } from "@/lib/rpc/client";
import { isAbortedNavigation } from "@/lib/webview/errors";

test("production tRPC client uses IPC without a network fetch", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let ipcCalls = 0;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network fetch");
  };
  const snapshot = {
    instances: [],
    instanceSettings: {},
    trash: [],
    settings: { memory: 4, javaPath: "" },
  };
  const context: DesktopContext = {
    snapshot: () => snapshot,
    settings: async (settings) => ({
      ok: true,
      snapshot: { ...snapshot, settings },
    }),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      electronAPI: {
        rpc: {
          request: async (input: unknown) => {
            ipcCalls++;
            return handleRpcRequest(desktopRouter, input, context);
          },
        },
      },
    },
  });
  try {
    const rpc = createDesktopClient();
    assert.equal((await rpc.library.snapshot.query()).settings.memory, 4);
    assert.equal(
      (await rpc.library.settings.mutate({ memory: 8, javaPath: "" })).snapshot
        .settings.memory,
      8,
    );
    assert.equal(ipcCalls, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("only ERR_ABORTED is ignored; QUIC, TLS and network errors remain visible", () => {
  assert(isAbortedNavigation({ errno: -3 }));
  for (const error of [
    null,
    undefined,
    "ERR_ABORTED",
    new Error("ERR_ABORTED"),
    { errno: "-3" },
    { errno: -356 },
    { errno: -202 },
    { errno: -105 },
  ])
    assert.equal(isAbortedNavigation(error), false);
});

function client(context: DesktopContext) {
  return createTRPCClient<DesktopRouter>({
    links: [
      httpLink({
        url: "https://desktop.invalid/trpc",
        fetch: async (url, options) => {
          const result = await handleRpcRequest(
            desktopRouter,
            {
              url: String(url),
              method: options?.method ?? "GET",
              ...(typeof options?.body === "string"
                ? { body: options.body }
                : {}),
            },
            context,
          );
          return new Response(result.body, {
            status: result.status,
            headers: { "content-type": "application/json" },
          });
        },
      }),
    ],
  });
}
test("launcher RPC loads and updates settings, invalid settings never reach storage", async () => {
  let snapshot = {
    instances: [],
    instanceSettings: {},
    trash: [],
    settings: { memory: 4, javaPath: "" },
  };
  const context: DesktopContext = {
    snapshot: () => snapshot,
    settings: async (settings) => {
      snapshot = { ...snapshot, settings };
      return { ok: true, snapshot };
    },
  };
  const rpc = client(context);
  assert.equal((await rpc.library.snapshot.query()).settings.memory, 4);
  assert.equal(
    (await rpc.library.settings.mutate({ memory: 8, javaPath: "/java" }))
      .snapshot.settings.memory,
    8,
  );
  for (const memory of [0, 65, 1.5])
    await assert.rejects(rpc.library.settings.mutate({ memory, javaPath: "" }));
  assert.equal(snapshot.settings.memory, 8);
  const wrongMethod = await handleRpcRequest(
    desktopRouter,
    { url: "https://desktop.invalid/trpc/library.settings", method: "GET" },
    context,
  );
  assert.equal(wrongMethod.status, 405);
});
test("launcher routes preserve back/forward history and truncate the forward branch", async () => {
  const router = createLauncherRouter(() => null);
  await router.load();
  for (const page of launcherPages) {
    router.history.push("/" + page);
    router.update({});
    await router.load();
    assert.equal(router.state.matches.at(-1)?.status, "success");
  }
  const history = router.history;
  history.back();
  assert(history.canGoBack());
  const length = history.length;
  history.push("/home");
  assert.equal(history.length, length);
  assert.equal(history.location.pathname, "/home");
  assert.equal(history.location.state.__TSR_index, length - 1);
});
test("RPC only accepts bounded requests to the local adapter endpoint", async () => {
  for (const input of [
    null,
    {},
    { url: "https://attacker.example/trpc/session.load", method: "GET" },
    { url: "file:///trpc/session.load", method: "GET" },
    { url: "https://desktop.invalid/trpc/session.load", method: "DELETE" },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "GET",
      body: "{}",
    },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "GET",
      headers: {},
    },
    {
      url: "https://user:pass@desktop.invalid/trpc/session.load",
      method: "GET",
    },
    {
      url: "https://desktop.invalid/trpc/session.load#fragment",
      method: "GET",
    },
    {
      url: "https://desktop.invalid/trpc/session.load",
      method: "POST",
      body: "a".repeat(8_000_001),
    },
  ]) {
    const result = await handleRpcRequest(desktopRouter, input, {});
    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.data.code, "BAD_REQUEST");
  }
});
test("RPC renderer URL cannot be a remote site, auth page, portal, or wrong file", () => {
  const expected = "http://127.0.0.1:5501/assets/index.html";
  assert(isRpcRendererUrl(expected, expected));
  assert(isRpcRendererUrl(expected + "?theme=dark", expected));
  for (const value of [
    "about:blank",
    "https://google.com",
    "http://127.0.0.1:5501/auth/callback",
    "http://127.0.0.1:5502/assets/index.html",
    "http://user:pass@127.0.0.1:5501/assets/index.html",
  ])
    assert(!isRpcRendererUrl(value, expected));
  assert(
    isRpcRendererUrl(
      "file:///app/assets/index.html",
      "file:///app/assets/index.html",
    ),
  );
  assert(
    !isRpcRendererUrl(
      "file:///other/index.html",
      "file:///app/assets/index.html",
    ),
  );
  assert(
    !isRpcRendererUrl(
      "file://attacker/app/assets/index.html",
      "file:///app/assets/index.html",
    ),
  );
});
