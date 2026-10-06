import { ipcRenderer } from "electron";
import type {
  GameCommand,
  GameResult,
  GameSnapshot,
  GameVersion,
} from "@/lib/utils/interface";
export const gameApi = {
  openDirectory: (id?: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("game:open-directory", id),
  snapshot: (): Promise<GameSnapshot> => ipcRenderer.invoke("game:snapshot"),
  versions: (): Promise<GameVersion[]> => ipcRenderer.invoke("game:versions"),
  command: (command: GameCommand): Promise<GameResult> =>
    ipcRenderer.invoke("game:command", command),
  exportLog: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("game:export-log", { id }),
  onChanged: (callback: (snapshot: GameSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: GameSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on("game:changed", listener);
    return () => {
      ipcRenderer.removeListener("game:changed", listener);
    };
  },
};
