import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LauncherInfo } from "@/preload/interface";

export function HelpPage({ info }: { info: LauncherInfo | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="size-4" /> Gorth Launcher
        </CardTitle>
        <CardDescription>gorth://settings/help</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>Minecraft Java Edition · Phiên bản {info?.version ?? "0.0.0"}</p>
        <p className="text-muted-foreground">{info?.platform ?? "Desktop"}</p>
        <div className="space-y-2">
          <h2 className="font-medium">Thư mục dữ liệu ứng dụng</h2>
          <p className="break-all text-muted-foreground">
            {info?.dataPath ?? "Đang đọc…"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
