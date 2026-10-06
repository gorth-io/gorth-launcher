import { useState } from "react";
import { Copy, Eraser, FileDown, Square, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { useGame } from "@/hooks/use-game";
import type { Instance } from "@/lib/utils/interface";
import { gamePhaseLabels } from "@/lib/utils/constant";

export function ConsolePage({
  game,
  instances,
  run,
  exportLog,
}: ReturnType<typeof useGame> & { instances: Instance[] }) {
  const [id, setId] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [cleared, setCleared] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const job = game.jobs.find((item) => item.instanceId === id) ?? game.jobs[0];
  const marker = cleared[job?.instanceId ?? ""];
  const logs = (job?.logs ?? [])
    .slice(marker === undefined ? 0 : (job?.logs.lastIndexOf(marker) ?? -1) + 1)
    .filter(
      (line) =>
        line.toLowerCase().includes(query.toLowerCase()) &&
        (level === "all" || line.toLowerCase().includes(level)),
    );
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Game logs, launch output, and process status.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Instance console"
          value={job?.instanceId ?? ""}
          onChange={(event) => {
            setId(event.target.value);
            setMessage("");
          }}
        >
          {!game.jobs.length && (
            <NativeSelectOption value="">Chưa có phiên game</NativeSelectOption>
          )}
          {game.jobs.map((item) => (
            <NativeSelectOption key={item.instanceId} value={item.instanceId}>
              {instances.find((instance) => instance.id === item.instanceId)
                ?.name ?? item.instanceId}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="flex-1 text-sm">
          {job ? gamePhaseLabels[job.phase] : "Chưa chạy"}
        </span>
        <Button
          className="h-9"
          variant="outline"
          disabled={!logs.length}
          onClick={() =>
            void navigator.clipboard.writeText(logs.join("\n")).then(
              () => setMessage("Đã sao chép log."),
              () => setMessage("Không sao chép được log."),
            )
          }
        >
          <Copy />
          Copy
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={!job}
          onClick={() => {
            if (job?.logs.length)
              setCleared({
                ...cleared,
                [job.instanceId]: job.logs[job.logs.length - 1],
              });
          }}
        >
          <Eraser />
          Clear
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={!job}
          onClick={() => {
            if (job) void exportLog(job.instanceId);
          }}
        >
          <FileDown />
          Export
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={
            !job ||
            ![
              "queued",
              "paused",
              "checking",
              "downloading",
              "starting",
              "running",
            ].includes(job.phase)
          }
          onClick={() => {
            if (job)
              void run({
                action: job.phase === "running" ? "stop" : "cancel",
                id: job.instanceId,
              });
          }}
        >
          <Square />
          Stop
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          className="h-9 flex-1"
          aria-label="Tìm log"
          placeholder="Tìm trong console…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <NativeSelect
          aria-label="Mức log"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
        >
          {["all", "info", "warn", "error", "debug"].map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {job?.crashHint && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {job.crashHint}
        </p>
      )}
      <Card>
        <CardContent className="p-4">
          <pre className="h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
            {logs.length ? logs.join("\n") : "Chưa có log phù hợp."}
          </pre>
        </CardContent>
      </Card>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Terminal className="size-4" />
        Console giữ 1.000 dòng gần nhất. Clear chỉ ẩn log trong giao diện;
        Export xuất buffer gốc.
      </p>
    </section>
  );
}
