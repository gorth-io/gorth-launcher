import type { Dispatch, SetStateAction } from "react";
import { ToastSettings } from "@/components/element/toast-settings";
import { Box, Check, Folder, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Settings } from "@/lib/utils/interface";
import { defaultSettings } from "@/lib/utils/launcher";
import { saveTheme, type Theme } from "@/lib/theme";
import type { LauncherInfo } from "@/preload/interface";
interface SettingsPageProps {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  info: LauncherInfo | null;
  setNotice: (message: string) => void;
}
export function SettingsPage({
  settings,
  setSettings,
  theme,
  setTheme,
  info,
  setNotice,
}: SettingsPageProps) {
  const maxMemory = Math.max(1, Math.min(64, (info?.memoryGB ?? 16) - 2));
  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        Tùy chỉnh không gian và cấu hình mặc định cho instance mới.
      </p>
      <section className="mb-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4 [&>h2]:text-sm [&>h2]:font-semibold">
          <h2>Giao diện</h2>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <Check size={12} />
            Tự động lưu
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground">
          <div>
            <strong>Chủ đề</strong>
            <p>Chọn giao diện phù hợp với bạn.</p>
          </div>
          <div className="flex items-center gap-2">
            {(
              [
                { value: "light", label: "Sáng", icon: Sun },
                { value: "dark", label: "Tối", icon: Moon },
                {
                  value: "system",
                  label: "Hệ thống",
                  icon: Monitor,
                },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                className="h-9"
                aria-pressed={theme === value}
                onClick={() => {
                  try {
                    saveTheme(value);
                    setTheme(value);
                  } catch {
                    setNotice("Không thể lưu chủ đề.");
                  }
                }}
              >
                <Icon size={17} />
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="p-6">
          <ToastSettings />
        </div>
      </section>
      <section className="mb-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4 [&>h2]:text-sm [&>h2]:font-semibold">
          <h2>Eclipse Temurin phù hợp phiên bản game & bộ nhớ</h2>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            Runtime Java 17
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground">
          <div>
            <label htmlFor="memory">
              <strong>Bộ nhớ tối đa</strong>
            </label>
            <p>Chừa bộ nhớ cho hệ điều hành và launcher.</p>
          </div>
          <div className="flex items-center gap-4 [&_input]:w-40 [&_input]:accent-primary [&_output]:w-12 [&_output]:text-sm">
            <Input
              id="memory"
              type="range"
              min={1}
              max={maxMemory}
              value={Math.min(settings.memory, maxMemory)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  memory: Number(event.target.value),
                })
              }
            />
            <output htmlFor="memory">
              {Math.min(settings.memory, maxMemory)} GB
            </output>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_code]:break-all [&_code]:text-xs [&_code]:text-muted-foreground">
          <div>
            <label htmlFor="java-path">
              <strong>Đường dẫn Java</strong>
            </label>
            <p>
              Để trống để tự tìm hoặc tải Eclipse Temurin phù hợp phiên bản
              game.
            </p>
          </div>
          <div className="flex items-center gap-2 [&>input]:h-9 [&>input]:flex-1">
            <Input
              id="java-path"
              placeholder="Tự động tìm / tải Eclipse Temurin phù hợp phiên bản game"
              value={settings.javaPath}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  javaPath: event.target.value,
                })
              }
            />
            <Button
              variant="outline"
              className="h-9"
              onClick={() => {
                window.electronAPI.launcher
                  .chooseJava()
                  .then((javaPath) => {
                    if (javaPath)
                      setSettings((current) => ({
                        ...current,
                        javaPath,
                      }));
                  })
                  .catch(() => setNotice("Không thể mở hộp thoại chọn Java."));
              }}
            >
              <Folder size={16} />
              Duyệt…
            </Button>
          </div>
        </div>
      </section>
      <section className="mb-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4 [&>h2]:text-sm [&>h2]:font-semibold">
          <h2>Về launcher</h2>
          <Box size={18} />
        </div>
        <div className="flex items-center justify-between gap-6 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground">
          <div>
            <strong>Gorth Launcher</strong>
            <p>Minecraft Java Edition · Phiên bản {info?.version ?? "0.0.0"}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            {info?.platform ?? "Desktop"}
          </span>
        </div>
        <div className="flex flex-col gap-3 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_code]:break-all [&_code]:text-xs [&_code]:text-muted-foreground">
          <strong>Thư mục dữ liệu ứng dụng</strong>
          <code>{info?.dataPath ?? "Đang đọc…"}</code>
        </div>
      </section>
      <Button
        variant="ghost"
        className="h-9"
        onClick={() => {
          setSettings(defaultSettings);
          setNotice("Đã khôi phục cấu hình Java và bộ nhớ mặc định.");
        }}
      >
        Khôi phục cấu hình Java mặc định
      </Button>
    </>
  );
}
