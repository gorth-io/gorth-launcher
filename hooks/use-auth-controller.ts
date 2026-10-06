import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthCommand, AuthSnapshot } from "@/lib/utils/interface";
export function useAuthController() {
  const [auth, setAuth] = useState<AuthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  useEffect(() => {
    let active = true;
    const accept = (value: AuthSnapshot) => {
      if (active) setAuth(value);
    };
    const unsubscribe = window.electronAPI.auth.onChanged(accept);
    window.electronAPI.auth
      .snapshot()
      .then((result) => {
        accept(result.snapshot);
        if (active && !result.ok)
          setError(result.error ?? "Không đọc được tài khoản.");
      })
      .catch(() => {
        if (active) setError("Không kết nối được dịch vụ tài khoản.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    // Recompute expiry display without exposing or refreshing tokens in the renderer.
    const timer = setInterval(() => {
      window.electronAPI.auth
        .snapshot()
        .then((result) => accept(result.snapshot))
        .catch(() => {});
    }, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, []);
  const run = useCallback(async (command: AuthCommand) => {
    const cancelling = command.action === "cancel";
    if (!cancelling) {
      if (operation.current) return false;
      operation.current = true;
      setBusy(true);
    }
    setError("");
    try {
      const result = await window.electronAPI.auth.command(command);
      setAuth(result.snapshot);
      if (!result.ok) setError(result.error ?? "Không thể cập nhật tài khoản.");
      return result.ok;
    } catch {
      setError("Không kết nối được dịch vụ tài khoản.");
      return false;
    } finally {
      if (!cancelling) {
        operation.current = false;
        setBusy(false);
      }
    }
  }, []);
  const current = useRef(auth);
  useEffect(() => {
    current.current = auth;
  }, [auth]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const snapshot = current.current;
      if (
        snapshot?.launcher &&
        snapshot.launcher.canRefresh &&
        !snapshot.locked &&
        !snapshot.pending &&
        !operation.current &&
        snapshot.launcher.expiresAt <= Date.now() + 60_000
      )
        void run({ action: "launcher.refresh" });
    };
    const timer = setInterval(refreshIfNeeded, 30_000);
    window.addEventListener("focus", refreshIfNeeded);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfNeeded);
    };
  }, [run]);
  const account = auth?.launcher ?? null;
  const refresh = useCallback(async () => {
    if (!(await run({ action: "launcher.refresh" }))) return null;
    try {
      const result = await window.electronAPI.auth.snapshot();
      setAuth(result.snapshot);
      return result.snapshot.launcher;
    } catch {
      setError("Không đọc được phiên Gorth sau khi làm mới.");
      return null;
    }
  }, [run]);
  return {
    auth,
    busy,
    error,
    run,
    ready,
    account,
    username: account?.username ?? null,
    authenticated: !!account && !account.needsLogin,
    loading: !ready || busy || !!auth?.pending,
    locked: !!auth?.locked,
    login: () => run({ action: "launcher.login" }),
    register: () => run({ action: "launcher.register" }),
    logout: () => run({ action: "launcher.logout" }),
    unlock: () => run({ action: "launcher.unlock" }),
    cancel: () => run({ action: "cancel" }),
    refresh,
  };
}
