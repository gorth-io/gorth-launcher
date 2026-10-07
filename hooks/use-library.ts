import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/lib/rpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settingsMutation = useMutation(
    trpc.library.settings.mutationOptions({
      onSuccess: (result) =>
        queryClient.setQueryData(
          trpc.library.snapshot.queryKey(),
          result.snapshot,
        ),
    }),
  );
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
      if (alive) {
        queryClient.setQueryData(trpc.library.snapshot.queryKey(), snapshot);
        setData({
          ...snapshot,
          settings: pendingSettings.current ?? snapshot.settings,
        });
      }
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
        if (!result.ok) {
          setData(result.snapshot);
          setError(result.error ?? "Không chuyển được dữ liệu cũ.");
          setReady(true);
          return;
        }
        return queryClient
          .fetchQuery(
            trpc.library.snapshot.queryOptions(undefined, { retry: false }),
          )
          .then((snapshot) => {
            if (!alive) return;
            setData({
              ...snapshot,
              settings: pendingSettings.current ?? snapshot.settings,
            });
            setReady(true);
          });
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
      const result =
        command.action === "settings"
          ? await settingsMutation.mutateAsync(command.settings)
          : await window.electronAPI.library.command(command);
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
