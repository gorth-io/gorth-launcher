"use client";

let refreshRequest: Promise<boolean> | null = null;

export function refreshAuthentication() {
  if (refreshRequest) return refreshRequest;
  refreshRequest = window.electronAPI.auth
    .command({ action: "launcher.refresh" })
    .then((result) => !result.error)
    .catch(() => false)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}

export async function withAuthRetry<T>(
  request: () => Promise<T>,
  getStatus: (error: unknown) => number | undefined,
  enabled = true,
) {
  try {
    return await request();
  } catch (error) {
    if (!enabled || getStatus(error) !== 401) throw error;
    if (!(await refreshAuthentication())) throw error;
    return request();
  }
}
