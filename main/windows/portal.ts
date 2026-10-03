import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  type WebContents,
  type View,
} from "electron";

// Each trusted chrome renderer owns its pool. Web tabs never register portals.
export function installPortal(parent: BrowserWindow) {
  const views = new Map<
    string,
    {
      view: View;
      tooltipWindow?: BrowserWindow;
      contents: WebContents;
      previousFocus?: WebContents;
    }
  >();
  const owner = parent.webContents;
  const hide = (id: string, restore = false) => {
    const entry = views.get(id);
    if (!entry || entry.contents.isDestroyed()) return;
    const focused = entry.contents.isFocused();
    entry.view.setVisible(false);
    entry.tooltipWindow?.hide();
    if (
      restore &&
      focused &&
      parent.isFocused() &&
      !entry.previousFocus?.isDestroyed()
    )
      entry.previousFocus?.focus();
  };
  const clear = () => {
    for (const { view, contents, tooltipWindow } of views.values()) {
      if (tooltipWindow && !tooltipWindow.isDestroyed())
        tooltipWindow.destroy();
      else if (!parent.isDestroyed()) parent.contentView.removeChildView(view);
      if (!contents.isDestroyed())
        contents.close({ waitForBeforeUnload: false });
    }
    views.clear();
  };
  parent.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
    const id = new URLSearchParams(features.replaceAll(",", "&")).get(
      "portalId",
    );
    if (
      url !== "about:blank" ||
      !id ||
      !/^[a-zA-Z0-9-]+$/.test(id) ||
      frameName !== `portal_${id}` ||
      views.has(id)
    )
      return { action: "deny" };
    return {
      action: "allow",
      createWindow: ({ webPreferences, ...constructorOptions }) => {
        const options = {
          ...constructorOptions,
          webPreferences: {
            ...webPreferences,
            preload: undefined,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webviewTag: false,
            transparent: true,
          },
        };
        // Tooltips must not take keyboard focus or intercept clicks on the page.
        const surface = new URLSearchParams(features.replaceAll(",", "&")).get(
          "tooltip",
        );
        const tooltipWindow =
          surface === "true" || surface === "toast"
            ? new BrowserWindow({
                ...options,
                parent,
                show: false,
                frame: false,
                transparent: true,
                focusable: false,
                skipTaskbar: true,
                hasShadow: false,
                resizable: false,
                movable: false,
              })
            : undefined;
        tooltipWindow?.setIgnoreMouseEvents(surface === "true");
        const nativeView = tooltipWindow
          ? undefined
          : new WebContentsView(options);
        const view = tooltipWindow?.contentView ?? nativeView!;
        const contents = tooltipWindow?.webContents ?? nativeView!.webContents;
        view.setBackgroundColor("#00000000");
        view.setBounds({
          x: 0,
          y: 0,
          width: 196,
          height: parent.getContentSize()[1],
        });
        view.setVisible(false);
        views.set(id, { view, contents, tooltipWindow });
        if (!tooltipWindow) parent.contentView.addChildView(view);
        contents.setWindowOpenHandler(() => ({ action: "deny" }));
        contents.on("will-navigate", (event) => event.preventDefault());
        contents.on("blur", () => {
          // Chrome clicks are handled after the trigger's click handler in React.
          // A web-tab click has no DOM event in chrome, so dismiss it here.
          setImmediate(() => {
            if (
              !contents.isDestroyed() &&
              view.getVisible() &&
              !owner.isDestroyed() &&
              !owner.isFocused()
            )
              owner.send("portal:blur", id);
          });
        });
        contents.on("destroyed", () => {
          views.delete(id);
          if (!tooltipWindow && !parent.isDestroyed())
            parent.contentView.removeChildView(view);
          if (!owner.isDestroyed()) owner.send("portal:blur", id);
        });
        return contents;
      },
    };
  });
  const update = (
    event: Electron.IpcMainEvent,
    id: string,
    bounds: Electron.Rectangle | null,
  ) => {
    if (event.sender !== owner) return;
    const entry = views.get(id);
    if (!entry || entry.contents.isDestroyed()) return;
    if (!bounds) {
      hide(id, true);
      return;
    }
    if (
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
    )
      return;
    const [width, height] = parent.getContentSize();
    const w = Math.max(1, Math.min(width, Math.round(bounds.width)));
    const h = Math.max(1, Math.min(height, Math.round(bounds.height)));
    const rectangle = {
      x: Math.max(0, Math.min(width - w, Math.round(bounds.x))),
      y: Math.max(0, Math.min(height - h, Math.round(bounds.y))),
      width: w,
      height: h,
    };
    if (entry.tooltipWindow) {
      const origin = parent.getContentBounds();
      entry.tooltipWindow.setBounds({
        ...rectangle,
        x: origin.x + rectangle.x,
        y: origin.y + rectangle.y,
      });
      entry.view.setVisible(true);
      entry.tooltipWindow.showInactive();
      return;
    }
    entry.view.setBounds(rectangle);
    if (!entry.view.getVisible()) {
      entry.previousFocus =
        [
          owner,
          ...parent.contentView.children.flatMap((child) =>
            child instanceof WebContentsView ? [child.webContents] : [],
          ),
        ].find((contents) => !contents.isDestroyed() && contents.isFocused()) ??
        owner;
      parent.contentView.addChildView(entry.view);
      entry.view.setVisible(true);
      entry.contents.focus();
    }
  };
  ipcMain.on("portal:update", update);
  const dismiss = () => {
    for (const [id] of views) {
      hide(id);
      if (!owner.isDestroyed()) owner.send("portal:blur", id);
    }
  };
  parent.on("resize", dismiss);
  parent.on("move", dismiss);
  parent.on("blur", dismiss);
  owner.on("did-start-navigation", (_event, _url, inPlace, isMainFrame) => {
    if (isMainFrame && !inPlace) clear();
  });
  parent.once("closed", () => {
    ipcMain.removeListener("portal:update", update);
    clear();
  });
}
