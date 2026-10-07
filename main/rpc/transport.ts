import { z } from "zod";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { AnyRouter } from "@trpc/server";
import type { RpcResponse } from "@/lib/rpc/interface";

const requestSchema = z
  .object({
    url: z
      .string()
      .max(2_000_000)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.origin === "https://desktop.invalid" &&
            /^\/trpc\/[a-zA-Z][a-zA-Z0-9.]*$/.test(url.pathname) &&
            !url.username &&
            !url.password &&
            !url.hash
          );
        } catch {
          return false;
        }
      }, "Invalid desktop RPC endpoint."),
    method: z.enum(["GET", "POST"]),
    body: z.string().max(8_000_000).optional(),
  })
  .strict()
  .refine((input) => input.method !== "GET" || input.body === undefined);
export async function handleRpcRequest<TContext>(
  router: AnyRouter,
  input: unknown,
  context: TContext,
): Promise<RpcResponse> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 400,
      body: JSON.stringify({
        error: {
          message: "Invalid desktop RPC request.",
          code: -32600,
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        },
      }),
    };
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(parsed.data.url, {
      method: parsed.data.method,
      body: parsed.data.body,
      headers: { "content-type": "application/json" },
    }),
    router,
    createContext: () => context,
  });
  return { status: response.status, body: await response.text() };
}
