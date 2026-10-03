import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PoolContext } from "@/providers/portal";
import {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  toast,
  useToastManager,
} from "@/components/custom/toast";

export type ToastPosition =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";
const positions: ToastPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];
interface ToasterSettings {
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
}
const SettingsContext = createContext<ToasterSettings | null>(null);
export function useToasterSettings() {
  const settings = useContext(SettingsContext);
  if (!settings) throw new Error("ToasterProvider is required");
  return settings;
}

function ToastSurface({ position }: { position: ToastPosition }) {
  const pool = useContext(PoolContext);
  const { toasts } = useToastManager();
  const [entry, setEntry] =
    useState<ReturnType<NonNullable<typeof pool>["take"]>>(null);
  const panel = useRef<HTMLDivElement>(null);
  const active = toasts.length > 0;
  useEffect(() => {
    if (!pool || !active) return;
    const next = pool.take("toast");
    setEntry(next);
    return () => {
      if (next) pool.release(next);
      setEntry(null);
    };
  }, [pool, active]);
  useLayoutEffect(() => {
    if (!entry || entry.window.closed) return;
    const doc = entry.window.document;
    const sync = () => {
      doc.documentElement.className = document.documentElement.className;
      doc.documentElement.style.colorScheme =
        document.documentElement.style.colorScheme;
      const base = doc.createElement("base");
      base.href = document.baseURI;
      doc.head.replaceChildren(
        base,
        ...Array.from(
          document.head.querySelectorAll('style,link[rel="stylesheet"]'),
        ).map((node) => node.cloneNode(true)),
      );
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, [entry]);
  useLayoutEffect(() => {
    if (!entry || !panel.current) return;
    const measure = () => {
      if (entry.window.closed || !panel.current) return;
      const width = Math.min(376, window.innerWidth - 32);
      const height = Math.min(
        panel.current.scrollHeight,
        window.innerHeight - 32,
      );
      window.electronAPI.portal.update(entry.id, {
        x: position.endsWith("left") ? 16 : window.innerWidth - width - 16,
        y: position.startsWith("top") ? 16 : window.innerHeight - height - 16,
        width,
        height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel.current);
    window.addEventListener("resize", measure);
    window.addEventListener("focus", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("focus", measure);
    };
  }, [entry, position, toasts.length]);
  if (!entry || entry.window.closed) return null;
  return createPortal(
    <div ref={panel} className="p-2">
      <ToastViewport
        className="relative inset-auto m-0 flex w-full max-w-none flex-col gap-2 sm:inset-auto sm:m-0"
        style={{
          position: "relative",
          inset: "auto",
          margin: 0,
          width: "100%",
        }}
      >
        {toasts.map((item) => (
          <Toast
            key={item.id}
            toast={item}
            className={`data-limited:hidden data-starting-style:opacity-0 data-ending-style:opacity-0 ${position.startsWith("top") ? "data-starting-style:-translate-y-1 data-ending-style:-translate-y-1" : "data-starting-style:translate-y-1 data-ending-style:translate-y-1"}`}
            style={{
              position: "relative",
              bottom: "auto",
              right: "auto",
              height: "auto",
              transform: "none",
            }}
          >
            <ToastContent style={{ opacity: 1 }}>
              <div className="min-w-0 flex-1">
                <ToastTitle />
                <ToastDescription />
              </div>
              <ToastClose />
            </ToastContent>
          </Toast>
        ))}
      </ToastViewport>
    </div>,
    entry.window.document.body,
  );
}
export function ToasterProvider({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<ToastPosition>(() => {
    const saved = document.cookie
      .split("; ")
      .find((value) => value.startsWith("toast-position="))
      ?.split("=")[1];
    return positions.includes(saved as ToastPosition)
      ? (saved as ToastPosition)
      : "bottom-right";
  });
  const changePosition = (value: ToastPosition) => {
    document.cookie = `toast-position=${value}; path=/; max-age=31536000; SameSite=Strict`;
    setPosition(value);
  };
  return (
    <SettingsContext.Provider value={{ position, setPosition: changePosition }}>
      <ToastProvider toastManager={toast} timeout={5000} limit={3}>
        {children}
        <ToastSurface position={position} />
      </ToastProvider>
    </SettingsContext.Provider>
  );
}
export { toast };
