import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeAccelerator,
  validateShortcutChange,
  type Shortcut,
} from "@/lib/shortcuts";
const shortcuts: Shortcut[] = [
  {
    id: "new",
    label: "New tab",
    defaultAccelerator: "CmdOrCtrl+T",
    accelerator: "CmdOrCtrl+T",
  },
  {
    id: "reopen",
    label: "Reopen",
    defaultAccelerator: "CmdOrCtrl+Shift+T",
    accelerator: "CmdOrCtrl+Shift+T",
  },
];
test("normalizes modifier order, letters and Electron navigation key names", () => {
  assert.equal(normalizeAccelerator("Shift+CmdOrCtrl+t"), "CmdOrCtrl+Shift+T");
  assert.equal(normalizeAccelerator("Alt+ArrowLeft"), "Alt+Left");
  assert.equal(normalizeAccelerator("F12"), "F12");
  assert.equal(normalizeAccelerator("CmdOrCtrl+Plus"), "CmdOrCtrl+Plus");
  assert.equal(normalizeAccelerator(""), "");
});
test("rejects malformed or unmodified shortcuts", () => {
  for (const value of [
    "t",
    "Shift+T",
    "CmdOrCtrl+CmdOrCtrl+T",
    "Ctrl+Unknown",
    "Ctrl++",
  ])
    assert.throws(() => normalizeAccelerator(value));
});
test("detects platform-equivalent duplicates", () => {
  assert.throws(
    () => validateShortcutChange(shortcuts, "reopen", "Ctrl+T", false),
    /already assigned/,
  );
  assert.throws(
    () => validateShortcutChange(shortcuts, "reopen", "Super+T", true),
    /already assigned/,
  );
  assert.equal(
    validateShortcutChange(shortcuts, "reopen", "Ctrl+T", true),
    "Ctrl+T",
  );
});
test("allows disabling shortcuts and preserves default reopen chord", () => {
  assert.equal(validateShortcutChange(shortcuts, "reopen", "", true), "");
  assert.equal(
    validateShortcutChange(shortcuts, "reopen", "CmdOrCtrl+Shift+T", true),
    "CmdOrCtrl+Shift+T",
  );
});
test("protects native editing and window commands, and rejects unknown actions", () => {
  assert.throws(
    () => validateShortcutChange(shortcuts, "new", "CmdOrCtrl+C", true),
    /reserved/,
  );
  assert.throws(
    () => validateShortcutChange(shortcuts, "new", "CmdOrCtrl+Shift+W", true),
    /reserved/,
  );
  assert.throws(
    () => validateShortcutChange(shortcuts, "missing", "", true),
    /Unknown/,
  );
});
