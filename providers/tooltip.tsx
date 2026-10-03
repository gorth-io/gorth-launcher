import {
  useContext,
  useEffect,
  useRef,
  type RefObject,
  type ComponentProps,
} from "react";
import { PoolContext } from "@/providers/portal";
import {
  TooltipContent as Content,
  Tooltip as Root,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/custom/tooltip";

// Preserve DOM identity: replacing the popup restarts its entrance animation.
function syncTooltipNode(target: Node, source: Node) {
  if (target.nodeType !== source.nodeType || target.nodeName !== source.nodeName) {
    target.parentNode?.replaceChild(source.cloneNode(true), target);
    return;
  }
  if (source.nodeType === Node.TEXT_NODE) {
    if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
    return;
  }
  if (source.nodeType === Node.ELEMENT_NODE) {
    const from = source as Element;
    const to = target as Element;
    for (const attribute of Array.from(to.attributes))
      if (!from.hasAttribute(attribute.name)) to.removeAttribute(attribute.name);
    for (const attribute of Array.from(from.attributes))
      if (to.getAttribute(attribute.name) !== attribute.value)
        to.setAttribute(attribute.name, attribute.value);
  }
  while (target.childNodes.length > source.childNodes.length)
    target.removeChild(target.lastChild!);
  Array.from(source.childNodes).forEach((child, index) => {
    const existing = target.childNodes[index];
    if (existing) syncTooltipNode(existing, child);
    else target.appendChild(child.cloneNode(true));
  });
}

// Base UI still owns positioning, delays and aria-describedby in the chrome DOM.
// Only its visual surface is mirrored above native web content.
export function TooltipSurface({
  source,
}: {
  source: RefObject<HTMLDivElement | null>;
}) {
  const pool = useContext(PoolContext);
  useEffect(() => {
    const node = source.current;
    if (!pool || !node) return;
    const entry = pool.take(true);
    if (!entry) return;
    const doc = entry.window.document;
    const opacity = node.style.opacity;
    node.style.opacity = "0";
    const syncTheme = () => {
      doc.documentElement.className = document.documentElement.className;
      doc.documentElement.style.colorScheme =
        document.documentElement.style.colorScheme;
    };
    const syncStyles = () => {
      const base = doc.createElement("base");
      base.href = document.baseURI;
      doc.head.replaceChildren(
        base,
        ...Array.from(
          document.head.querySelectorAll('style,link[rel="stylesheet"]'),
        ).map((item) => item.cloneNode(true)),
      );
    };
    syncTheme();
    syncStyles();
    const theme = new MutationObserver(syncTheme);
    const styles = new MutationObserver(syncStyles);
    styles.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    let dirty = true;
    let previous = "";
    let frame = 0;
    let dismissed = false;
    const changes = new MutationObserver(() => {
      dirty = true;
    });
    changes.observe(node, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    const unsubscribe = window.electronAPI.portal.onBlur((id) => {
      if (id === entry.id) {
        dismissed = true;
        window.electronAPI.portal.update(entry.id, null);
      }
    });
    const paint = () => {
      if (entry.window.closed || dismissed) return;
      const rect = node.getBoundingClientRect();
      const bounds = {
        x: rect.x - 8,
        y: rect.y - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      };
      const key = JSON.stringify(bounds);
      if (dirty || key !== previous) {
        const clone = node.cloneNode(true) as HTMLDivElement;
        Object.assign(clone.style, {
          position: "relative",
          inset: "auto",
          transform: "none",
          translate: "none",
          opacity: "1",
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: "8px",
        });
        clone.setAttribute("aria-hidden", "true");
        for (const item of clone.querySelectorAll<HTMLElement>("[id]"))
          item.removeAttribute("id");
        if (doc.body.firstChild) syncTooltipNode(doc.body.firstChild, clone);
        else doc.body.appendChild(clone);
        if (key !== previous && rect.width > 0 && rect.height > 0)
          window.electronAPI.portal.update(entry.id, bounds);
        dirty = false;
        previous = key;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      theme.disconnect();
      styles.disconnect();
      unsubscribe();
      node.style.opacity = opacity;
      if (!entry.window.closed) doc.body.replaceChildren();
      pool.release(entry);
    };
  }, [pool, source]);
  return null;
}

export function Tooltip(props: ComponentProps<typeof Root>) {
  return <Root disableHoverablePopup {...props} />;
}
export function TooltipContent(props: ComponentProps<typeof Content>) {
  const source = useRef<HTMLDivElement>(null);
  return (
    <Content
      {...props}
      positionerRef={source}
      surface={<TooltipSurface source={source} />}
    />
  );
}
export { TooltipTrigger, TooltipProvider };
