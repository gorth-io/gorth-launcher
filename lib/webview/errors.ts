/** Chromium cancels the old load on redirects, replacement loads and Stop. */
export function isAbortedNavigation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "errno" in error &&
    error.errno === -3,
  );
}
