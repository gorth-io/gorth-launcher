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
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000),
    headers: { Accept: "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
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
