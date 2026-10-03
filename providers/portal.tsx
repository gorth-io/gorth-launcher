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

type Entry = {
  id: string;
  window: Window;
  used: boolean;
  tooltip: boolean | "toast";
};
type Pool = {
  take: (tooltip?: boolean | "toast") => Entry | null;
  release: (entry: Entry) => void;
};
export const PoolContext = createContext<Pool | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const entries = useRef<Entry[]>([]);
  const [pool] = useState<Pool>(() => {
    const create = (tooltip: boolean | "toast") => {
      const id = crypto.randomUUID();
      const child = window.open(
        "about:blank",
        `portal_${id}`,
        `portalId=${id},tooltip=${tooltip}`,
      );
      if (!child) return null;
      child.document.documentElement.style.cssText =
        "background:transparent!important;overflow:hidden";
      child.document.body.style.cssText =
        "background:transparent!important;margin:0;padding:0;overflow:hidden;min-width:0;min-height:0";
      const entry = { id, window: child, used: false, tooltip };
      entries.current.push(entry);
      return entry;
    };
    return {
      take: (tooltip = false) => {
        const entry =
          entries.current.find(
            (item) =>
              !item.used && !item.window.closed && item.tooltip === tooltip,
          ) ?? create(tooltip);
        if (entry) entry.used = true;
        return entry;
      },
      release: (entry) => {
        window.electronAPI.portal.update(entry.id, null);
        entry.used = false;
      },
    };
  });
  useEffect(() => {
    const entry = pool.take();
    if (entry) pool.release(entry);
    return () => {
      for (const item of entries.current)
        if (!item.window.closed) item.window.close();
      entries.current = [];
    };
  }, [pool]);
  return <PoolContext.Provider value={pool}>{children}</PoolContext.Provider>;
}

export interface PortalAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function PortalPanel({
  children,
  anchor,
  align = "end",
  onClose,
  className = "",
}: {
  children: ReactNode;
  anchor: PortalAnchor;
  align?: "start" | "end";
  onClose: () => void;
  className?: string;
}) {
  const pool = useContext(PoolContext);
  if (!pool) throw new Error("PortalPanel requires PortalProvider");
  const [entry, setEntry] = useState<Entry | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const next = pool.take();
    setEntry(next);
    return () => {
      if (next) pool.release(next);
    };
  }, [pool]);

  useLayoutEffect(() => {
    if (!entry || entry.window.closed) return;
    const doc = entry.window.document;
    const sync = () => {
      doc.documentElement.className = document.documentElement.className;
      doc.documentElement.style.colorScheme =
        document.documentElement.style.colorScheme;
      doc.head.replaceChildren(
        ...Array.from(
          document.head.querySelectorAll('style,link[rel="stylesheet"]'),
        ).map((node) => node.cloneNode(true)),
      );
      // Relative font and stylesheet URLs must resolve against the chrome document.
      const base = doc.createElement("base");
      base.href = document.baseURI;
      doc.head.prepend(base);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
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
      const node = panel.current;
      if (!node || entry.window.closed) return;
      const width = Math.min(
        node.getBoundingClientRect().width + 16,
        window.innerWidth,
      );
      const height = Math.min(node.scrollHeight + 16, window.innerHeight - 8);
      const x =
        align === "start" ? anchor.x - 8 : anchor.x + anchor.width - width + 8;
      const below = anchor.y + anchor.height + (anchor.height ? 4 : 0);
      const y =
        below + height <= window.innerHeight
          ? below
          : Math.max(4, anchor.y - height - 4);
      window.electronAPI.portal.update(entry.id, { x, y, width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [entry, anchor.x, anchor.y, anchor.width, anchor.height, align]);

  useEffect(() => {
    if (!entry) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(event.key))
        return;
      const items = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not(:disabled)',
        ) ?? [],
      );
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(
        entry.window.document.activeElement as HTMLElement,
      );
      const backward =
        event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : current < 0
              ? backward
                ? items.length - 1
                : 0
              : (current + (backward ? -1 : 1) + items.length) % items.length;
      items[next].focus({ preventScroll: true });
      items[next].scrollIntoView({ block: "nearest" });
    };
    const outside = () => close.current();
    const unsubscribe = window.electronAPI.portal.onBlur((id) => {
      if (id === entry.id) close.current();
    });
    // React can flush an opening click before it reaches window.
    // Start outside-click handling after that event has finished.
    const listenTimer = window.setTimeout(
      () => window.addEventListener("click", outside),
      0,
    );
    window.addEventListener("keydown", escape);
    entry.window.addEventListener("keydown", escape);
    return () => {
      unsubscribe();
      window.clearTimeout(listenTimer);
      window.removeEventListener("click", outside);
      window.removeEventListener("keydown", escape);
      if (!entry.window.closed)
        entry.window.removeEventListener("keydown", escape);
    };
  }, [entry]);

  if (!entry || entry.window.closed) return null;
  return createPortal(
    <div className="p-2" onContextMenu={(event) => event.preventDefault()}>
      <div
        ref={panel}
        role="menu"
        className={`app-no-drag w-45 max-h-[calc(100vh-16px)] overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 ${className}`}
      >
        {children}
      </div>
    </div>,
    entry.window.document.body,
  );
}
