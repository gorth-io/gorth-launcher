import { supportedLoader } from "@/lib/game/catalog";
import { ContentPage } from "@/pages/content";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  Box,
  Download,
  Gamepad2,
  Home,
  Info,
  Layers,
  Plus,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateInstanceForm } from "@/components/form/create-instance-form";
import { InstanceNameForm } from "@/components/form/instance-name-form";
import { useLibrary } from "@/hooks/use-library";
import { LoadingScreen } from "@/components/element/loading-screen";
import { Card, CardTitle } from "@/components/ui/card";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  AccountsPage,
  DownloadsPage,
  HomePage,
  LibraryPage,
  SettingsPage,
} from "@/pages";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { Titlebar } from "@/layouts/titlebar";
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

const navigation = [
  { id: "home", label: "Tổng quan", icon: Home },
  { id: "library", label: "Thư viện", icon: Layers },
  { id: "content", label: "Mod & modpack", icon: Box },
  { id: "downloads", label: "Tải xuống", icon: Download },
  { id: "accounts", label: "Tài khoản", icon: UserRound },
  { id: "settings", label: "Cài đặt", icon: Settings2 },
] as const;

export default function Application() {
  const authentication = useAuth();
  const gaming = useGame();
  const [page, setPage] = useState<Page>("home");
  const library = useLibrary();
  const { instances, settings, setSettings } = library;
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [info, setInfo] = useState<LauncherInfo | null>(null);
  const [infoReady, setInfoReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Instance | null>(null);
  const [notice, setNotice] = useState("");
  const [contentDetail, setContentDetail] = useState(false);
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
  const selectedBusy = gaming.game.activeId === selected?.id;
  const statusLabel = (id: string) =>
    gamePhaseLabels[
      gaming.game.jobs.find(
        (job: { instanceId: string | undefined }) => job.instanceId === id,
      )?.phase ?? "idle"
    ];
  const title = navigation.find((item) => item.id === page)?.label ?? "";
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
        <Titlebar />
        <SidebarProvider
          open
          onOpenChange={() => {}}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <Sidebar collapsible="none" className="">
            <SidebarHeader className="">
              <Card className="flex flex-row h-14 items-center p-2.5 gap-2.5 rounded-lg ring-0 hover:ring-1 ring-foreground/10 transition-all duration-200 ease-in-out">
                <div className="flex aspect-square size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Box className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <CardTitle>Launcher</CardTitle>
                </div>
              </Card>
            </SidebarHeader>
            <SidebarContent className="gap-0">
              {[navigation].map((item) => (
                <Fragment key="primary-navigation">
                  <SidebarSeparator className="m-0" />
                  <SidebarMenu className="p-2">
                    {item.map(({ id, label, icon: Icon }) => (
                      <SidebarMenuItem key={id}>
                        <SidebarMenuButton
                          className="h-9 [&>svg]:size-4"
                          isActive={page === id}
                          aria-current={page === id ? "page" : undefined}
                          onClick={() => setPage(id)}
                        >
                          <Icon className="size-4" />
                          <span>{label}</span>
                        </SidebarMenuButton>
                        {id === "library" && (
                          <SidebarMenuBadge className="ring-1 ring-foreground/10 size-6 rounded-sm right-1">
                            {instances.length}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </Fragment>
              ))}
            </SidebarContent>
            <SidebarFooter className="">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-9"
                    onClick={() => setPage("accounts")}
                  >
                    <UserRound className="size-4" />
                    <span>
                      {authentication.auth?.launcher?.name ?? "Đăng nhập Gorth"}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
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
                    hasActiveJob={!!gaming.game.activeId}
                    instances={instances}
                    info={info}
                    onCreate={() => setCreating(true)}
                    onOpenLibrary={() => setPage("library")}
                    onSelect={setSelected}
                    statusLabel={statusLabel}
                  />
                )}
                {page === "library" && (
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
                )}
                {page === "downloads" && (
                  <DownloadsPage {...gaming} instances={instances} />
                )}
                {page === "accounts" && <AccountsPage {...authentication} />}
                {page === "content" && (
                  <ContentPage
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
                  />
                )}
                {page === "library" && library.trash.length > 0 && (
                  <section className="mt-6 space-y-3 rounded-lg border p-4">
                    <h2 className="font-medium">
                      Thùng rác ({library.trash.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Instance đã xóa vẫn được giữ tại thư mục thùng rác của
                      launcher để khôi phục.
                    </p>
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
          className="m-auto max-h-[calc(100vh-3rem)] w-[480px] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/50 [&_h2]:text-xl [&_h2]:font-semibold [&_label]:mt-4 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-1 [&_label]:flex-col [&_label]:gap-2 [&_label]:text-sm [&_input]:h-9 [&_select]:h-9"
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
              {!authentication.auth?.selectedAccountId && (
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
                        !!gaming.game.activeId ||
                        !supportedLoader(selected)
                      }
                      onClick={() =>
                        void gaming.run({
                          action: "install",
                          instance: selected,
                          settings,
                        })
                      }
                    >
                      Tải game
                    </Button>
                    <Button
                      className="h-9"
                      disabled={
                        !!gaming.game.activeId ||
                        library.busy ||
                        !authentication.auth?.selectedAccountId ||
                        !supportedLoader(selected)
                      }
                      onClick={() =>
                        void gaming.run({
                          action: "play",
                          instance: selected,
                          settings,
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
    </>
  );
}
