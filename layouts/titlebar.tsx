import { Box } from "lucide-react";
import { useFullScreen } from "@/hooks/use-full-screen";
import { cn } from "@/lib/utils";

interface TitlebarProps {
  showLogo: boolean;
}

export function Titlebar({ showLogo }: TitlebarProps) {
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
      <div className="flex items-center gap-2 p-2.5">
        {showLogo && <Box className="size-5 text-violet-500" />}
      </div>
      {!window.electronAPI.windowState.isMacOS && (
        <div className="ml-auto w-36 shrink-0 bg-slate-700" />
      )}
    </header>
  );
}
