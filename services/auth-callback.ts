let receiver: ((url: string) => boolean) | null = null;

// One active transaction per desktop app; state/PKCE remain in the main process.
export function registerAuthCallback(callback: (url: string) => boolean) {
  if (receiver) throw new Error("Một giao dịch đăng nhập đang chờ phản hồi.");
  receiver = callback;
  return () => {
    if (receiver === callback) receiver = null;
  };
}
export function receiveAuthCallback(url: string) {
  return receiver?.(url) ?? false;
}
