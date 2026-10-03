import { Box } from "lucide-react";
import { useFullScreen } from "@/hooks/use-full-screen";
import { cn } from "@/lib/utils";

export function Titlebar() {
  const isFullScreen = useFullScreen();
  return (
    <header
      data-launcher-titlebar
      className="app-drag relative z-50 flex h-14 shrink-0 items-center border-b bg-sidebar backdrop-blur-xl"
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full shrink-0 transition-[width] duration-200",
          window.electronAPI.windowState.isMacOS && !isFullScreen
            ? "w-24 border-r"
            : "w-0",
        )}
      />
      <div className="flex items-center gap-2 px-4 text-sm font-medium">
        <Box size={16} />
        <span>
          Gorth <span className="text-muted-foreground">Launcher</span>
        </span>
      </div>
      {!window.electronAPI.windowState.isMacOS && (
        <div className="ml-auto w-36 shrink-0 bg-slate-700" />
      )}
    </header>
  );
}
