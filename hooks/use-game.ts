import { useCallback, useEffect, useState } from "react";
import type {
  GameCommand,
  GameSnapshot,
  GameVersion,
} from "@/lib/utils/interface";
export function useGame() {
  const [game, setGame] = useState<GameSnapshot>({
    directory: "",
    jobs: [],
    activeId: null,
    activeIds: [],
    downloadingId: null,
    queue: [],
    history: [],
  });
  const [versions, setVersions] = useState<GameVersion[]>([
    { id: "1.20.1", type: "release" },
  ]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const accept = (value: GameSnapshot) => {
      if (alive) setGame(value);
    };
    const stop = window.electronAPI.game.onChanged(accept);
    window.electronAPI.game
      .snapshot()
      .then(accept)
      .catch(() => {
        if (alive) setError("Không đọc được trạng thái game.");
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    window.electronAPI.game
      .versions()
      .then((value) => {
        if (alive) setVersions(value);
      })
      .catch(() => {
        /* retain supported default when offline */
      });
    return () => {
      alive = false;
      stop();
    };
  }, []);
  const run = useCallback(async (command: GameCommand) => {
    setError("");
    try {
      const result = await window.electronAPI.game.command(command);
      setGame(result.snapshot);
      if (!result.ok)
        setError(result.error ?? "Không xử lý được yêu cầu game.");
      return result.ok;
    } catch {
      setError("Không kết nối được dịch vụ game.");
      return false;
    }
  }, []);
  const openDirectory = useCallback(async (id?: string) => {
    setError("");
    try {
      const result = await window.electronAPI.game.openDirectory(id);
      if (!result.ok)
        setError(result.error ?? "Không mở được thư mục Minecraft.");
    } catch {
      setError("Không kết nối được dịch vụ game.");
    }
  }, []);
  const exportLog = useCallback(async (id: string) => {
    const result = await window.electronAPI.game.exportLog(id);
    if (!result.ok) setError(result.error ?? "Không xuất được console.");
    return result.ok;
  }, []);
  return {
    game,
    versions,
    error,
    run,
    openDirectory,
    exportLog,
    ready,
    clearError: () => setError(""),
  };
}
