import { useState } from "react";
import {
  Download,
  FileDown,
  FolderOpen,
  Pause,
  Play,
  Search,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { useGame } from "@/hooks/use-game";
import { gamePhaseLabels } from "@/lib/utils/constant";
import type { Instance } from "@/lib/utils/interface";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRemainingTime,
  formatTransferRate,
} from "@/lib/utils/formatter";
export function DownloadsPage({
  game,
  run,
  openDirectory,
  exportLog,
  instances,
}: ReturnType<typeof useGame> & { instances: Instance[] }) {
  const [query, setQuery] = useState(""),
    [level, setLevel] = useState("all");
  const name = (id: string) =>
    instances.find((item) => item.id === id)?.name ?? id;
  const totalTime = game.history.reduce((sum, item) => sum + item.duration, 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Hàng đợi tải, các process Minecraft, console và lịch sử chơi.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <p className="min-w-0 flex-1 break-all text-sm text-muted-foreground">
          {game.directory}
        </p>
        <span className="text-sm">
          {game.activeIds.length} game đang chạy · {game.queue.length} chờ ·{" "}
          {formatDuration(totalTime)} tổng
        </span>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => void openDirectory()}
        >
          <FolderOpen />
          Mở thư mục Minecraft
        </Button>
      </div>
      {!game.jobs.length && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Download className="size-6 text-muted-foreground" />
            <h2 className="font-semibold">Chưa có tác vụ</h2>
            <p className="text-sm text-muted-foreground">
              Chọn Tải game hoặc Chơi Minecraft trong thư viện.
            </p>
          </CardContent>
        </Card>
      )}
      {game.jobs.map((job) => {
        const visibleLogs = job.logs.filter(
          (line) =>
            line.toLowerCase().includes(query.toLowerCase()) &&
            (level === "all" || line.toLowerCase().includes(level)),
        );
        const busy = [
          "queued",
          "checking",
          "downloading",
          "paused",
          "starting",
          "running",
          "stopping",
        ].includes(job.phase);
        return (
          <Card key={job.instanceId}>
            <CardHeader>
              <CardTitle>{name(job.instanceId)}</CardTitle>
              <CardDescription>
                Minecraft {job.version} · {gamePhaseLabels[job.phase]}
                {job.queuePosition ? ` · vị trí ${job.queuePosition}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => void openDirectory(job.instanceId)}
                >
                  <FolderOpen />
                  Mở thư mục
                </Button>
                {busy && (
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={job.phase === "stopping"}
                    onClick={() =>
                      void run({
                        action: job.phase === "running" ? "stop" : "cancel",
                        id: job.instanceId,
                      })
                    }
                  >
                    {job.phase === "running" ? <Square /> : <X />}
                    {job.phase === "running" ? "Dừng game" : "Hủy"}
                  </Button>
                )}
                {["queued", "checking", "downloading"].includes(job.phase) && (
                  <Button
                    variant="outline"
                    className="h-9"
                    onClick={() =>
                      void run({ action: "pause", id: job.instanceId })
                    }
                  >
                    <Pause />
                    Tạm dừng
                  </Button>
                )}
                {job.phase === "paused" && (
                  <Button
                    className="h-9"
                    onClick={() =>
                      void run({ action: "resume", id: job.instanceId })
                    }
                  >
                    <Play />
                    Tiếp tục
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={!job.logs.length}
                  onClick={() => void exportLog(job.instanceId)}
                >
                  <FileDown />
                  Xuất console
                </Button>
              </div>
              <p
                role="status"
                className={
                  ["error", "crashed"].includes(job.phase)
                    ? "text-sm text-destructive"
                    : "text-sm"
                }
              >
                {job.message}
              </p>
              {job.crashHint && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  Gợi ý: {job.crashHint}
                </p>
              )}
              {job.total > 0 && (
                <div className="space-y-1">
                  <progress
                    className="h-2 w-full accent-primary"
                    max={job.total}
                    value={job.completed}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(job.completed)} / {formatNumber(job.total)}{" "}
                    file · {formatTransferRate(job.speed)}
                    {job.eta
                      ? ` · còn khoảng ${formatRemainingTime(job.eta)}`
                      : ""}
                  </p>
                </div>
              )}
              {job.logs.length > 0 && (
                <details open={["error", "crashed"].includes(job.phase)}>
                  <summary className="cursor-pointer text-sm">
                    Console ({job.logs.length} dòng)
                  </summary>
                  <div className="mt-3 flex gap-2">
                    <label className="flex flex-1 items-center gap-2">
                      <Search className="size-4" />
                      <Input
                        className="h-9"
                        placeholder="Tìm trong console…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={level}
                      onChange={(event) => setLevel(event.target.value)}
                    >
                      <option value="all">Tất cả</option>
                      <option value="error">ERROR</option>
                      <option value="warn">WARN</option>
                      <option value="info">INFO</option>
                    </select>
                  </div>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                    {visibleLogs.join("\n")}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        );
      })}
      {game.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử chơi</CardTitle>
            <CardDescription>
              {game.history.length} phiên · tổng {formatDuration(totalTime)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...game.history]
              .reverse()
              .slice(0, 50)
              .map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
                >
                  <span>
                    {name(session.instanceId)} ·{" "}
                    {formatDateTime(session.startedAt)}
                  </span>
                  <span
                    className={
                      session.crashed
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {formatDuration(session.duration)}
                    {session.crashed ? " · crash" : ""}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
