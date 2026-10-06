import { Menu, type MenuItemConstructorOptions } from "electron";
import { sendMenuAction } from "@/main/ipc/native-menu";
import { resizeFocusedWindow } from "@/main/ipc/window";
import { applyShortcutAccelerators } from "@/main/ipc/shortcuts";

export function installApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: "Gorth Launcher",
            submenu: [
              {
                label: "About Gorth Launcher",
                click: () => sendMenuAction("settings/help"),
              },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: () => sendMenuAction("settings"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Instance…",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("new-instance"),
        },
        {
          label: "Library",
          accelerator: "CmdOrCtrl+L",
          click: () => sendMenuAction("library"),
        },
        {
          label: "Downloads",
          accelerator: "CmdOrCtrl+J",
          click: () => sendMenuAction("downloads"),
        },
        { type: "separator" },
        { role: "close" },
        ...(process.platform !== "darwin" ? [{ role: "quit" as const }] : []),
      ],
    },
    { role: "editMenu", label: "Edit" },
    { role: "viewMenu", label: "View" },
    {
      label: "Launcher",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          accelerator: "CmdOrCtrl+Shift+K",
          click: () => sendMenuAction("shortcuts"),
        },
        { label: "Overview", click: () => sendMenuAction("home") },
        { label: "Accounts", click: () => sendMenuAction("accounts") },
        {
          label: "Settings…",
          ...(process.platform !== "darwin"
            ? { accelerator: "CmdOrCtrl+," }
            : {}),
          click: () => sendMenuAction("settings"),
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        {
          label: "HD (1280 × 720)",
          click: () => resizeFocusedWindow(1280, 720),
        },
        {
          label: "FHD (1920 × 1080)",
          click: () => resizeFocusedWindow(1920, 1080),
        },
        ...(process.platform === "darwin"
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Gorth Launcher",
          click: () => sendMenuAction("settings/help"),
        },
      ],
    },
  ];
  applyShortcutAccelerators(template);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
