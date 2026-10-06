import { useEffect, useRef, useState } from "react";
import type { GameStatus } from "@/lib/utils/interface";

export interface LauncherNotification {
  id: string;
  title: string;
  body: string;
  time: number;
  read: boolean;
}

export function useNotifications(message: string, jobs: GameStatus[]) {
  const [items, setItems] = useState<LauncherNotification[]>([]);
  const lastMessage = useRef("");
  const phases = useRef(new Map<string, string>());
  useEffect(() => {
    if (message && message !== lastMessage.current)
      setItems((current) =>
        [
          {
            id: crypto.randomUUID(),
            title: "Launcher",
            body: message,
            time: Date.now(),
            read: false,
          },
          ...current,
        ].slice(0, 100),
      );
    lastMessage.current = message;
  }, [message]);
  useEffect(() => {
    const additions: LauncherNotification[] = [];
    for (const job of jobs) {
      if (
        phases.current.get(job.instanceId) !== job.phase &&
        ["ready", "running", "error", "crashed"].includes(job.phase)
      )
        additions.push({
          id: crypto.randomUUID(),
          title: `Minecraft ${job.version}`,
          body: job.message || job.phase,
          time: Date.now(),
          read: false,
        });
      phases.current.set(job.instanceId, job.phase);
    }
    if (additions.length)
      setItems((current) => [...additions, ...current].slice(0, 100));
  }, [jobs]);
  return {
    items,
    unread: items.filter((item) => !item.read).length,
    markRead: () =>
      setItems((current) => current.map((item) => ({ ...item, read: true }))),
    dismiss: (id: string) =>
      setItems((current) => current.filter((item) => item.id !== id)),
    clear: () => setItems([]),
  };
}
