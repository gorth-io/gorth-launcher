import { fetcher } from "@/lib/utils/fetcher";
import type { Method } from "axios";

export class AuthHttpError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super("Dịch vụ xác thực từ chối yêu cầu (" + status + ").");
  }
}
export async function requestJson(
  url: string | URL,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetcher<string>({
    url,
    method: (options.method ?? "GET") as Method,
    body: options.body,
    redirect: "error",
    signal: signal ?? options.signal ?? undefined,
    timeout: 20_000,
    responseType: "text",
    validateStatus: () => true,
    headers: {
      Accept: "application/json",
      ...Object.fromEntries(new Headers(options.headers)),
    },
  });
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(response.data);
  } catch {
    // Keep OAuth error handling stable even when upstream returns HTML.
  }
  if (response.status < 200 || response.status >= 300)
    throw new AuthHttpError(
      typeof data?.error === "string" ? data.error : "request_failed",
      response.status,
    );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Phản hồi xác thực không hợp lệ.");
  return data;
}
export function formRequest(
  url: string | URL,
  fields: Record<string, string>,
  signal?: AbortSignal,
) {
  return requestJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    },
    signal,
  );
}
