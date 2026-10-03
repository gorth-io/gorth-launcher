import { useCallback, useEffect, useState } from "react";
import type { AuthCommand, AuthSnapshot } from "@/lib/utils/interface";
export function useAuth() {
  const [auth, setAuth] = useState<AuthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
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
    if (!cancelling) setBusy(true);
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
      if (!cancelling) setBusy(false);
    }
  }, []);
  return { auth, busy, error, run, ready };
}
