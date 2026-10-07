import path from "node:path";
import { pathToFileURL } from "node:url";
import { appUrl } from "@/lib/utils/environment";

export function isRpcRendererUrl(value: string, expected: string) {
  try {
    const actual = new URL(value);
    const renderer = new URL(expected);
    return (
      actual.origin === renderer.origin &&
      actual.host === renderer.host &&
      actual.protocol === renderer.protocol &&
      actual.pathname === renderer.pathname &&
      !actual.username &&
      !actual.password
    );
  } catch {
    return false;
  }
}

export function getRpcRendererUrl() {
  const origin =
    appUrl ||
    (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === "string"
      ? MAIN_WINDOW_VITE_DEV_SERVER_URL
      : "");
  if (origin) return new URL("assets/index.html", origin).href;
  return pathToFileURL(
    path.join(
      __dirname,
      "../renderer",
      MAIN_WINDOW_VITE_NAME,
      "assets/index.html",
    ),
  ).href;
}
