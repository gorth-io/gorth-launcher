import { useCallback, useEffect, useState } from "react";
import { Camera, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageBanner } from "@/components/element/page-banner";
import { formatDateTime } from "@/lib/utils/formatter";
import type { Instance } from "@/lib/utils/interface";
import type { InstanceFileEntry } from "@/lib/instance/interface";
import background from "@/assets/dawn/background2.png";

function ScreenshotCard({
  shot,
  instanceId,
}: {
  shot: InstanceFileEntry;
  instanceId: string;
}) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void window.electronAPI.instanceData
      .command({ action: "screenshot.preview", instanceId, name: shot.name })
      .then((result) => {
        if (!live) return;
        if (result.ok && result.data?.content) setPreview(result.data.content);
        else setError(result.error ?? "Không đọc được ảnh.");
      })
      .catch(() => {
        if (live) setError("Không tải được ảnh.");
      });
    return () => {
      live = false;
    };
  }, [instanceId, shot.name, shot.modifiedAt]);
  return (
    <Card className="overflow-hidden py-0">
      {preview ? (
        <img
          src={preview}
          alt={shot.name}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted text-sm">
          {error || "Đang tải ảnh…"}
        </div>
      )}
      <CardContent className="space-y-2 py-3">
        <p className="truncate text-sm font-medium">{shot.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(shot.modifiedAt)}
        </p>
        <Button
          className="h-9"
          variant="outline"
          onClick={() =>
            void window.electronAPI.instanceData
              .command({
                action: "screenshot.reveal",
                instanceId,
                name: shot.name,
              })
              .then((result) => {
                if (!result.ok) setError(result.error ?? "Không mở được ảnh.");
              })
              .catch(() => setError("Không mở được ảnh."))
          }
        >
          <FolderOpen />
          Hiện trong thư mục
        </Button>
        {preview && error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function GalleryPage({
  instances,
  onOpenDirectory,
}: {
  instances: Instance[];
  onOpenDirectory: (id?: string) => Promise<void>;
}) {
  const [id, setId] = useState("");
  const selected = instances.find((item) => item.id === id) ?? instances[0];
  const instanceId = selected?.id;
  const [shots, setShots] = useState<InstanceFileEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    let live = true;
    setShots([]);
    setError("");
    if (!instanceId) return;
    setLoading(true);
    void window.electronAPI.instanceData
      .snapshot(instanceId)
      .then((result) => {
        if (!live) return;
        if (result.ok && result.data) setShots(result.data.screenshots);
        else setError(result.error ?? "Không đọc được screenshot.");
      })
      .catch(() => {
        if (live) setError("Không kết nối được dịch vụ ảnh.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [instanceId, refreshToken]);
  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);
  const visible = shots.filter((shot) =>
    shot.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="space-y-4">
      <PageBanner
        title="Gallery"
        description={
          selected
            ? `Screenshots của ${selected.name} — nhấn F2 trong game để chụp.`
            : "Chọn instance để xem screenshot."
        }
        image={background}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-9"
            variant="outline"
            disabled={loading || !selected}
            onClick={refresh}
          >
            <RefreshCw />
            Refresh
          </Button>
          <Button
            className="h-9"
            variant="outline"
            disabled={!selected}
            onClick={() => {
              if (selected) void onOpenDirectory(selected.id);
            }}
          >
            <FolderOpen />
            Mở thư mục instance
          </Button>
        </div>
      </PageBanner>
      <div className="flex gap-2">
        <NativeSelect
          aria-label="Instance gallery"
          value={instanceId ?? ""}
          onChange={(event) => setId(event.target.value)}
        >
          {!instances.length && (
            <NativeSelectOption value="">Chưa có instance</NativeSelectOption>
          )}
          {instances.map((instance) => (
            <NativeSelectOption key={instance.id} value={instance.id}>
              {instance.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          className="h-9 flex-1"
          aria-label="Tìm screenshot"
          placeholder="Tìm screenshot…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.slice(0, 60).map((shot) => (
          <ScreenshotCard
            key={`${instanceId}:${shot.name}`}
            shot={shot}
            instanceId={instanceId!}
          />
        ))}
      </div>
      {visible.length > 60 && (
        <p className="text-sm text-muted-foreground">
          Hiển thị 60 ảnh đầu tiên; tìm theo tên để xem ảnh khác.
        </p>
      )}
      {!visible.length && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Camera className="size-8 text-muted-foreground" />
            <p>{loading ? "Đang đọc ảnh…" : "Không tìm thấy screenshot"}</p>
            <p className="text-sm text-muted-foreground">
              Nhấn F2 khi chơi Minecraft để chụp ảnh.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
