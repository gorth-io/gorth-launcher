export interface ShortcutDefinition {
  id: string;
  label: string;
  defaultAccelerator: string;
}
export interface Shortcut extends ShortcutDefinition {
  accelerator: string;
}
export function normalizeAccelerator(value: string): string {
  if (!value.trim()) return "";
  const parts = value.split("+").map((part) => part.trim());
  const key = parts.pop()!.replace(/^Arrow/, "");
  if (
    !/^(?:[a-z0-9,./;[\]\\-]|Tab|Space|Plus|Enter|Backspace|Delete|Escape|Up|Down|Left|Right|F(?:[1-9]|1[0-9]|2[0-4]))$/i.test(
      key,
    )
  )
    throw new Error("Choose a letter, number, function key or navigation key.");
  const order = ["CmdOrCtrl", "Ctrl", "Alt", "Shift", "Super"];
  if (
    parts.some((part) => !order.includes(part)) ||
    new Set(parts).size !== parts.length ||
    (!parts.some((part) =>
      ["CmdOrCtrl", "Ctrl", "Alt", "Super"].includes(part),
    ) &&
      !/^F\d+$/i.test(key))
  )
    throw new Error("Use Command/Control, Alt, or a function key.");
  const namedKeys = [
    "Tab",
    "Space",
    "Plus",
    "Enter",
    "Backspace",
    "Delete",
    "Escape",
    "Up",
    "Down",
    "Left",
    "Right",
  ];
  const normalizedKey =
    namedKeys.find((part) => part.toLowerCase() === key.toLowerCase()) ??
    key.toUpperCase();
  return [...order.filter((part) => parts.includes(part)), normalizedKey].join(
    "+",
  );
}
export function shortcutIdentity(accelerator: string, isMac: boolean) {
  return accelerator
    .replace("CmdOrCtrl", isMac ? "Super" : "Ctrl")
    .split("+")
    .sort()
    .join("+");
}
export function validateShortcutChange(
  shortcuts: Shortcut[],
  id: string,
  value: string,
  isMac: boolean,
) {
  if (!shortcuts.some((shortcut) => shortcut.id === id))
    throw new Error("Unknown shortcut.");
  const accelerator = normalizeAccelerator(value);
  const identity = shortcutIdentity(accelerator, isMac);
  if (
    accelerator &&
    shortcuts.some(
      (shortcut) =>
        shortcut.id !== id &&
        shortcutIdentity(shortcut.accelerator, isMac) === identity,
    )
  )
    throw new Error("This shortcut is already assigned.");
  const reserved = [
    "CmdOrCtrl+C",
    "CmdOrCtrl+V",
    "CmdOrCtrl+X",
    "CmdOrCtrl+A",
    "CmdOrCtrl+Z",
    "CmdOrCtrl+Shift+Z",
    "CmdOrCtrl+Q",
    "CmdOrCtrl+H",
    "CmdOrCtrl+M",
    "CmdOrCtrl+Shift+W",
    "CmdOrCtrl+Alt+I",
    "Ctrl+Shift+I",
    "F11",
  ];
  if (
    accelerator &&
    reserved.some((value) => shortcutIdentity(value, isMac) === identity)
  )
    throw new Error(
      "This shortcut is reserved by the application or operating system.",
    );
  return accelerator;
}
