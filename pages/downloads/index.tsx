import { Download, FolderOpen, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { useGame } from "@/hooks/use-game";
import { gamePhaseLabels } from "@/lib/utils/constant";
import type { Instance } from "@/lib/utils/interface";
import { formatNumber } from "@/lib/utils/formatter";
export function DownloadsPage({
  game,
  run,
  openDirectory,
  instances,
}: ReturnType<typeof useGame> & { instances: Instance[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tải Minecraft, mod loader và Eclipse Temurin và theo dõi phiên chơi.
      </p>
      <div className="space-y-2 rounded-lg border p-4">
        <p className="break-all text-sm text-muted-foreground">
          {game.directory}
        </p>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => void openDirectory()}
        >
          <FolderOpen /> Mở thư mục Minecraft
        </Button>
      </div>
      {!game.jobs.length && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Download className="size-6 text-muted-foreground" />
            <h2 className="font-semibold">Chưa có tác vụ tải xuống</h2>
            <p className="text-sm text-muted-foreground">
              Chọn Tải game hoặc Chơi Minecraft trong thư viện.
            </p>
          </CardContent>
        </Card>
      )}
      {game.jobs.map((job) => (
        <Card key={job.instanceId}>
          <CardHeader>
            <CardTitle>
              {instances.find((i) => i.id === job.instanceId)?.name ??
                job.version}
            </CardTitle>
            <CardDescription>
              Minecraft {job.version} · {gamePhaseLabels[job.phase]}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => void openDirectory(job.instanceId)}
            >
              <FolderOpen /> Mở thư mục instance
            </Button>
            <p
              role="status"
              className={
                job.phase === "error" ? "text-sm text-destructive" : "text-sm"
              }
            >
              {job.message}
            </p>
            {job.total > 0 && (
              <div className="space-y-1">
                <progress
                  className="h-2 w-full accent-primary"
                  max={job.total}
                  value={job.completed}
                  aria-label={"Tiến trình " + job.version}
                />
                <p className="text-xs text-muted-foreground">
                  {formatNumber(job.completed)} / {formatNumber(job.total)} file
                </p>
              </div>
            )}
            {game.activeId === job.instanceId && (
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
                {job.phase === "running" ? "Dừng game" : "Hủy tác vụ"}
              </Button>
            )}
            {job.logs.length > 0 && (
              <details open={job.phase === "error"}>
                <summary className="cursor-pointer text-sm">
                  Nhật ký Minecraft ({job.logs.length} dòng gần nhất)
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                  {job.logs.join("\n")}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
