import assert from "node:assert/strict";
import { app, BrowserWindow, Menu } from "electron";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  registerShortcutsIpc,
  applyShortcutAccelerators,
} from "@/main/ipc/shortcuts";
import { readShortcutOverrides } from "@/services/shortcuts";
const directory = mkdtempSync(path.join(tmpdir(), "gorth-shortcuts-native-"));
app.setPath("userData", directory);
app.setPath("sessionData", directory);
const actions: string[] = [];
async function run() {
  await app.whenReady();

  const refresh = () => {
    const template = [
      {
        label: "Keyboard Shortcuts",
        accelerator: "CmdOrCtrl+Shift+K",
        click: () => actions.push("shortcuts"),
      },
    ];
    applyShortcutAccelerators(template);
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };
  registerShortcutsIpc(refresh, (id) => actions.push(id));
  refresh();
  const window = new BrowserWindow({
    show: true,
    webPreferences: {
      preload: path.resolve(".vite/shortcuts-preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  try {
    await window.loadFile(
      path.resolve("tests/fixtures/shortcuts/assets/index.html"),
    );
    window.focus();
    window.webContents.focus();
    const press = async (
      keyCode: string,
      modifiers = [process.platform === "darwin" ? "meta" : "control", "shift"],
    ) => {
      window.webContents.sendInputEvent({
        type: "keyDown",
        keyCode,
        modifiers,
      });
      window.webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
      await new Promise((resolve) => setTimeout(resolve, 100));
    };
    await press("K");
    assert.deepEqual(actions, ["shortcuts"]);
    actions.length = 0;
    await window.webContents.executeJavaScript(
      "window.electronAPI.shortcuts.update('shortcuts','CmdOrCtrl+Shift+Y')",
    );
    assert.equal(readShortcutOverrides().shortcuts, "CmdOrCtrl+Shift+Y");
    await press("K");
    assert.equal(actions.length, 0);
    await press("Y");
    assert.deepEqual(actions, ["shortcuts"]);
    actions.length = 0;
    await window.webContents.executeJavaScript(
      "window.electronAPI.shortcuts.capture(true)",
    );
    await press("Y");
    assert.equal(actions.length, 0);
    await window.webContents.executeJavaScript(
      "window.electronAPI.shortcuts.capture(false)",
    );
    await press("Y");
    assert.deepEqual(actions, ["shortcuts"]);
    await window.webContents.executeJavaScript(
      "window.electronAPI.shortcuts.reset()",
    );
    assert.deepEqual(readShortcutOverrides(), {});

    console.log(
      "PASS: native shortcuts, no duplicate dispatch, persistence, recorder and reset.",
    );
  } finally {
    window.destroy();
  }
}
run()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
