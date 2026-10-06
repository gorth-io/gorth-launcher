import { useState, type Dispatch, type SetStateAction } from "react";
import { ToastSettings } from "@/components/element/toast-settings";
import { Box, Check, Folder, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type Settings, type PlaySession } from "@/lib/utils/interface";
import { defaultSettings } from "@/lib/utils/launcher";
import { saveTheme, type Theme } from "@/lib/theme";
import type { LauncherInfo } from "@/preload/interface";
interface SettingsPageProps {
  history?: PlaySession[];
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
  history = [],
}: SettingsPageProps) {
  const maxMemory = Math.max(1, Math.min(64, (info?.memoryGB ?? 16) - 2));
  const [section, setSection] = useState("appearance");
  return (
    <div className="grid items-start gap-5 lg:grid-cols-4">
      <nav aria-label="Launcher settings sections" className="space-y-2">
        {[
          ["appearance", "Appearance"],
          ["runtime", "Minecraft Runtime"],
          ["trash", "Trash"],
          ["history", "Launch History"],
          ["about", "About"],
        ].map(([id, label]) => (
          <Button
            key={id}
            className="h-9 w-full justify-start"
            variant={section === id ? "secondary" : "ghost"}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </Button>
        ))}
        <p className="text-xs text-muted-foreground">
          Cấu hình được tự động lưu.
        </p>
      </nav>
      <div className="min-w-0 lg:col-span-3">
        <p className="mb-6 text-sm text-muted-foreground">
          Tùy chỉnh không gian và cấu hình mặc định cho instance mới.
        </p>
        <section
          hidden={section !== "appearance"}
          className="mb-4 overflow-hidden rounded-xl border bg-card"
        >
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
          <div className="flex items-center justify-between gap-6 border-b p-6">
            <div>
              <label htmlFor="titlebar-logo" className="text-sm font-medium">
                Logo trên titlebar
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Hiển thị icon launcher trên thanh tiêu đề.
              </p>
            </div>
            <Switch
              id="titlebar-logo"
              checked={settings.showTitlebarLogo ?? true}
              onCheckedChange={(showTitlebarLogo) =>
                setSettings({ ...settings, showTitlebarLogo })
              }
            />
          </div>
          <div className="p-6">
            <ToastSettings />
          </div>
        </section>
        <section
          hidden={section !== "trash"}
          className="mb-4 overflow-hidden rounded-xl border bg-card"
        >
          <div className="border-b px-6 py-4">
            <h2 className="text-sm font-semibold">Tự động dọn Trash</h2>
          </div>
          <div className="flex items-center justify-between gap-6 border-b p-6">
            <div>
              <strong className="text-sm font-medium">Thời gian lưu</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                0 ngày để tắt tự động dọn, tối đa 365 ngày.
              </p>
            </div>
            <Input
              className="h-9 w-28"
              type="number"
              min={0}
              max={365}
              value={settings.trashRetentionDays ?? 30}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  trashRetentionDays: Math.max(
                    0,
                    Math.min(365, Number(event.target.value) || 0),
                  ),
                })
              }
            />
          </div>
          <label className="flex items-center justify-between gap-6 p-6 text-sm">
            <span>Giữ saves vào thư mục recovered-saves khi tự dọn</span>
            <input
              type="checkbox"
              checked={settings.keepSavesOnTrashCleanup ?? true}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  keepSavesOnTrashCleanup: event.target.checked,
                })
              }
            />
          </label>
        </section>
        <section
          hidden={section !== "runtime"}
          className="mb-4 overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 [&>h2]:text-sm [&>h2]:font-semibold">
            <h2>Eclipse Temurin phù hợp phiên bản game & bộ nhớ</h2>
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
              Runtime theo Minecraft
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
                    .catch(() =>
                      setNotice("Không thể mở hộp thoại chọn Java."),
                    );
                }}
              >
                <Folder size={16} />
                Duyệt…
              </Button>
            </div>
          </div>
        </section>
        <section
          hidden={section !== "about"}
          className="mb-4 overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 [&>h2]:text-sm [&>h2]:font-semibold">
            <h2>Về launcher</h2>
            <Box size={18} />
          </div>
          <div className="flex items-center justify-between gap-6 border-b p-6 last:border-0 [&_strong]:text-sm [&_strong]:font-medium [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground">
            <div>
              <strong>Gorth Launcher</strong>
              <p>
                Minecraft Java Edition · Phiên bản {info?.version ?? "0.0.0"}
              </p>
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
        {section === "runtime" && (
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
        )}
        {section === "history" && (
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">Launch History</h2>
            <p className="text-sm text-muted-foreground">
              {history.length} phiên ·{" "}
              {Math.floor(
                history.reduce((sum, item) => sum + item.duration, 0) / 60000,
              )}{" "}
              phút chơi
            </p>
            {[...history]
              .sort((a, b) => b.startedAt - a.startedAt)
              .slice(0, 50)
              .map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <p>{item.instanceId}</p>
                  <p className="text-muted-foreground">
                    {new Date(item.startedAt).toLocaleString()} ·{" "}
                    {Math.floor(item.duration / 60000)} phút ·{" "}
                    {item.crashed ? "Crash" : "Đã thoát"}
                  </p>
                </div>
              ))}
            {!history.length && <p className="text-sm">Chưa có phiên chơi.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
