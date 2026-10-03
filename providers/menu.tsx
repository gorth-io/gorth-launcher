import { useEffect, useState } from "react";
import { PortalPanel } from "@/providers/portal";
import {
  Code,
  Maximize,
  Minus,
  Plus,
  RotateCw,
  ScanSearch,
  Settings,
  X,
} from "lucide-react";
import {
  PopoverMenuItem,
  PopoverMenuLabel,
  PopoverMenuSeparator,
} from "@/components/element/popover-menu";
import type { AppMenuAction } from "@/lib/utils/interface";

export function MenuPortal() {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    titlebar: boolean;
  } | null>(null);
  useEffect(
    () =>
      window.electronAPI.contextMenu.onTitlebar((point) =>
        setMenu({ ...point, titlebar: true }),
      ),
    [],
  );
  useEffect(() => {
    const close = () => setMenu(null);

    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("resize", close);
    };
  }, []);
  useEffect(() => {
    const open = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, [contenteditable="true"], dialog, [data-launcher-context-menu]',
        )
      )
        return;
      if (!target.closest("main, [data-launcher-titlebar]")) return;
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        titlebar: !!target.closest("[data-launcher-titlebar]"),
      });
    };
    window.addEventListener("contextmenu", open);
    return () => window.removeEventListener("contextmenu", open);
  }, []);
  const run = (action: () => void) => {
    setMenu(null);
    action();
  };
  const selectAction = (action: AppMenuAction) => {
    window.dispatchEvent(new CustomEvent<AppMenuAction>("launcher:menu-action", { detail: action }));
    setMenu(null);
  };
  const command = (
    action:
      "reload" | "devtools" | "inspect" | "minimize" | "maximize" | "close",
  ) =>
    run(() =>
      window.electronAPI.contextMenu.command(
        action,
        menu ? { x: menu.x, y: menu.y } : undefined,
      ),
    );
  return (
    <>
      {menu && (
        <PortalPanel
          anchor={{ ...menu, width: 0, height: 0 }}
          align="start"
          onClose={() => setMenu(null)}
        >
          <PopoverMenuLabel>
            {menu.titlebar ? "Launcher" : "Page"}
          </PopoverMenuLabel>
          {menu.titlebar ? (
            <>
              <PopoverMenuItem
                onClick={() => selectAction("new-instance")}
              >
                <Plus />
                New instance
              </PopoverMenuItem>
              <PopoverMenuItem onClick={() => selectAction("settings")}>
                <Settings />
                Settings
              </PopoverMenuItem>
              <PopoverMenuSeparator />
              <PopoverMenuItem onClick={() => command("minimize")}>
                <Minus />
                Minimize
              </PopoverMenuItem>
              <PopoverMenuItem onClick={() => command("maximize")}>
                <Maximize />
                Maximize / Restore
              </PopoverMenuItem>
              <PopoverMenuItem destructive onClick={() => command("close")}>
                <X />
                Close window
              </PopoverMenuItem>
            </>
          ) : (
            <>
              <PopoverMenuItem onClick={() => command("reload")}>
                <RotateCw />
                Reload
              </PopoverMenuItem>
              <PopoverMenuSeparator />
              <PopoverMenuItem onClick={() => command("devtools")}>
                <Code />
                Developer tools
              </PopoverMenuItem>
              <PopoverMenuItem onClick={() => command("inspect")}>
                <ScanSearch />
                Inspect element
              </PopoverMenuItem>
            </>
          )}
        </PortalPanel>
      )}
    </>
  );
}
