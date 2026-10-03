import { Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InstanceCards,
  type InstanceCardsProps,
} from "@/components/element/instance-cards";
import type { Instance } from "@/lib/launcher";
interface LibraryPageProps extends Pick<
  InstanceCardsProps,
  "onSelect" | "statusLabel"
> {
  instances: Instance[];
  query: string;
  filter: string;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onCreate: () => void;
}
export function LibraryPage({
  instances,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onCreate,
  onSelect,
  statusLabel,
}: LibraryPageProps) {
  const visible = instances.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || item.loader === filter),
  );
  return (
    <>
      <p className="mb-6 text-sm text-muted-foreground">
        Quản lý các cấu hình Minecraft độc lập của bạn.
      </p>
      <div className="mb-6 flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 [&>input]:h-9">
          <Search size={17} />
          <Input
            aria-label="Tìm instance"
            placeholder="Tìm instance…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <select
          aria-label="Lọc mod loader"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          <option value="all">Tất cả mod loader</option>
          {["Vanilla", "Fabric", "Forge", "NeoForge"].map((loader) => (
            <option key={loader}>{loader}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {visible.length} instance
        </span>
      </div>
      {visible.length ? (
        <InstanceCards
          items={visible}
          onSelect={onSelect}
          statusLabel={statusLabel}
        />
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center [&_h3]:font-semibold [&_p]:max-w-md [&_p]:text-sm [&_p]:leading-6 [&_p]:text-muted-foreground">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&>svg]:size-5">
            <Layers />
          </span>
          <h3>
            {instances.length
              ? "Không tìm thấy instance"
              : "Thư viện đang trống"}
          </h3>
          <p>
            {instances.length
              ? "Thử tên khác hoặc thay đổi bộ lọc."
              : "Mỗi instance có phiên bản và cấu hình riêng."}
          </p>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              if (instances.length) {
                onQueryChange("");
                onFilterChange("all");
              } else onCreate();
            }}
          >
            {instances.length ? "Xóa bộ lọc" : "Tạo instance"}
          </Button>
        </div>
      )}
    </>
  );
}
