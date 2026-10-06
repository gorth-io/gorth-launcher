import axios, {
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
} from "axios";

export interface FetcherOptions<
  TBody = unknown,
  TParams = Record<string, unknown>,
> extends Omit<
  AxiosRequestConfig<TBody>,
  "url" | "method" | "data" | "params" | "headers" | "withCredentials"
> {
  url: string | URL;
  method: Method;
  body?: TBody;
  params?: TParams;
  headers?: AxiosRequestConfig<TBody>["headers"];
  cache?: RequestCache;
  credentials?: RequestCredentials;
  redirect?: RequestRedirect;
}

function getCacheHeaders(cache: RequestCache | undefined) {
  switch (cache) {
    case "no-store":
      return { "Cache-Control": "no-store" };
    case "no-cache":
    case "reload":
      return { "Cache-Control": "no-cache" };
    default:
      return {};
  }
}

function getMaxRedirects(
  redirect: RequestRedirect | undefined,
  configuredMaxRedirects: number | undefined,
) {
  return redirect === "manual" || redirect === "error"
    ? 0
    : configuredMaxRedirects;
}

export async function fetcher<
  TData = unknown,
  TBody = unknown,
  TParams = Record<string, unknown>,
>(
  options: FetcherOptions<TBody, TParams>,
): Promise<AxiosResponse<TData, TBody>> {
  const {
    url,
    method,
    body,
    params,
    headers,
    cache,
    credentials,
    redirect,
    maxRedirects,
    ...config
  } = options;

  return axios.request<TData, AxiosResponse<TData, TBody>, TBody>({
    ...config,
    url: url.toString(),
    method,
    data: body,
    params,
    headers: {
      ...getCacheHeaders(cache),
      ...headers,
    },
    maxRedirects: getMaxRedirects(redirect, maxRedirects),
    withCredentials: credentials === "include",
  });
}

function getResponseBody(data: unknown): BodyInit | null {
  if (data === null || data === undefined) return null;
  if (typeof data === "string" || data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return data;

  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  }

  return JSON.stringify(data);
}

const nullBodyStatuses = new Set([204, 205, 304]);

function getResponseHeaders(response: AxiosResponse<unknown>) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, String(item));
      continue;
    }

    headers.set(name, String(value));
  }

  return headers;
}

export function toWebResponse<TData>(response: AxiosResponse<TData>) {
  const body = nullBodyStatuses.has(response.status)
    ? null
    : getResponseBody(response.data);

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: getResponseHeaders(response),
  });
}
