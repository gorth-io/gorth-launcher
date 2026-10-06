import { useCallback, useState } from "react";
import type { Page } from "@/lib/utils/interface";

export function useLauncherNavigation() {
  const [history, setHistory] = useState<{ pages: Page[]; index: number }>({
    pages: ["home"],
    index: 0,
  });
  const navigate = useCallback(
    (page: Page) =>
      setHistory((current) => {
        if (current.pages[current.index] === page) return current;
        const pages = [...current.pages.slice(0, current.index + 1), page];
        return { pages, index: pages.length - 1 };
      }),
    [],
  );
  const back = useCallback(
    () =>
      setHistory((current) => ({
        ...current,
        index: Math.max(0, current.index - 1),
      })),
    [],
  );
  const forward = useCallback(
    () =>
      setHistory((current) => ({
        ...current,
        index: Math.min(current.pages.length - 1, current.index + 1),
      })),
    [],
  );
  return {
    page: history.pages[history.index],
    navigate,
    back,
    forward,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.pages.length - 1,
  };
}
