import { useEffect, useState } from "react";
import {
  Archive,
  Camera,
  Download,
  FileText,
  FolderOpen,
  Import,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { Instance } from "@/lib/utils/interface";
import type {
  InstanceDataCommand,
  InstanceDataSnapshot,
} from "@/lib/instance/interface";

const bytes = (value: number) =>
  value < 1024
    ? `${value} B`
    : value < 1024 ** 2
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 ** 2).toFixed(1)} MB`;
export function InstanceDataPage({
  instances,
  busy,
  onChanged,
}: {
  instances: Instance[];
  busy: boolean;
  onChanged: () => void;
}) {
  const [id, setId] = useState(instances[0]?.id ?? ""),
    [data, setData] = useState<InstanceDataSnapshot | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [log, setLog] = useState(""),
    [serverName, setServerName] = useState(""),
    [serverAddress, setServerAddress] = useState("");
  const load = async (next = id) => {
    if (!next) {
      setData(null);
      return;
    }
    setWorking(true);
    const result = await window.electronAPI.instanceData.snapshot(next);
    setWorking(false);
    if (result.ok && result.data) {
      setData(result.data);
      setError("");
    } else setError(result.error ?? "Không đọc được dữ liệu.");
  };
  useEffect(() => {
    if (!instances.some((x) => x.id === id)) setId(instances[0]?.id ?? "");
  }, [instances, id]);
  useEffect(() => {
    void load(id);
  }, [id]);
  const run = async (command: InstanceDataCommand, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setWorking(true);
    const result = await window.electronAPI.instanceData.command(command);
    setWorking(false);
    if (result.ok && result.data) {
      setData(result.data.snapshot);
      if (result.data.content !== undefined) setLog(result.data.content);
      setError("");
    } else setError(result.error ?? "Thao tác thất bại.");
  };
  const transfer = async (kind: "import" | "export") => {
    setWorking(true);
    const result =
      kind === "import"
        ? await window.electronAPI.instanceData.import()
        : await window.electronAPI.instanceData.export(id);
    setWorking(false);
    if (!result.ok) setError(result.error ?? "Thao tác thất bại.");
    else if (result.data) {
      setError(
        kind === "export" ? `Đã xuất: ${result.data}` : "Đã import instance.",
      );
      onChanged();
      await load();
    }
  };
  const disabled = busy || working;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          className="min-w-72 flex-1"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <NativeSelectOption value="" disabled>
            Chọn instance
          </NativeSelectOption>
          {instances.map((x) => (
            <NativeSelectOption key={x.id} value={x.id}>
              {x.name} · {x.version}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          className="h-9"
          variant="outline"
          disabled={disabled || !id}
          onClick={() => void load()}
        >
          <RefreshCw />
          Làm mới
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={disabled}
          onClick={() => void transfer("import")}
        >
          <Import />
          Import Prism / MultiMC / FTB
        </Button>
        <Button
          className="h-9"
          disabled={disabled || !id}
          onClick={() => void transfer("export")}
        >
          <Download />
          Xuất instance / modpack
        </Button>
      </div>
      {error && (
        <p
          role="status"
          className={
            error.startsWith("Đã ") ? "text-sm" : "text-sm text-destructive"
          }
        >
          {error}
        </p>
      )}
      {!data ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {instances.length
              ? "Đang đọc dữ liệu…"
              : "Hãy tạo hoặc import một instance."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ghi chú instance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="min-h-28"
                value={data.notes}
                maxLength={100000}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
              />
              <Button
                className="h-9"
                disabled={disabled}
                onClick={() =>
                  void run({
                    action: "notes.save",
                    instanceId: id,
                    notes: data.notes,
                  })
                }
              >
                <Save />
                Lưu ghi chú
              </Button>
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive />
                  World & backup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.worlds.length && (
                  <p className="text-sm text-muted-foreground">
                    Chưa có world.
                  </p>
                )}
                {data.worlds.map((world) => (
                  <div
                    key={world.name}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{world.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bytes(world.size)} ·{" "}
                          {new Date(world.modifiedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="h-9"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() =>
                            void run({
                              action: "world.backup",
                              instanceId: id,
                              world: world.name,
                            })
                          }
                        >
                          <Archive />
                          Backup
                        </Button>
                        <Button
                          className="h-9"
                          size="icon"
                          variant="destructive"
                          disabled={disabled}
                          aria-label="Xóa world"
                          onClick={() =>
                            void run(
                              {
                                action: "world.delete",
                                instanceId: id,
                                world: world.name,
                              },
                              `Xóa world “${world.name}”? Hãy backup trước nếu cần.`,
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    {world.backups.map((backup) => (
                      <div
                        key={backup.name}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">
                          {backup.name} · {bytes(backup.size)}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            className="h-9"
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            onClick={() =>
                              void run(
                                {
                                  action: "world.restore",
                                  instanceId: id,
                                  world: world.name,
                                  backup: backup.name,
                                },
                                `Khôi phục “${world.name}” từ backup này? Bản hiện tại sẽ được backup tự động.`,
                              )
                            }
                          >
                            <RotateCcw />
                            Khôi phục
                          </Button>
                          <Button
                            className="h-9"
                            size="icon"
                            variant="ghost"
                            disabled={disabled}
                            aria-label="Xóa backup"
                            onClick={() =>
                              void run(
                                {
                                  action: "backup.delete",
                                  instanceId: id,
                                  world: world.name,
                                  backup: backup.name,
                                },
                                "Xóa backup này?",
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server />
                  Server list
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    className="h-9"
                    placeholder="Tên server"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                  />
                  <Input
                    className="h-9"
                    placeholder="play.example.net"
                    value={serverAddress}
                    onChange={(e) => setServerAddress(e.target.value)}
                  />
                  <Button
                    className="h-9"
                    disabled={
                      disabled || !serverName.trim() || !serverAddress.trim()
                    }
                    onClick={async () => {
                      await run({
                        action: "server.save",
                        instanceId: id,
                        index: null,
                        server: { name: serverName, address: serverAddress },
                      });
                      setServerName("");
                      setServerAddress("");
                    }}
                  >
                    Thêm
                  </Button>
                </div>
                {data.servers.map((item, index) => (
                  <div
                    className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    key={`${item.address}-${index}`}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.address}
                      </p>
                    </div>
                    <Button
                      className="h-9"
                      size="icon"
                      variant="ghost"
                      disabled={disabled}
                      aria-label="Xóa server"
                      onClick={() =>
                        void run({
                          action: "server.delete",
                          instanceId: id,
                          index,
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera />
                  Screenshots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!data.screenshots.length && (
                  <p className="text-sm text-muted-foreground">
                    Chưa có screenshot.
                  </p>
                )}
                {data.screenshots.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {item.name} · {bytes(item.size)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        className="h-9"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run({
                            action: "screenshot.open",
                            instanceId: id,
                            name: item.name,
                          })
                        }
                      >
                        <FolderOpen />
                        Mở
                      </Button>
                      <Button
                        className="h-9"
                        size="icon"
                        variant="ghost"
                        aria-label="Xóa screenshot"
                        disabled={disabled}
                        onClick={() =>
                          void run(
                            {
                              action: "screenshot.delete",
                              instanceId: id,
                              name: item.name,
                            },
                            "Xóa screenshot này?",
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText />
                  Minecraft logs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-48 space-y-1 overflow-auto">
                  {data.logs.map((item) => (
                    <Button
                      key={`${item.kind}-${item.name}`}
                      className="h-9 w-full justify-start"
                      variant="ghost"
                      onClick={() =>
                        void run({
                          action: "log.read",
                          instanceId: id,
                          kind: item.kind,
                          name: item.name,
                        })
                      }
                    >
                      {item.kind === "crash" ? "Crash" : "Log"} · {item.name}
                    </Button>
                  ))}
                </div>
                {log && (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                    {log}
                  </pre>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
