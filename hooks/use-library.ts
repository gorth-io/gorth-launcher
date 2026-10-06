import { useEffect, useRef, useState } from "react";
import type {
  LibraryCommand,
  LibrarySnapshot,
  Settings,
} from "@/lib/utils/interface";
import {
  defaultSettings,
  readInstances,
  readSettings,
} from "@/lib/utils/launcher";

export function useLibrary() {
  const [data, setData] = useState<LibrarySnapshot>({
    instances: [],
    settings: defaultSettings,
    instanceSettings: {},
    trash: [],
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const pendingSettings = useRef<Settings | null>(null);
  useEffect(() => {
    let alive = true;
    const stop = window.electronAPI.library.onChanged((snapshot) => {
      if (alive)
        setData({
          ...snapshot,
          settings: pendingSettings.current ?? snapshot.settings,
        });
    });
    // Keep legacy data intact as a fallback backup. Main imports it only once.
    window.electronAPI.library
      .command({
        action: "migrate",
        instances: readInstances(),
        settings: readSettings(),
      })
      .then((result) => {
        if (!alive) return;
        setData(result.snapshot);
        setReady(result.ok);
        if (!result.ok)
          setError(result.error ?? "Không chuyển được dữ liệu cũ.");
      })
      .catch(() => {
        if (alive) setError("Không đọc được database launcher.");
      });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  async function run(command: LibraryCommand) {
    setError("");
    const changesInstance = command.action !== "settings";
    if (changesInstance) setBusy(true);
    try {
      const result = await window.electronAPI.library.command(command);
      if (
        command.action === "settings" &&
        pendingSettings.current === command.settings
      )
        pendingSettings.current = null;
      setData({
        ...result.snapshot,
        settings: pendingSettings.current ?? result.snapshot.settings,
      });
      if (!result.ok) setError(result.error ?? "Không cập nhật được thư viện.");
      return result.ok;
    } catch {
      setError("Không kết nối được database launcher.");
      return false;
    } finally {
      if (changesInstance) setBusy(false);
    }
  }
  function setSettings(value: Settings | ((current: Settings) => Settings)) {
    const next =
      typeof value === "function"
        ? value(pendingSettings.current ?? data.settings)
        : value;
    pendingSettings.current = next;
    setData((current) => ({ ...current, settings: next }));
    queue.current = queue.current.then(async () => {
      await run({ action: "settings", settings: next });
    });
  }
  return {
    ...data,
    ready,
    busy,
    error,
    run,
    setSettings,
    clearError: () => setError(""),
  };
}
