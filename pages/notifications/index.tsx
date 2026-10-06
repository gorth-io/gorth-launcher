import { Bell, CheckCheck, Info, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { useNotifications } from "@/hooks/use-notifications";

export function NotificationsPage({
  items,
  unread,
  markRead,
  dismiss,
  clear,
}: ReturnType<typeof useNotifications>) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          {unread} thông báo chưa đọc · lưu trong phiên ứng dụng này.
        </p>
        <Button
          className="h-9"
          variant="outline"
          disabled={!unread}
          onClick={markRead}
        >
          <CheckCheck />
          Đánh dấu đã đọc
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={!items.length}
          onClick={clear}
        >
          <Trash2 />
          Xóa tất cả
        </Button>
      </div>
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="size-4" />
              <CardTitle className="flex-1">
                {item.title}
                {!item.read && " · Mới"}
              </CardTitle>
              <Button
                className="size-9"
                variant="ghost"
                size="icon"
                aria-label="Xóa thông báo"
                onClick={() => dismiss(item.id)}
              >
                <X />
              </Button>
            </div>
            <CardDescription>
              {new Date(item.time).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{item.body}</p>
          </CardContent>
        </Card>
      ))}
      {!items.length && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Bell className="size-8 text-muted-foreground" />
            <p>Không có thông báo</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
