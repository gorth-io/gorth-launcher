import {
  loaderCatalog as supportedLoaderCatalog,
  supportedLoader,
} from "@/lib/game/catalog";
import { ContentPage } from "@/pages/content";
import { ConsolePage } from "@/pages/console";
import { GalleryPage } from "@/pages/gallery";
import { NotificationsPage } from "@/pages/notifications";
import { InstancePreferencesPage } from "@/pages/settings/instance";
import { useNotifications } from "@/hooks/use-notifications";
import { ShortcutsPage } from "@/pages/shortcuts";
import { HelpPage } from "@/pages/settings/help";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "@/layouts/dashboard";
import { navigation } from "@/components/dashboard/navigation-data";
import { Gamepad2, Info, Image, Link, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CreateInstanceForm } from "@/components/form/create-instance-form";
import { InstanceNameForm } from "@/components/form/instance-name-form";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import { useLibrary } from "@/hooks/use-library";
import { LoadingScreen } from "@/components/element/loading-screen";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  AccountsPage,
  DownloadsPage,
  HomePage,
  LibraryPage,
  InstanceDataPage,
  SettingsPage,
} from "@/pages";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/element/auth-screen";
import { Titlebar } from "@/layouts/titlebar";
import { NavigationBar } from "@/layouts/navigation-bar";
import { useLauncherNavigation } from "@/hooks/use-launcher-navigation";
import { Wrapper } from "@/layouts/wrapper";
import { type Instance, type Page } from "@/lib/utils/interface";
import { gamePhaseLabels } from "@/lib/utils/constant";
import { formatDate } from "@/lib/utils/formatter";
import {
  applyTheme,
  readTheme,
  subscribeToSystemTheme,
  type Theme,
} from "@/lib/theme";
import type { LauncherInfo } from "@/preload/interface";

export default function Application() {
  const authentication = useAuth();
  const gaming = useGame();
  const pageNavigation = useLauncherNavigation();
  const { page, navigate: setPage } = pageNavigation;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const library = useLibrary();
  const { instances, settings, instanceSettings, setSettings } = library;
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [info, setInfo] = useState<LauncherInfo | null>(null);
  const [infoReady, setInfoReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Instance | null>(null);
  const [notice, setNotice] = useState("");
  const notifications = useNotifications(
    notice || gaming.error || library.error || authentication.error,
    gaming.game.jobs,
  );
  const [contentDetail, setContentDetail] = useState(false);
  const [instanceGroup, setInstanceGroup] = useState("");
  const [runtimeVersion, setRuntimeVersion] = useState("1.20.1");
  const [runtimeLoader, setRuntimeLoader] = useState("Vanilla");
  const [runtimeLoaderVersion, setRuntimeLoaderVersion] = useState("");
  const [shortcutTarget, setShortcutTarget] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    applyTheme(theme);
    return subscribeToSystemTheme(() => applyTheme(theme));
  }, [theme]);
  useEffect(
    () =>
      window.electronAPI.appMenu.onAction((action) => {
        setSelected(null);
        if (action === "new-instance") {
          setCreating(true);
        } else {
          setCreating(false);
          setPage(action);
        }
      }),
    [],
  );
  useEffect(() => {
    const onMenuAction = (event: Event) => {
      const action = (event as CustomEvent<Page | "new-instance">).detail;
      setSelected(null);
      if (action === "new-instance") {
        setCreating(true);
      } else {
        setCreating(false);
        setPage(action);
      }
    };
    window.addEventListener("launcher:menu-action", onMenuAction);
    return () =>
      window.removeEventListener("launcher:menu-action", onMenuAction);
  }, []);
  useEffect(
    () => window.electronAPI.library.onShortcutPlay(setShortcutTarget),
    [],
  );
  useEffect(() => {
    if (!shortcutTarget || !library.ready || !gaming.ready) return;
    const instance = instances.find((item) => item.id === shortcutTarget);
    setShortcutTarget(null);
    if (!instance) setNotice("Shortcut trỏ tới instance không còn tồn tại.");
    else void gaming.run({ action: "play", instance });
  }, [shortcutTarget, library.ready, gaming.ready, instances]);
  useEffect(() => {
    let active = true;
    window.electronAPI.launcher
      .getInfo()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch(() => {
        if (active) setNotice("Không đọc được thông tin hệ thống.");
      })
      .finally(() => {
        if (active) setInfoReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (creating || selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [creating, selected]);
  useEffect(() => {
    if (!selected) return;
    setInstanceGroup(selected.group ?? "");
    setRuntimeVersion(selected.version);
    setRuntimeLoader(selected.loader);
    setRuntimeLoaderVersion(selected.loaderVersion ?? "");
  }, [selected]);
  useEffect(() => {
    heading.current?.focus();
  }, [page]);
  const closeDialog = () => {
    setCreating(false);
    setSelected(null);
  };
  const selectedJob = gaming.game.jobs.find(
    (job: { instanceId: string | undefined }) =>
      job.instanceId === selected?.id,
  );
  const selectedBusy =
    !!selectedJob &&
    [
      "queued",
      "checking",
      "downloading",
      "paused",
      "starting",
      "running",
      "stopping",
    ].includes(selectedJob.phase);
  const statusLabel = (id: string) =>
    gamePhaseLabels[
      gaming.game.jobs.find(
        (job: { instanceId: string | undefined }) => job.instanceId === id,
      )?.phase ?? "idle"
    ];
  const title =
    page === "settings/help"
      ? "Về Gorth Launcher"
      : (navigation.find((item) => item.id === page)?.label ?? "");
  const createInstance = async ({
    name,
    version,
    loader,
    loaderVersion,
  }: {
    name: string;
    version: string;
    loader: string;
    loaderVersion?: string | null;
  }) => {
    if (
      !(await library.run({
        action: "create",
        name,
        version,
        loader,
        loaderVersion,
      }))
    )
      return;
    closeDialog();
    setPage("library");
    setQuery("");
    setFilter("all");
    setNotice("Đã tạo instance. Mở Chi tiết để tải game hoặc chơi.");
  };
  if (!library.ready || !authentication.ready || !gaming.ready || !infoReady) {
    return <LoadingScreen error={!library.ready ? library.error : undefined} />;
  }

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Titlebar showLogo={library.settings.showTitlebarLogo ?? true} />
        <NavigationBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          canGoBack={pageNavigation.canGoBack}
          canGoForward={pageNavigation.canGoForward}
          onBack={() => {
            setSelected(null);
            setCreating(false);
            setContentDetail(false);
            pageNavigation.back();
          }}
          onForward={() => {
            setSelected(null);
            setCreating(false);
            setContentDetail(false);
            pageNavigation.forward();
          }}
        />
        <SidebarProvider
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <Dashboard
            page={page}
            onNavigate={setPage}
            instanceCount={instances.length}
            unreadCount={notifications.unread}
          />
          <main
            className={`min-w-0 flex-1 ${contentDetail ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            <Wrapper fullWidth={contentDetail} immersive={contentDetail}>
              {!contentDetail && (
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div>
                    <h1
                      className="text-2xl font-semibold tracking-tight outline-none"
                      ref={heading}
                      tabIndex={-1}
                    >
                      {title}
                    </h1>
                  </div>
                  {(page === "home" || page === "library") && (
                    <Button className="h-9" onClick={() => setCreating(true)}>
                      <Plus size={17} />
                      Tạo instance
                    </Button>
                  )}
                </div>
              )}
              {!contentDetail && (notice || gaming.error || library.error) && (
                <div
                  role="status"
                  className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm [&>span]:flex-1"
                >
                  <Info size={17} />
                  <span>{library.error || gaming.error || notice}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9"
                    aria-label="Đóng thông báo"
                    onClick={() => {
                      setNotice("");
                      gaming.clearError();
                      library.clearError();
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              )}
              {!library.ready && (
                <p role="status">{library.error || "Đang mở thư viện…"}</p>
              )}
              <fieldset
                disabled={!library.ready || library.busy}
                className={`min-w-0 border-0 p-0 ${contentDetail ? "h-full" : ""}`}
              >
                {page === "home" && (
                  <HomePage
                    game={gaming.game}
                    versions={gaming.versions}
                    onVersionCreate={(version) =>
                      void createInstance({
                        name: `MC ${version}`,
                        version,
                        loader: "Vanilla",
                        loaderVersion: null,
                      })
                    }
                    accounts={authentication.auth?.accounts ?? []}
                    accountId={authentication.auth?.selectedAccountId ?? null}
                    onAccount={(id) =>
                      void authentication.run({ action: "game.select", id })
                    }
                    onPlay={(instance) =>
                      void gaming.run({ action: "play", instance })
                    }
                    onStop={(id) => void gaming.run({ action: "stop", id })}
                    instances={instances}
                    info={info}
                    onCreate={() => setCreating(true)}
                    onOpenLibrary={() => setPage("library")}
                    onSelect={setSelected}
                    statusLabel={statusLabel}
                  />
                )}
                {page === "shortcuts" && <ShortcutsPage />}
                {page === "settings/help" && <HelpPage info={info} />}
                {page === "library" && (
                  <>
                    <div className="mb-4 flex justify-end gap-2">
                      <Button
                        className="h-9"
                        variant="outline"
                        disabled={library.busy || !!gaming.game.activeId}
                        onClick={() =>
                          void library.run({ action: "orphans.import" })
                        }
                      >
                        Tìm và nhập instance mồ côi
                      </Button>
                    </div>
                    <LibraryPage
                      instances={instances}
                      query={query}
                      onQueryChange={setQuery}
                      filter={filter}
                      onFilterChange={setFilter}
                      onCreate={() => setCreating(true)}
                      onSelect={setSelected}
                      statusLabel={statusLabel}
                    />
                  </>
                )}
                {page === "downloads" && (
                  <DownloadsPage {...gaming} instances={instances} />
                )}
                {page === "instance-data" && (
                  <InstanceDataPage
                    instances={instances}
                    busy={library.busy || !!gaming.game.activeId}
                    onChanged={() =>
                      setNotice("Đã cập nhật thư viện instance.")
                    }
                  />
                )}
                {page === "accounts" && <AccountsPage {...authentication} />}
                {page === "console" && (
                  <ConsolePage {...gaming} instances={instances} />
                )}
                {page === "gallery" && (
                  <GalleryPage
                    instances={instances}
                    onOpenDirectory={gaming.openDirectory}
                  />
                )}
                {page === "notifications" && (
                  <NotificationsPage {...notifications} />
                )}
                {page === "settings/instance" && (
                  <InstancePreferencesPage
                    instances={instances}
                    settings={instanceSettings}
                    accounts={authentication.auth?.accounts ?? []}
                    busy={library.busy || !!gaming.game.activeId}
                    onEdit={setSelected}
                    onSave={(id, value) =>
                      library.run({
                        action: "instance.settings",
                        id,
                        settings: value,
                      })
                    }
                  />
                )}
                {[
                  "content",
                  "mods",
                  "modpacks",
                  "resourcepacks",
                  "shaders",
                ].includes(page) && (
                  <ContentPage
                    key={page}
                    fixedKind={
                      page === "mods"
                        ? "mod"
                        : page === "modpacks"
                          ? "modpack"
                          : page === "resourcepacks"
                            ? "resourcepack"
                            : page === "shaders"
                              ? "shader"
                              : undefined
                    }
                    instances={instances}
                    gameBusy={!!gaming.game.activeId}
                    onLibrary={() => setPage("library")}
                    hideWebview={creating || !!selected}
                    onDetailChange={setContentDetail}
                  />
                )}
                {page === "settings" && (
                  <SettingsPage
                    settings={settings}
                    setSettings={setSettings}
                    theme={theme}
                    setTheme={setTheme}
                    info={info}
                    setNotice={setNotice}
                    history={gaming.game.history}
                  />
                )}
                {page === "library" && library.trash.length > 0 && (
                  <section className="mt-6 space-y-3 rounded-lg border p-4">
                    <h2 className="font-medium">
                      Thùng rác ({library.trash.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Instance được tự dọn theo thời hạn trong Cài đặt.
                    </p>
                    <Button
                      className="h-9"
                      variant="outline"
                      disabled={library.busy || !!gaming.game.activeId}
                      onClick={() =>
                        void library.run({ action: "trash.cleanup" })
                      }
                    >
                      Dọn toàn bộ Trash
                    </Button>
                    {library.trash.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm">
                          {item.name} · {item.version}
                        </span>
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={!!gaming.game.activeId}
                          onClick={() =>
                            void library.run({ action: "restore", id: item.id })
                          }
                        >
                          Khôi phục
                        </Button>
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={!!gaming.game.activeId}
                          onClick={() =>
                            void library.run({
                              action: "trash.purge",
                              id: item.id,
                              keepSaves: true,
                            })
                          }
                        >
                          Giữ saves & xóa
                        </Button>
                        <Button
                          className="h-9"
                          variant="destructive"
                          disabled={!!gaming.game.activeId}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Xóa vĩnh viễn instance và toàn bộ saves?",
                              )
                            )
                              void library.run({
                                action: "trash.purge",
                                id: item.id,
                                keepSaves: false,
                              });
                          }}
                        >
                          Xóa vĩnh viễn
                        </Button>
                      </div>
                    ))}
                  </section>
                )}
              </fieldset>

              {!contentDetail && (
                <footer className="mt-8 flex justify-between border-t pt-4 text-xs text-muted-foreground">
                  <span>GORTH LAUNCHER</span>
                  <span>Không gian riêng cho những thế giới của bạn.</span>
                </footer>
              )}
            </Wrapper>
          </main>
        </SidebarProvider>
        <dialog
          ref={dialog}
          className="m-auto max-h-[calc(100vh-3rem)] w-[720px] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/50 [&_h2]:text-xl [&_h2]:font-semibold [&_label]:mt-4 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-1 [&_label]:flex-col [&_label]:gap-2 [&_label]:text-sm [&_input]:h-9 [&_select]:h-9"
          aria-labelledby="instance-dialog-title"
          onCancel={closeDialog}
          onClick={(event) => {
            if (event.target === dialog.current) closeDialog();
          }}
        >
          <div className="mb-4 flex items-start justify-between">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&>svg]:size-5">
              <Gamepad2 />
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9"
              aria-label="Đóng hộp thoại"
              onClick={closeDialog}
            >
              <X size={20} />
            </Button>
          </div>
          {creating && (
            <fieldset disabled={library.busy || !library.ready}>
              <CreateInstanceForm
                versions={gaming.versions}
                onCancel={closeDialog}
                onSubmit={createInstance}
              />
            </fieldset>
          )}
          {selected && (
            <>
              <h2 id="instance-dialog-title">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">
                Minecraft {selected.version} · {selected.loader}{" "}
                {selected.loaderVersion}
              </p>
              <InstanceNameForm
                key={selected.id}
                initialName={selected.name}
                busy={library.busy || !!gaming.game.activeId}
                onSave={async (name) => {
                  if (
                    await library.run({
                      action: "rename",
                      id: selected.id,
                      name,
                    })
                  )
                    setSelected({ ...selected, name });
                }}
                onCopy={async (name) => {
                  if (
                    await library.run({ action: "copy", id: selected.id, name })
                  ) {
                    closeDialog();
                    setNotice("Đã sao chép instance và dữ liệu game.");
                  }
                }}
              />
              <section className="mt-5 space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Nhận diện & nhóm</h3>
                <div className="flex gap-2">
                  <Input
                    className="h-9 flex-1"
                    placeholder="Tên nhóm / folder"
                    value={instanceGroup}
                    maxLength={60}
                    onChange={(event) => setInstanceGroup(event.target.value)}
                  />
                  <Button
                    className="h-9"
                    variant="outline"
                    disabled={library.busy || !!gaming.game.activeId}
                    onClick={() =>
                      void library.run({
                        action: "metadata",
                        id: selected.id,
                        group: instanceGroup.trim() || null,
                      })
                    }
                  >
                    Lưu nhóm
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-9"
                    variant="outline"
                    disabled={library.busy || !!gaming.game.activeId}
                    onClick={() =>
                      void window.electronAPI.library.chooseIcon(selected.id)
                    }
                  >
                    <Image />
                    Chọn icon
                  </Button>
                  {selected.iconData && (
                    <Button
                      className="h-9"
                      variant="ghost"
                      disabled={library.busy || !!gaming.game.activeId}
                      onClick={() =>
                        void library.run({
                          action: "icon",
                          id: selected.id,
                          iconData: null,
                        })
                      }
                    >
                      Bỏ icon
                    </Button>
                  )}
                  <Button
                    className="h-9"
                    variant="outline"
                    onClick={async () => {
                      const result =
                        await window.electronAPI.library.createShortcut(
                          selected.id,
                        );
                      setNotice(
                        result.ok
                          ? `Đã tạo shortcut: ${result.path}`
                          : (result.error ?? "Không tạo được shortcut."),
                      );
                    }}
                  >
                    <Link />
                    Desktop shortcut
                  </Button>
                </div>
              </section>
              <section className="mt-5 space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Minecraft & mod loader</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NativeSelect
                    className="w-full"
                    value={runtimeVersion}
                    onChange={(event) => {
                      setRuntimeVersion(event.target.value);
                      setRuntimeLoader("Vanilla");
                      setRuntimeLoaderVersion("");
                    }}
                  >
                    {gaming.versions.map((version) => (
                      <NativeSelectOption key={version.id} value={version.id}>
                        {version.id}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    className="w-full"
                    value={`${runtimeLoader}:${runtimeLoaderVersion}`}
                    onChange={(event) => {
                      const [loader, version = ""] =
                        event.target.value.split(":");
                      setRuntimeLoader(loader);
                      setRuntimeLoaderVersion(version);
                    }}
                  >
                    <NativeSelectOption value="Vanilla:">
                      Vanilla
                    </NativeSelectOption>
                    {supportedLoaderCatalog
                      .filter((entry) => entry.minecraft === runtimeVersion)
                      .map((entry) => (
                        <NativeSelectOption
                          key={`${entry.loader}:${entry.version}`}
                          value={`${entry.loader}:${entry.version}`}
                        >
                          {entry.loader} {entry.version}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                  <Button
                    className="h-9"
                    disabled={library.busy || !!gaming.game.activeId}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Đổi runtime sẽ yêu cầu tải lại game/loader nhưng giữ nguyên saves, mods và config. Tiếp tục?",
                        )
                      )
                        return;
                      if (
                        await library.run({
                          action: "runtime",
                          id: selected.id,
                          version: runtimeVersion,
                          loader: runtimeLoader,
                          loaderVersion: runtimeLoaderVersion || null,
                        })
                      ) {
                        setSelected({
                          ...selected,
                          version: runtimeVersion,
                          loader: runtimeLoader,
                          loaderVersion: runtimeLoaderVersion || null,
                        });
                        setNotice(
                          "Đã đổi runtime. Hãy tải game trước khi chơi.",
                        );
                      }
                    }}
                  >
                    Đổi runtime
                  </Button>
                </div>
              </section>
              {instanceSettings[selected.id] && (
                <InstanceSettingsForm
                  key={selected.id}
                  initialSettings={instanceSettings[selected.id]}
                  accounts={authentication.auth?.accounts ?? []}
                  busy={library.busy || !!gaming.game.activeId}
                  onSave={(next) =>
                    library.run({
                      action: "instance.settings",
                      id: selected.id,
                      settings: next,
                    })
                  }
                />
              )}
              {library.busy && (
                <p role="status" className="mt-2 text-sm">
                  Đang xử lý dữ liệu instance…
                </p>
              )}
              {library.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {library.error}
                </p>
              )}
              <div className="my-5 flex flex-col gap-3 [&>span]:flex [&>span]:justify-between [&>span]:text-sm [&_strong]:font-medium">
                <span>
                  Trạng thái<strong>{statusLabel(selected.id)}</strong>
                </span>
                <span>
                  Ngày tạo
                  <strong>{formatDate(selected.createdAt)}</strong>
                </span>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground [&>svg]:size-5 [&>svg]:shrink-0 [&_strong]:font-medium [&_strong]:text-foreground [&_p]:leading-6">
                <Info size={18} />
                <p>
                  {selectedJob?.message ??
                    "Tải Minecraft và Temurin, sau đó chọn tài khoản game để chơi."}
                </p>
              </div>
              {!authentication.auth?.selectedAccountId &&
                !instanceSettings[selected.id]?.accountId && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Thêm và chọn tài khoản game ở trang Tài khoản để chơi.
                  </p>
                )}
              {!supportedLoader(selected) && (
                <p className="mt-3 text-sm text-destructive">
                  Phiên bản Minecraft hoặc loader không còn được hỗ trợ. Hãy tạo
                  instance mới từ danh sách ổn định; dữ liệu cũ vẫn được giữ
                  nguyên.
                </p>
              )}

              {selectedJob?.total ? (
                <progress
                  className="mt-3 w-full accent-primary"
                  value={selectedJob.completed}
                  max={selectedJob.total}
                  aria-label="Tiến trình tải game"
                />
              ) : null}
              <Button
                className="mt-3 h-9"
                variant="ghost"
                onClick={() => {
                  closeDialog();
                  setPage("downloads");
                }}
              >
                Xem tiến trình & nhật ký
              </Button>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  disabled={library.busy || !!gaming.game.activeId}
                  variant="destructive"
                  className="h-9"
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Đưa instance “" +
                          selected.name +
                          "” và toàn bộ world/dữ liệu game vào thùng rác launcher? Bạn có thể khôi phục từ Thư viện.",
                      )
                    ) {
                      if (
                        await library.run({ action: "delete", id: selected.id })
                      ) {
                        closeDialog();
                        setNotice(
                          "Đã chuyển instance vào thùng rác. Có thể khôi phục tại Thư viện.",
                        );
                      }
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Xóa instance
                </Button>
                {selectedBusy ? (
                  <Button
                    className="h-9"
                    variant="outline"
                    onClick={() =>
                      void gaming.run({
                        action:
                          selectedJob?.phase === "running" ? "stop" : "cancel",
                        id: selected.id,
                      })
                    }
                  >
                    Dừng / Hủy
                  </Button>
                ) : (
                  <>
                    <Button
                      className="h-9"
                      variant="outline"
                      disabled={
                        library.busy ||
                        selectedBusy ||
                        !supportedLoader(selected)
                      }
                      onClick={() =>
                        void gaming.run({
                          action: "install",
                          instance: selected,
                        })
                      }
                    >
                      Tải game
                    </Button>
                    <Button
                      className="h-9"
                      disabled={
                        selectedBusy ||
                        library.busy ||
                        (!authentication.auth?.selectedAccountId &&
                          !instanceSettings[selected.id]?.accountId) ||
                        !supportedLoader(selected)
                      }
                      onClick={() =>
                        void gaming.run({
                          action: "play",
                          instance: selected,
                        })
                      }
                    >
                      Chơi Minecraft
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </dialog>
      </div>
      <AuthScreen
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onReturn={() => {
          setPage("accounts");
          setSelected(null);
          setCreating(false);
          setContentDetail(false);
        }}
      />
    </>
  );
}
