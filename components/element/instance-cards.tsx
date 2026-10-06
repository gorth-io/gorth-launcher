import { Box, ChevronRight, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Instance } from "@/lib/utils/interface";
export interface InstanceCardsProps {
  items: Instance[];
  onSelect: (instance: Instance) => void;
  statusLabel: (id: string) => string;
  layout?: "grid" | "list";
}
export function InstanceCards({
  items,
  onSelect,
  statusLabel,
  layout = "grid",
}: InstanceCardsProps) {
  return (
    <div
      className={layout === "list" ? "grid gap-3" : "grid gap-4 xl:grid-cols-2"}
    >
      {items.map((item) => (
        <Card key={item.id} className="gap-0 overflow-hidden py-0">
          <div className="flex h-24 items-center justify-center gap-3 bg-muted text-muted-foreground">
            {item.iconData ? (
              <img
                src={item.iconData}
                alt=""
                className="size-14 rounded-xl object-cover"
              />
            ) : (
              <Box size={42} strokeWidth={1.2} />
            )}
            <span>
              {item.loader} {item.loaderVersion}
            </span>
          </div>
          <div className="space-y-2 p-4">
            <strong className="block truncate">{item.name}</strong>
            <span className="text-sm text-muted-foreground">
              Minecraft {item.version}
            </span>
            {item.group && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Folder className="size-3" />
                {item.group}
              </span>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {statusLabel(item.id)}
              </span>
              <Button
                variant="outline"
                className="h-9"
                onClick={() => onSelect(item)}
              >
                Chi tiết
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
