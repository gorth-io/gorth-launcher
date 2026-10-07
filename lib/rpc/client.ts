import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { DesktopRouter } from "@/main/rpc/router";

export function createDesktopClient() {
  return createTRPCClient<DesktopRouter>({
    links: [
      httpLink({
        url: "https://desktop.invalid/trpc",
        fetch: async (url, options) => {
          if (options?.signal?.aborted)
            throw new DOMException("Aborted", "AbortError");
          const result = await window.electronAPI.rpc.request({
            url: String(url),
            method: options?.method === "POST" ? "POST" : "GET",
            ...(typeof options?.body === "string"
              ? { body: options.body }
              : {}),
          });
          if (options?.signal?.aborted)
            throw new DOMException("Aborted", "AbortError");
          return new Response(result.body, {
            status: result.status,
            headers: { "content-type": "application/json" },
          });
        },
      }),
    ],
  });
}
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<DesktopRouter>();
