import { useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import type { Page } from "@/lib/utils/interface";

export function useLauncherNavigation() {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const page = location.pathname.slice(1) as Page;
  const index = location.state.__TSR_index ?? 0;
  const navigate = useCallback(
    (next: Page) => {
      if (router.state.location.pathname !== "/" + next)
        void router.navigate({ to: "/" + next });
    },
    [router],
  );
  return {
    page,
    navigate,
    back: () => router.history.back(),
    forward: () => router.history.forward(),
    canGoBack: index > 0,
    canGoForward: index < router.history.length - 1,
  };
}
