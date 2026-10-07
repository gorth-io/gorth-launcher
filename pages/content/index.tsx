import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import modsBackground from "@/assets/dawn/mod.png";
import shaderBackground from "@/assets/dawn/shader.png";
import resourceBackground from "@/assets/dawn/background2.png";
import { ProjectDetail } from "./project-detail";
import { InstalledContentManager } from "./installed-content";
import { contentLabels } from "@/lib/content/website";
import { formatNumber } from "@/lib/utils/formatter";
import { loaderCatalog, supportedLoader } from "@/lib/game/catalog";
import type { Instance } from "@/lib/utils/interface";
import type {
  ContentProvider,
  ContentKind,
  ContentProject,
  ContentQuery,
  ContentStatus,
  ContentVersion,
  ContentResult,
} from "@/lib/content/interface";
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

export function ContentPage({
  instances,
  gameBusy,
  onLibrary,
  hideWebview,
  onDetailChange,
  fixedKind,
}: {
  instances: Instance[];
  gameBusy: boolean;
  onLibrary: () => void;
  hideWebview: boolean;
  onDetailChange: (active: boolean) => void;
  fixedKind?: ContentKind;
}) {
  const [status, setStatus] = useState<ContentStatus>({
    busy: false,
    message: "",
    completed: 0,
    total: 0,
  });
  const [configured, setConfigured] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{
    projects: ContentProject[];
    more: boolean;
  } | null>(null);
  const [searched, setSearched] = useState<ContentQuery | null>(null);
  const [target, setTarget] = useState("");
  const [targetWorld, setTargetWorld] = useState("");
  const [worlds, setWorlds] = useState<string[]>([]);
  const [selected, setSelected] = useState<ContentProject | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  useEffect(() => {
    onDetailChange(Boolean(selected));
    return () => onDetailChange(false);
  }, [selected, onDetailChange]);
  useEffect(() => {
    let live = true;
    const unsubscribe = window.electronAPI.content.onChanged(setStatus);
    void window.electronAPI.content
      .status()
      .then((value) => {
        if (live) {
          setStatus(value.status);
          setConfigured(value.curseforgeConfigured);
        }
      })
      .catch(() => {
        if (live) setError("Không kết nối được dịch vụ nội dung.");
      });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  async function execute<T>(
    operation: () => Promise<ContentResult<T>>,
  ): Promise<T | undefined> {
    setPending(true);
    setError("");
    try {
      const result = await operation();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không xử lý được yêu cầu.",
      );
    } finally {
      setPending(false);
    }
  }
  async function search(
    query: ContentQuery,
    instanceId: string,
    worldName = "",
  ) {
    setSelected(null);
    setVersions([]);
    setResults(null);
    setSearched(query);
    setTarget(instanceId);
    setTargetWorld(worldName);
    const result = await execute(() =>
      window.electronAPI.content.search(query),
    );
    if (result) setResults(result);
  }
  async function openProject(project: ContentProject) {
    if (!searched) return;
    setSelected(project);
    setVersions([]);
    setVersionId("");
    const items = await execute(() =>
      window.electronAPI.content.versions(searched, project.id),
    );
    if (items) {
      setVersions(items);
      setVersionId(items[0]?.id ?? "");
    }
  }
  const form = useForm({
    defaultValues: {
      provider: "modrinth" as ContentProvider,
      kind: fixedKind ?? ("modpack" as ContentKind),
      query: "",
      preset: "0",
      instanceId: "",
      worldName: "",
    },
    onSubmit: async ({ value }) => {
      const preset = loaderCatalog[Number(value.preset)] ?? loaderCatalog[0];
      const instance = instances.find((item) => item.id === value.instanceId);
      if (
        value.kind === "mod" &&
        instance &&
        (instance.loader === "Vanilla" || !supportedLoader(instance))
      ) {
        setError("Chọn instance có mod loader được hỗ trợ.");
        return;
      }
      if (value.kind === "datapack" && (!instance || !value.worldName)) {
        setError("Chọn instance và world để cài data pack.");
        return;
      }
      await search(
        {
          provider: value.provider,
          kind: value.kind,
          query: value.query,
          version:
            value.kind !== "modpack" && instance
              ? instance.version
              : preset.minecraft,
          loader:
            value.kind !== "modpack" && instance
              ? instance.loader
              : preset.loader,
          offset: 0,
        },
        value.instanceId,
        value.worldName,
      );
    },
  });
  const busy = pending || status.busy || gameBusy;
  if (selected && searched)
    return (
      <ProjectDetail
        key={searched.provider + selected.id}
        project={selected}
        query={searched}
        versions={versions}
        versionId={versionId}
        setVersionId={setVersionId}
        busy={busy}
        pending={pending}
        status={status}
        error={error}
        targetName={instances.find((item) => item.id === target)?.name}
        onBack={() => setSelected(null)}
        onLibrary={onLibrary}
        hideWebview={hideWebview}
        onCancel={() =>
          void window.electronAPI.content
            .cancel()
            .catch(() => setError("Không hủy được tác vụ."))
        }
        onInstall={async () => {
          const result = await execute(() =>
            window.electronAPI.content.install({
              query: searched,
              projectId: selected.id,
              versionId,
              ...(searched.kind !== "modpack" ? { instanceId: target } : {}),
              ...(searched.kind === "datapack"
                ? { worldName: targetWorld }
                : {}),
            }),
          );
          return result === null;
        }}
      />
    );
  return (
    <PageShell
      aside={
        <InstalledContentManager
          instances={instances}
          unavailable={busy}
          kind={fixedKind}
        />
      }
    >
      {fixedKind && (
        <PageBanner
          title={contentLabels[fixedKind]}
          description="Browse, install, and manage content via Modrinth and CurseForge."
          image={
            fixedKind === "shader"
              ? shaderBackground
              : fixedKind === "resourcepack"
                ? resourceBackground
                : modsBackground
          }
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Mod, modpack, shader, texture pack & data pack
          </h2>
          <p className="text-sm text-muted-foreground">
            Modrinth · CurseForge · quản lý và chỉ hiện file release phù hợp
            Minecraft/loader.
          </p>
        </div>
        <Button
          className="h-9"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void execute(() => window.electronAPI.content.importPack())
          }
        >
          <Upload size={16} />
          Nhập .mrpack / .zip
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Modpack tạo instance mới và giữ đúng loader trong manifest. Pack ngoài
        danh sách ổn định hoặc dùng Quilt sẽ bị từ chối. File client tùy chọn
        được bỏ qua. Chỉ cài nội dung từ tác giả bạn tin cậy.
      </p>
      {!configured && (
        <p className="rounded-md border p-3 text-sm">
          Modrinth dùng ngay, không cần tài khoản. CurseForge cần cấu hình{" "}
          <code>CURSEFORGE_API_KEY</code> cho main process rồi khởi động lại.
          File bị tác giả chặn tải bên thứ ba sẽ được báo rõ, không tải qua
          nguồn thay thế.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
          <form.Field name="provider">
            {(field) => (
              <label className="grid gap-1 text-sm">
                Nguồn
                <select
                  className={selectClass}
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.target.value as ContentProvider)
                  }
                >
                  <option value="modrinth">Modrinth</option>
                  <option value="curseforge">CurseForge</option>
                </select>
              </label>
            )}
          </form.Field>
          {!fixedKind && (
            <form.Field name="kind">
              {(field) => (
                <label className="grid gap-1 text-sm">
                  Loại
                  <select
                    className={selectClass}
                    value={field.state.value}
                    onChange={(event) =>
                      field.handleChange(event.target.value as ContentKind)
                    }
                  >
                    <option value="modpack">Modpack</option>
                    <option value="mod">Mod</option>
                    <option value="shader">Shader</option>
                    <option value="resourcepack">Texture pack</option>
                    <option value="datapack">Data pack</option>
                  </select>
                </label>
              )}
            </form.Field>
          )}
          <form.Subscribe selector={(state) => state.values.kind}>
            {(kind) =>
              kind === "modpack" ? (
                <form.Field name="preset">
                  {(field) => (
                    <label className="grid gap-1 text-sm">
                      Minecraft / loader
                      <select
                        className={selectClass}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      >
                        {loaderCatalog.map((entry, index) => (
                          <option key={index} value={index}>
                            {entry.loader} {entry.minecraft} · {entry.version}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </form.Field>
              ) : (
                <form.Field name="instanceId">
                  {(field) => (
                    <label className="grid gap-1 text-sm">
                      Instance đích
                      <select
                        className={selectClass}
                        value={field.state.value}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          setWorlds([]);
                          form.setFieldValue("worldName", "");
                          if (event.target.value)
                            void window.electronAPI.content
                              .inventory(event.target.value)
                              .then((result) =>
                                setWorlds(result.data?.worlds ?? []),
                              );
                        }}
                      >
                        <option value="">Chỉ duyệt · chưa chọn instance</option>
                        {instances
                          .filter(
                            (item) =>
                              (kind !== "mod" || item.loader !== "Vanilla") &&
                              (kind !== "shader" ||
                                ["Fabric", "NeoForge"].includes(item.loader)) &&
                              supportedLoader(item),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.loader} {item.version}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>
          <form.Subscribe selector={(state) => state.values.kind}>
            {(kind) =>
              kind === "datapack" && (
                <form.Field name="worldName">
                  {(field) => (
                    <label className="grid gap-1 text-sm">
                      World
                      <select
                        className={selectClass}
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      >
                        <option value="">Chọn world</option>
                        {worlds.map((world) => (
                          <option key={world} value={world}>
                            {world}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>
          <form.Field name="query">
            {(field) => (
              <label className="grid flex-1 gap-1 text-sm">
                Tìm kiếm
                <Input
                  className="h-9"
                  maxLength={100}
                  placeholder="Sodium, JEI, All the Mods…"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </label>
            )}
          </form.Field>
          <Button className="h-9" type="submit">
            <Search size={16} />
            Tìm kiếm
          </Button>
        </fieldset>
      </form>
      {(error || status.error) && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error || status.error}
        </p>
      )}
      {status.message && (
        <div role="status" className="space-y-2 rounded-md border p-3">
          <p className="text-sm">
            {status.message}{" "}
            {status.total > 0 && `${status.completed}/${status.total}`}
          </p>
          {status.total > 0 && (
            <progress
              className="w-full"
              max={status.total}
              value={status.completed}
            />
          )}
          {status.busy && (
            <Button
              className="h-9"
              variant="outline"
              onClick={() =>
                void window.electronAPI.content
                  .cancel()
                  .catch(() => setError("Không hủy được tác vụ."))
              }
            >
              Hủy tải nội dung
            </Button>
          )}
        </div>
      )}
      {pending && (
        <p role="status" className="text-sm">
          Đang xử lý…
        </p>
      )}
      {searched && (
        <p className="text-xs text-muted-foreground">
          Kết quả: {searched.provider} · {searched.kind} · {searched.loader}{" "}
          {searched.version}
          {target &&
            ` · ${instances.find((item) => item.id === target)?.name ?? "Instance đã xóa"}`}
        </p>
      )}
      {results && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {results.projects.map((project) => (
              <Card key={project.id} className="gap-2 p-4">
                <h3 className="font-medium">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    disabled={busy}
                    onClick={() => void openProject(project)}
                  >
                    {project.name}
                  </button>
                </h3>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {project.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(project.downloads)} lượt tải
                </p>
                <Button
                  className="h-9 self-start"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void openProject(project)}
                >
                  Xem {contentLabels[searched?.kind ?? "modpack"]}
                </Button>
              </Card>
            ))}
          </div>
          {!results.projects.length && <p>Không tìm thấy nội dung phù hợp.</p>}
          <div className="flex gap-2">
            <Button
              className="h-9"
              variant="outline"
              disabled={busy || !searched || searched.offset === 0}
              onClick={() =>
                searched &&
                void search(
                  { ...searched, offset: Math.max(0, searched.offset - 20) },
                  target,
                  targetWorld,
                )
              }
            >
              Trang trước
            </Button>
            <Button
              className="h-9"
              variant="outline"
              disabled={busy || !results.more}
              onClick={() =>
                searched &&
                void search(
                  { ...searched, offset: searched.offset + 20 },
                  target,
                  targetWorld,
                )
              }
            >
              Trang sau
            </Button>
          </div>
        </>
      )}
    </PageShell>
  );
}
