import { Grid2X2, Layers, List, Search, Settings2 } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageShell } from "@/layouts/page-shell";
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
  const [layout, setLayout] = useState("grid");
  const [selectedId, setSelectedId] = useState("");
  const selected =
    instances.find((item) => item.id === selectedId) ?? instances[0];
  const visible = instances.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        item.loader === filter ||
        (filter.startsWith("group:") && item.group === filter.slice(6))),
  );
  const groups = [
    ...new Set(instances.map((item) => item.group).filter(Boolean)),
  ];
  return (
    <PageShell
      aside={
        <Card>
          <CardHeader>
            <CardTitle>Instance Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <NativeSelect
              aria-label="Instance settings preview"
              value={selected?.id ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {!instances.length && (
                <NativeSelectOption value="">
                  Chưa có instance
                </NativeSelectOption>
              )}
              {instances.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {selected ? (
              <>
                <p className="text-sm">
                  Minecraft {selected.version} · {selected.loader}{" "}
                  {selected.loaderVersion}
                </p>
                <Button
                  className="h-9 w-full"
                  variant="outline"
                  onClick={() => onSelect(selected)}
                >
                  <Settings2 />
                  Edit Instance
                </Button>
                <Button
                  className="h-9 w-full"
                  variant="outline"
                  onClick={() => onSelect(selected)}
                >
                  Export & Manage
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select or create an instance.
              </p>
            )}
          </CardContent>
        </Card>
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        Quản lý các cấu hình Minecraft độc lập của bạn.
      </p>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          className="size-9"
          size="icon"
          aria-label="Grid"
          aria-pressed={layout === "grid"}
          variant={layout === "grid" ? "secondary" : "outline"}
          onClick={() => setLayout("grid")}
        >
          <Grid2X2 />
        </Button>
        <Button
          className="size-9"
          size="icon"
          aria-label="List"
          aria-pressed={layout === "list"}
          variant={layout === "list" ? "secondary" : "outline"}
          onClick={() => setLayout("list")}
        >
          <List />
        </Button>
        <label className="flex flex-1 items-center gap-2 [&>input]:h-9">
          <Search size={17} />
          <Input
            aria-label="Tìm instance"
            placeholder="Tìm instance…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <NativeSelect
          aria-label="Lọc mod loader"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          <NativeSelectOption value="all">Tất cả mod loader</NativeSelectOption>
          {["Vanilla", "Fabric", "Forge", "NeoForge"].map((loader) => (
            <NativeSelectOption key={loader}>{loader}</NativeSelectOption>
          ))}
          {groups.map((group) => (
            <NativeSelectOption key={group} value={`group:${group}`}>
              Nhóm: {group}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-sm text-muted-foreground">
          {visible.length} instance
        </span>
      </div>
      {visible.length ? (
        <InstanceCards
          items={visible}
          onSelect={onSelect}
          statusLabel={statusLabel}
          layout={layout === "list" ? "list" : "grid"}
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
    </PageShell>
  );
}
