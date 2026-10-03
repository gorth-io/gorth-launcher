import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  PopoverMenu,
  PopoverMenuItem,
  PopoverMenuLabel,
  PopoverMenuSeparator,
} from "@/components/element/popover-menu";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";

const themeLabels: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <PopoverMenu
      ariaLabel="Change theme"
      className="border bg-background px-3 text-sm font-medium shadow-xs"
      contentClassName="w-[180px]"
      icon={<Icon className="size-4" />}
      label={<span className="hidden sm:inline">{themeLabels[theme]}</span>}
      title="Change theme"
    >
      {(close) => (
        <>
          <PopoverMenuLabel>Theme</PopoverMenuLabel>
          <PopoverMenuSeparator />
          <PopoverMenuItem
            onClick={() => {
              setTheme("light");
              close();
            }}
          >
            <Sun /> Light
          </PopoverMenuItem>
          <PopoverMenuItem
            onClick={() => {
              setTheme("dark");
              close();
            }}
          >
            <Moon /> Dark
          </PopoverMenuItem>
          <PopoverMenuItem
            onClick={() => {
              setTheme("system");
              close();
            }}
          >
            <Monitor /> System
          </PopoverMenuItem>
        </>
      )}
    </PopoverMenu>
  );
}

export { ThemeToggle };
