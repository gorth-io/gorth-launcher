import assert from "node:assert/strict";
import test from "node:test";
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { z } from "zod";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  caller,
  callerClient,
  useCallerQuery,
  useCallerMutation,
} from "@/lib/utils/caller";
import { fetcher, toWebResponse } from "@/lib/utils/fetcher";
import { getAccountProfile } from "@/services/account";
import { QueryProvider } from "@/providers/query";
import { toast } from "@/components/custom/toast";

function result(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) {
  return {
    data,
    status,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config,
  };
}
function adapter(
  t: Parameters<Parameters<typeof test>[1]>[0],
  fn: AxiosAdapter,
) {
  const old = axios.defaults.adapter;
  axios.defaults.adapter = fn;
  t.after(() => {
    axios.defaults.adapter = old;
  });
}

test("caller uses Axios, validates Zod, unwraps payloads and exposes toast callbacks", async (t) => {
  const notices: unknown[] = [];
  t.mock.method(toast, "add", (notice: unknown) => {
    notices.push(notice);
    return "fixture";
  });
  const data = await caller({
    url: "https://example.test/items",
    method: "POST",
    body: { name: "hello" },
    schema: z.object({ count: z.number() }),
    toast: { success: "Saved" },
    adapter: async (config) => {
      assert.equal(config.data, '{"name":"hello"}');
      assert.equal(config.headers.getContentType(), "application/json");
      return result(config, { data: { count: 3 } });
    },
  });
  assert.deepEqual(data, { count: 3 });
  assert.deepEqual(notices, [{ type: "success", description: "Saved" }]);
});

test("fetcher preserves form bodies and blocks redirects without using fetch", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Fetch must not be used");
  });
  const response = await fetcher({
    url: "https://example.test/token",
    method: "POST",
    redirect: "error",
    body: new URLSearchParams({ code: "fixture" }),
    adapter: async (config) => {
      assert.equal(config.data, "code=fixture");
      assert.equal(config.maxRedirects, 0);
      return result(config, { ok: true });
    },
  });
  assert.deepEqual(response.data, { ok: true });
});

test("caller normalizes Axios errors, reports toast and does not retry when auth is disabled", async (t) => {
  let calls = 0;
  const notices: unknown[] = [];
  t.mock.method(toast, "add", (notice: unknown) => {
    notices.push(notice);
    return "fixture";
  });
  await assert.rejects(
    caller({
      url: "https://example.test/token",
      auth: false,
      toast: true,
      adapter: async (config) => {
        calls++;
        throw new AxiosError(
          "Rejected",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          result(
            config,
            { error: "invalid_grant", message: "Sign-in rejected" },
            401,
          ),
        );
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error && "status" in error);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Sign-in rejected");
      return true;
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(notices, [
    { type: "error", description: "Sign-in rejected" },
  ]);
});

test("account service handles non-JSON 401 without exposing the capability", async (t) => {
  adapter(t, async (config) => {
    assert.equal(config.headers.get("x-gorth-desktop-session"), "fixture");
    return result(config, "Not signed in", 401);
  });
  assert.equal(
    await getAccountProfile("https://example.test", "fixture"),
    null,
  );
});

test("account service returns the profile through Axios", async (t) => {
  adapter(t, async (config) => result(config, { profile: { name: "Gorth" } }));
  assert.deepEqual(await getAccountProfile("https://example.test", "fixture"), {
    name: "Gorth",
  });
});

test("caller handles 204 and cancellation", async () => {
  assert.equal(
    await caller({
      url: "https://example.test",
      adapter: async (config) => result(config, "", 204),
    }),
    null,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetcher({
      url: "https://example.test",
      method: "GET",
      signal: controller.signal,
      adapter: async (config) => result(config, {}),
    }),
    (error: unknown) => axios.isCancel(error),
  );
});

test("QueryProvider supports caller query and mutation hooks", () => {
  function Sample() {
    const query = useCallerQuery({
      url: "/fixture",
      queryKey: ["fixture"],
      queryOptions: { enabled: false },
    });
    const mutation = useCallerMutation({ url: "/fixture", method: "POST" });
    return createElement(
      "span",
      null,
      query.fetchStatus + ":" + mutation.status,
    );
  }
  assert.match(
    renderToString(createElement(QueryProvider, null, createElement(Sample))),
    /idle:idle/,
  );
});

test("toWebResponse preserves binary views and separate Set-Cookie headers", async () => {
  const response = toWebResponse({
    data: new Uint8Array([0, 1, 2, 3]).subarray(1, 3),
    status: 200,
    statusText: "OK",
    headers: { "set-cookie": ["a=1; HttpOnly", "b=2; HttpOnly"] },
    config: { headers: new AxiosHeaders() },
  });
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [1, 2],
  );
  assert.equal(response.headers.getSetCookie().length, 2);
});
