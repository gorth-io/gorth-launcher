import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Instance } from "@/lib/utils/interface";
import type {
  ContentInventory,
  ContentManageAction,
} from "@/lib/content/interface";
import { contentLabels } from "@/lib/content/website";

const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

export function InstalledContentManager({
  instances,
  unavailable,
  kind,
}: {
  instances: Instance[];
  unavailable: boolean;
  kind?: import("@/lib/content/interface").ContentKind;
}) {
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [inventory, setInventory] = useState<ContentInventory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async (updates = false) => {
    if (!instanceId) return;
    setBusy(true);
    setError("");
    try {
      const result = updates
        ? await window.electronAPI.content.updates(instanceId)
        : await window.electronAPI.content.inventory(instanceId);
      if (!result.ok || !result.data)
        throw new Error(result.error ?? "Không đọc được nội dung đã cài.");
      setInventory(result.data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không đọc được nội dung.",
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!instances.some((item) => item.id === instanceId)) {
      setInstanceId(instances[0]?.id ?? "");
      setInventory(null);
    }
  }, [instanceId, instances]);
  const manage = async (id: string, action: ContentManageAction) => {
    if (!instanceId) return;
    setBusy(true);
    setError("");
    try {
      const result = await window.electronAPI.content.manage({
        action,
        instanceId,
        id,
      });
      if (!result.ok || !result.data)
        throw new Error(result.error ?? "Không thay đổi được nội dung.");
      setInventory(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-64 gap-1 text-sm">
          Quản lý nội dung của instance
          <select
            className={selectClass}
            value={instanceId}
            onChange={(event) => {
              setInstanceId(event.target.value);
              setInventory(null);
            }}
          >
            {!instances.length && <option value="">Chưa có instance</option>}
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.name} · {instance.loader} {instance.version}
              </option>
            ))}
          </select>
        </label>
        <Button
          className="h-9"
          variant="outline"
          disabled={!instanceId || busy || unavailable}
          onClick={() => void load(false)}
        >
          Tải danh sách
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={!instanceId || busy || unavailable}
          onClick={() => void load(true)}
        >
          <RefreshCw size={16} /> Kiểm tra cập nhật
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {inventory &&
        !inventory.items.some((item) => !kind || item.kind === kind) && (
          <p className="text-sm text-muted-foreground">
            Chưa tìm thấy mod, resource pack, shader hoặc data pack.
          </p>
        )}
      {inventory?.items
        .filter((item) => !kind || item.kind === kind)
        .map((item) => (
          <Card key={item.id} className="flex-row items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-sm">{item.filename}</strong>
                <Badge variant="outline">{contentLabels[item.kind]}</Badge>
                {!item.enabled && <Badge variant="secondary">Đã tắt</Badge>}
                {item.modified && (
                  <Badge variant="destructive">Đã sửa file</Badge>
                )}
                {item.update && <Badge>Có bản mới</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.managed
                  ? `${item.provider} · ${item.versionId}${item.worldName ? ` · ${item.worldName}` : ""}`
                  : "File ngoài launcher · không có metadata cập nhật"}
              </p>
            </div>
            {item.kind !== "modpack" && (
              <div className="flex shrink-0 gap-2">
                <Button
                  className="h-9"
                  size="sm"
                  variant="outline"
                  disabled={busy || unavailable}
                  onClick={() =>
                    void manage(item.id, item.enabled ? "disable" : "enable")
                  }
                >
                  {item.enabled ? "Tắt" : "Bật"}
                </Button>
                {item.managed && item.update && (
                  <Button
                    className="h-9"
                    size="sm"
                    disabled={busy || unavailable || item.modified}
                    onClick={() => void manage(item.id, "update")}
                  >
                    Cập nhật
                  </Button>
                )}
                <Button
                  className="h-9"
                  size="icon-sm"
                  variant="destructive"
                  disabled={busy || unavailable}
                  aria-label={`Xóa ${item.filename}`}
                  onClick={() => {
                    if (window.confirm(`Xóa ${item.filename}?`))
                      void manage(item.id, "remove");
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            )}
            {item.managed && item.kind === "modpack" && item.update && (
              <Button
                className="h-9 shrink-0"
                disabled={busy || unavailable}
                onClick={() => void manage(item.id, "update")}
              >
                Cập nhật pack
              </Button>
            )}
          </Card>
        ))}
    </section>
  );
}
