import axios, { AxiosError } from "axios";
const nativeFetch = globalThis.fetch;

// Reuse existing synthetic Response fixtures; never allow an actual remote fetch.
export function mockAxiosResponses() {
  const previous = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    if (globalThis.fetch === nativeFetch)
      throw new Error("Missing HTTP fixture; remote requests are forbidden.");
    const response = await globalThis.fetch(config.url!, {
      method: config.method,
      body: config.data,
      headers: config.headers.toJSON() as Record<string, string>,
      signal: config.signal as AbortSignal,
    });
    const text = await response.text();
    let data: unknown = text;
    if (config.responseType !== "text") {
      try {
        data = JSON.parse(text);
      } catch {
        /* Text fixture. */
      }
    }
    const result = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      config,
    };
    if (config.validateStatus && !config.validateStatus(response.status))
      throw new AxiosError(
        "Rejected fixture",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        result,
      );
    return result;
  };
  return () => {
    axios.defaults.adapter = previous;
  };
}
