import { useState } from "react";
import { Clock, Cpu, Play, Plus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import type { LauncherInfo } from "@/preload/interface";
import type {
  AccountView,
  GameSnapshot,
  GameVersion,
  Instance,
} from "@/lib/utils/interface";
import background from "@/assets/dawn/background1.png";

interface HomePageProps {
  instances: Instance[];
  game: GameSnapshot;
  versions: GameVersion[];
  accounts: AccountView[];
  accountId: string | null;
  info: LauncherInfo | null;
  onCreate: () => void;
  onVersionCreate: (version: string) => void;
  onOpenLibrary: () => void;
  onSelect: (item: Instance) => void;
  onPlay: (item: Instance) => void;
  onStop: (id: string) => void;
  onAccount: (id: string) => void;
  statusLabel: (id: string) => string;
}
export function HomePage({
  instances,
  game,
  versions,
  accounts,
  accountId,
  info,
  onCreate,
  onVersionCreate,
  onOpenLibrary,
  onSelect,
  onPlay,
  onStop,
  onAccount,
  statusLabel,
}: HomePageProps) {
  const [id, setId] = useState("");
  const selected = instances.find((item) => item.id === id) ?? instances[0];
  const account = accounts.find((item) => item.id === accountId);
  const running = !!selected && game.activeIds.includes(selected.id);
  const job = game.jobs.find((item) => item.instanceId === selected?.id);
  const busy =
    !!job &&
    [
      "queued",
      "paused",
      "checking",
      "downloading",
      "starting",
      "stopping",
    ].includes(job.phase);
  const total = game.history.reduce(
    (sum, session) => sum + session.duration,
    0,
  );
  const recent = [...game.history]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 4);
  const lastPlayed = new Map<string, number>();
  for (const session of game.history)
    lastPlayed.set(
      session.instanceId,
      Math.max(lastPlayed.get(session.instanceId) ?? 0, session.startedAt),
    );
  const recentInstances = instances
    .filter((item) => lastPlayed.has(item.id))
    .sort((a, b) => lastPlayed.get(b.id)! - lastPlayed.get(a.id)!);
  const aside = (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Download</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            {game.queue.length} trong hàng đợi · {game.activeIds.length} game
            đang chạy
          </p>
          <p className="text-sm text-muted-foreground">
            {game.jobs.find((item) => item.instanceId === game.downloadingId)
              ?.message ?? "Không có tải xuống đang chạy."}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-medium">
            {account?.username ?? "Chưa chọn tài khoản game"}
          </p>
          <p className="text-sm text-muted-foreground">
            {account?.provider ?? "Thêm hồ sơ trong Accounts."}
          </p>
          <NativeSelect
            aria-label="Tài khoản game trang chủ"
            value={accountId ?? ""}
            disabled={!accounts.length}
            onChange={(event) => onAccount(event.target.value)}
          >
            <NativeSelectOption value="" disabled>
              Chọn tài khoản
            </NativeSelectOption>
            {accounts.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.username}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Instances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {instances.slice(0, 6).map((item) => (
            <Button
              key={item.id}
              className="h-9 w-full justify-between"
              variant={selected?.id === item.id ? "secondary" : "ghost"}
              onClick={() => setId(item.id)}
            >
              <span className="truncate">{item.name}</span>
              <span>{item.version}</span>
            </Button>
          ))}
          <Button className="h-9 w-full" variant="outline" onClick={onCreate}>
            <Plus />
            New Instance
          </Button>
        </CardContent>
      </Card>
    </>
  );
  return (
    <PageShell aside={aside}>
      <PageBanner
        title={selected?.name ?? "Gorth Launcher"}
        description={
          selected
            ? `Minecraft ${selected.version} · ${selected.loader} · ${statusLabel(selected.id)}`
            : "Chọn hoặc tạo instance để bắt đầu."
        }
        image={background}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-9"
            disabled={!selected || busy || (!running && !account)}
            onClick={() => {
              if (selected) {
                if (running) onStop(selected.id);
                else onPlay(selected);
              }
            }}
          >
            {running ? <Square /> : <Play />}
            {busy ? "Đang chuẩn bị…" : running ? "Stop" : "Play"}
          </Button>
          <NativeSelect
            aria-label="Instance trang chủ"
            value={selected?.id ?? ""}
            disabled={!instances.length}
            onChange={(event) => setId(event.target.value)}
          >
            {!instances.length && (
              <NativeSelectOption value="">Chưa có instance</NativeSelectOption>
            )}
            {instances.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button className="h-9" variant="outline" onClick={onOpenLibrary}>
            Manage Instances
          </Button>
        </div>
      </PageBanner>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Total Launches", String(game.history.length)],
          ["Total Play Time", `${Math.floor(total / 60_000)} phút`],
          ["Instances", String(instances.length)],
          ["System Memory", info ? `${info.memoryGB} GB` : "—"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="space-y-2 pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((session) => (
              <div key={session.id} className="flex items-center gap-3">
                <Clock className="size-4" />
                <div>
                  <p className="text-sm font-medium">
                    {instances.find((item) => item.id === session.instanceId)
                      ?.name ?? session.instanceId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.startedAt).toLocaleString()} ·{" "}
                    {Math.floor(session.duration / 60_000)} phút
                  </p>
                </div>
              </div>
            ))}
            {!recent.length && (
              <p className="text-sm text-muted-foreground">
                Chưa có phiên chơi.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Cpu className="size-5" />
            <p className="text-sm">
              Eclipse Temurin được chọn theo phiên bản Minecraft.
            </p>
            <p className="text-xs text-muted-foreground">
              Minecraft 1.20.1 dùng Java 17; các bản khác dùng runtime phù hợp
              metadata.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Last Played Profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentInstances.slice(0, 6).map((item) => (
            <Button
              key={item.id}
              className="h-9 w-full justify-between"
              variant="ghost"
              onClick={() => onSelect(item)}
            >
              <span className="truncate">{item.name}</span>
              <span>
                {item.version} · {item.loader}
              </span>
            </Button>
          ))}
          {!recentInstances.length && (
            <p className="text-sm text-muted-foreground">
              Chưa có instance đã chơi.
            </p>
          )}
          {!instances.length && (
            <Button className="h-9" variant="outline" onClick={onCreate}>
              <Plus />
              Create Instance
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Release Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions
            .filter((version) => version.type === "release")
            .slice(0, 20)
            .map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm">Minecraft {version.id}</span>
                <Button
                  className="h-9"
                  variant="outline"
                  onClick={() => onVersionCreate(version.id)}
                >
                  <Plus /> Create Instance
                </Button>
              </div>
            ))}
          {!versions.length && (
            <p className="text-sm text-muted-foreground">
              Danh sách phiên bản chưa tải. Bạn vẫn có thể tạo instance trong
              Library.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            20 bản release gần nhất. Chọn New Instance để xem toàn bộ phiên bản
            được hỗ trợ.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
