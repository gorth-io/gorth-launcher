import {
  BrowserWindow,
  app,
  WebContentsView,
  ipcMain,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron";
import { z } from "zod";
import {
  normalizeAccelerator,
  shortcutIdentity,
  validateShortcutChange,
  type Shortcut,
  type ShortcutDefinition,
} from "@/lib/shortcuts";
import {
  readShortcutOverrides,
  writeShortcutOverrides,
} from "@/services/shortcuts";

const definitions: ShortcutDefinition[] = [
  {
    id: "new-instance",
    label: "New Instance…",
    defaultAccelerator: "CmdOrCtrl+N",
  },
  { id: "library", label: "Library", defaultAccelerator: "CmdOrCtrl+L" },
  { id: "downloads", label: "Downloads", defaultAccelerator: "CmdOrCtrl+J" },
  { id: "settings", label: "Settings…", defaultAccelerator: "CmdOrCtrl+," },
  { id: "home", label: "Overview", defaultAccelerator: "CmdOrCtrl+1" },
  { id: "accounts", label: "Accounts", defaultAccelerator: "CmdOrCtrl+2" },
  {
    id: "shortcuts",
    label: "Keyboard Shortcuts",
    defaultAccelerator: "CmdOrCtrl+Shift+K",
  },
];
let overrides: Record<string, string> = {};
export function listShortcuts(): Shortcut[] {
  return definitions.map((definition) => ({
    ...definition,
    accelerator: overrides[definition.id] ?? definition.defaultAccelerator,
  }));
}
export function applyShortcutAccelerators(
  template: MenuItemConstructorOptions[],
  assigned = new Set<string>(),
) {
  for (const item of template) {
    const shortcut = listShortcuts().find(
      (shortcut) => shortcut.label === item.label,
    );
    if (shortcut) {
      item.accelerator = assigned.has(shortcut.id)
        ? undefined
        : shortcut.accelerator || undefined;
      assigned.add(shortcut.id);
    }
    if (Array.isArray(item.submenu))
      applyShortcutAccelerators(item.submenu, assigned);
  }
}
function requireOwner(sender: WebContents) {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window || window.webContents !== sender)
    throw new Error("Untrusted shortcut request.");
}
export function registerShortcutsIpc(
  refreshMenu: () => void,
  dispatch: (id: string) => void,
) {
  const recording = new Set<number>();
  app.on("web-contents-created", (_event, contents) => {
    contents.on("destroyed", () => recording.delete(contents.id));
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || recording.has(contents.id)) return;
      const owner =
        BrowserWindow.fromWebContents(contents) ??
        BrowserWindow.getAllWindows().find((window) =>
          window.contentView.children.some(
            (child) =>
              child instanceof WebContentsView &&
              child.webContents === contents,
          ),
        );
      if (
        !owner ||
        !owner.webContents
          .getURL()
          .split(/[?#]/)[0]
          .endsWith("/assets/index.html")
      )
        return;
      const key = /^Key[A-Z]$/.test(input.code)
        ? input.code.slice(3)
        : /^Digit[0-9]$/.test(input.code)
          ? input.code.slice(5)
          : input.key === " "
            ? "Space"
            : input.key === "+"
              ? "Plus"
              : input.key;
      let accelerator: string;
      try {
        accelerator = normalizeAccelerator(
          [
            input.control ? "Ctrl" : "",
            input.meta ? "Super" : "",
            input.alt ? "Alt" : "",
            input.shift ? "Shift" : "",
            key,
          ]
            .filter(Boolean)
            .join("+"),
        );
      } catch {
        return;
      }
      const shortcut = listShortcuts().find(
        (item) =>
          item.accelerator &&
          shortcutIdentity(item.accelerator, process.platform === "darwin") ===
            shortcutIdentity(accelerator, process.platform === "darwin"),
      );
      if (!shortcut) return;
      event.preventDefault();
      if (!input.isAutoRepeat) dispatch(shortcut.id);
    });
  });
  let saved: Record<string, string> = {};
  try {
    saved = z.record(z.string(), z.string()).parse(readShortcutOverrides());
  } catch (error) {
    console.warn("Unable to load saved shortcuts; using defaults.", error);
  }
  // Resolve all overrides together so swapping two bindings survives restart.
  for (const definition of definitions) {
    if (saved[definition.id] !== undefined) {
      try {
        overrides[definition.id] = normalizeAccelerator(saved[definition.id]);
      } catch (error) {
        console.warn(
          "Ignoring an invalid saved shortcut.",
          definition.id,
          error,
        );
      }
    }
  }
  for (const definition of definitions) {
    if (saved[definition.id] !== undefined) {
      try {
        overrides[definition.id] = validateShortcutChange(
          listShortcuts(),
          definition.id,
          saved[definition.id],
          process.platform === "darwin",
        );
      } catch (error) {
        console.warn(
          "Ignoring an invalid saved shortcut.",
          definition.id,
          error,
        );
        overrides[definition.id] = "";
      }
    }
  }
  ipcMain.handle("shortcuts:list", (event) => {
    requireOwner(event.sender);
    return listShortcuts();
  });
  ipcMain.handle("shortcuts:update", (event, id: unknown, value: unknown) => {
    requireOwner(event.sender);
    const key = z.string().parse(id);
    const accelerator = validateShortcutChange(
      listShortcuts(),
      key,
      normalizeAccelerator(z.string().max(80).parse(value)),
      process.platform === "darwin",
    );
    const next = { ...overrides, [key]: accelerator };
    writeShortcutOverrides(next);
    overrides = next;
    refreshMenu();
    return listShortcuts();
  });
  ipcMain.handle("shortcuts:reset", (event, id: unknown) => {
    requireOwner(event.sender);
    const next = { ...overrides };
    if (id !== undefined) {
      const key = z.string().parse(id);
      const definition = definitions.find((item) => item.id === key);
      if (!definition) throw new Error("Unknown shortcut.");
      validateShortcutChange(
        listShortcuts(),
        key,
        definition.defaultAccelerator,
        process.platform === "darwin",
      );
      delete next[key];
    }
    writeShortcutOverrides(id === undefined ? {} : next);
    overrides = id === undefined ? {} : next;
    refreshMenu();
    return listShortcuts();
  });
  ipcMain.handle("shortcuts:capture", (event, enabled: unknown) => {
    requireOwner(event.sender);
    event.sender.setIgnoreMenuShortcuts(z.boolean().parse(enabled));
    if (enabled) recording.add(event.sender.id);
    else recording.delete(event.sender.id);
  });
}
