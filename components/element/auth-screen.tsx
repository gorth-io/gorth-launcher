import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NavigationBar } from "@/layouts/navigation-bar";
import { useAuth } from "@/hooks/use-auth";
import type { AuthViewState } from "@/lib/auth/view-types";

export function AuthScreen({
  onReturn,
  sidebarOpen,
  onToggleSidebar,
}: {
  onReturn: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}) {
  const auth = useAuth();
  const { cancel } = auth;
  const [opened, setOpened] = useState(false);
  const [view, setView] = useState<AuthViewState | null>(null);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const returnToProfile = useRef(onReturn);
  useEffect(() => {
    returnToProfile.current = onReturn;
  }, [onReturn]);
  const completed = !!view?.completed && auth.authenticated && !auth.error;
  useEffect(() => {
    if (!completed) return;
    const timer = window.setTimeout(() => {
      setOpened(false);
      returnToProfile.current();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [completed]);
  useEffect(() => {
    let active = true;
    let notified = false;
    const unsubscribe = window.electronAPI.auth.onViewChanged((state) => {
      notified = true;
      if (state.visible) setOpened(true);
      if (active) setView(state);
    });
    void window.electronAPI.auth
      .viewState()
      .then((state) => {
        if (active && state.visible) setOpened(true);
        if (active && !notified) setView(state);
      })
      .catch(() => {
        if (active) setError("Không đọc được giao diện xác thực.");
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    const element = container.current;
    if (!view?.visible || !element) return;
    let active = true;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      void window.electronAPI.auth
        .setViewBounds({
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.floor(bounds.width),
          height: Math.floor(bounds.height),
        })
        .catch(() => {
          if (active) setError("Không cập nhật được giao diện xác thực.");
        });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    update();
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", update);
      void window.electronAPI.auth.setViewVisible(false);
    };
  }, [view?.visible]);
  if (!view?.visible && !opened) return null;
  return (
    <section
      aria-label="Xác thực Gorth"
      className="fixed inset-x-0 bottom-0 top-14 z-[100] flex flex-col bg-background"
    >
      <NavigationBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        authUrl={view?.visible ? (view.url ?? "Gorth SSO") : "gorth://auth"}
        onBack={() => {
          setOpened(false);
          if (view?.visible) void cancel();
          onReturn();
        }}
        canReload={!!view?.visible && !view.verifying}
        loading={!!view?.loading}
        onReload={() => {
          setError("");
          void window.electronAPI.auth
            .reloadView()
            .catch(() => setError("Không tải lại được trang xác thực."));
        }}
      />
      {(view?.error || error || auth.error) && (
        <p
          role="alert"
          className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {view?.error || error || auth.error}
        </p>
      )}
      <div ref={container} className="min-h-0 flex-1">
        <div
          role="status"
          className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          {!view?.visible ? (
            <div className="space-y-3 text-center">
              <h1 className="text-xl font-semibold text-foreground">
                {completed ? "Đăng nhập thành công" : "Tài khoản Gorth"}
              </h1>
              {auth.authenticated && <p>{auth.account?.name}</p>}
              {!auth.authenticated && (
                <Button
                  className="h-9"
                  disabled={auth.loading}
                  onClick={() => void auth.login()}
                >
                  Đăng nhập Gorth
                </Button>
              )}
            </div>
          ) : view.verifying ? (
            <span>Đang xác minh và lưu phiên Gorth…</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
