import { ArrowRight, Box, Download, Layers, Monitor, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  InstanceCards,
  type InstanceCardsProps,
} from "@/components/element/instance-cards";
import type { LauncherInfo } from "@/preload/interface";
import type { Instance } from "@/lib/launcher";
interface HomePageProps extends Pick<
  InstanceCardsProps,
  "onSelect" | "statusLabel"
> {
  instances: Instance[];
  hasActiveJob: boolean;
  info: LauncherInfo | null;
  onCreate: () => void;
  onOpenLibrary: () => void;
}
export function HomePage({
  instances,
  hasActiveJob,
  info,
  onCreate,
  onOpenLibrary,
  onSelect,
  statusLabel,
}: HomePageProps) {
  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Bắt đầu với Minecraft</CardTitle>
          <CardDescription>
            Tạo và quản lý các cấu hình Minecraft độc lập trên thiết bị của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="h-9" onClick={() => onCreate()}>
            <Plus />
            Tạo instance mới
          </Button>
        </CardContent>
      </Card>
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-4 rounded-xl border p-5 [&>svg]:size-5 [&>svg]:text-muted-foreground [&_strong]:block [&_strong]:text-xl [&_span]:text-xs [&_span]:text-muted-foreground">
          <Layers />
          <div>
            <strong>{instances.length}</strong>
            <span>Instance trong thư viện</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border p-5 [&>svg]:size-5 [&>svg]:text-muted-foreground [&_strong]:block [&_strong]:text-xl [&_span]:text-xs [&_span]:text-muted-foreground">
          <Download />
          <div>
            <strong>{hasActiveJob ? 1 : 0}</strong>
            <span>Tác vụ game đang chạy</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border p-5 [&>svg]:size-5 [&>svg]:text-muted-foreground [&_strong]:block [&_strong]:text-xl [&_span]:text-xs [&_span]:text-muted-foreground">
          <Monitor />
          <div>
            <strong>{info ? info.memoryGB + " GB" : "—"}</strong>
            <span>Bộ nhớ hệ thống</span>
          </div>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between [&_h2]:font-semibold [&_p]:text-sm [&_p]:text-muted-foreground">
        <div>
          <h2>Thư viện của bạn</h2>
          <p>Sẵn sàng cho hành trình tiếp theo.</p>
        </div>
        <Button variant="ghost" className="h-9" onClick={() => onOpenLibrary()}>
          Xem tất cả
          <ArrowRight size={16} />
        </Button>
      </div>
      {instances.length ? (
        <InstanceCards
          items={instances.slice(-3).reverse()}
          onSelect={onSelect}
          statusLabel={statusLabel}
        />
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center [&_h3]:font-semibold [&_p]:max-w-md [&_p]:text-sm [&_p]:text-muted-foreground">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&>svg]:size-5">
            <Box />
          </span>
          <h3>Một khởi đầu mới</h3>
          <p>
            Tạo instance đầu tiên để lưu phiên bản Minecraft và mod loader của
            bạn.
          </p>
          <Button variant="outline" className="h-9" onClick={() => onCreate()}>
            <Plus size={16} />
            Tạo instance đầu tiên
          </Button>
        </div>
      )}
    </>
  );
}
