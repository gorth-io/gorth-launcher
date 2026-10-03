import { createElement, useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allowedContentWebsite } from "@/lib/content/website";

export function ProjectWebview({
  url,
  hidden,
  onBack,
  backDisabled,
}: {
  url: string;
  hidden: boolean;
  onBack: () => void;
  backDisabled: boolean;
}) {
  const view = useRef<Electron.WebviewTag>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = view.current;
    if (!element) return;
    const start = () => {
      setLoading(true);
      setError("");
    };
    const stop = () => setLoading(false);
    const navigate = (
      event: Electron.DidNavigateEvent | Electron.DidNavigateInPageEvent,
    ) => {
      if ("isMainFrame" in event && !event.isMainFrame) return;
      const expected = new URL(url);
      const actual = new URL(event.url);
      const root = expected.pathname.replace(/\/$/, "");
      // Keep the website and the install sidebar bound to the same project.
      if (
        actual.origin !== expected.origin ||
        (actual.pathname !== root && !actual.pathname.startsWith(root + "/"))
      )
        void element
          .loadURL(url)
          .catch(() => setError("Không mở được trang dự án."));
    };
    const fail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame && event.errorCode !== -3) {
        setLoading(false);
        setError(
          "Không tải được trang dự án. Hãy kiểm tra kết nối rồi thử lại.",
        );
      }
    };
    element.addEventListener("did-start-loading", start);
    element.addEventListener("did-stop-loading", stop);
    element.addEventListener("did-fail-load", fail);
    element.addEventListener("did-navigate", navigate);
    element.addEventListener("did-navigate-in-page", navigate);
    return () => {
      element.removeEventListener("did-start-loading", start);
      element.removeEventListener("did-stop-loading", stop);
      element.removeEventListener("did-fail-load", fail);
      element.removeEventListener("did-navigate", navigate);
      element.removeEventListener("did-navigate-in-page", navigate);
    };
  }, [url]);
  if (!allowedContentWebsite(url))
    return <p role="alert">Địa chỉ dự án không hợp lệ.</p>;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button
          className="h-9"
          size="icon"
          variant="ghost"
          aria-label="Quay lại kết quả"
          disabled={backDisabled}
          onClick={onBack}
        >
          <ArrowLeft size={17} />
        </Button>
        <Button
          className="h-9"
          size="icon"
          variant="ghost"
          aria-label="Tải lại trang dự án"
          onClick={() => view.current?.reload()}
        >
          <RotateCw size={16} />
        </Button>
        <Input
          aria-label="Địa chỉ dự án"
          className="h-9 min-w-0 flex-1 select-text bg-muted/60 shadow-none disabled:cursor-default disabled:opacity-100"
          disabled
          readOnly
          value={url}
        />
        {loading && (
          <span role="status" className="sr-only">
            Đang tải…
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {createElement("webview", {
        ref: view,
        src: url,
        partition: "content-websites",
        className: "min-h-0 w-full flex-1",
        style: { display: hidden ? "none" : "flex" },
        "aria-label": "Trang dự án",
      })}
    </div>
  );
}
