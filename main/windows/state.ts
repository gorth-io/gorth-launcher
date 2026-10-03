import { app, screen, type BrowserWindow } from "electron";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function statePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState() {
  let saved: Partial<WindowState> = {};
  try {
    if (existsSync(statePath()))
      saved = JSON.parse(readFileSync(statePath(), "utf8")) ?? {};
  } catch (error) {
    console.warn("Unable to restore window state.", error);
  }
  const valid = [saved.x, saved.y, saved.width, saved.height].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const display = valid
    ? screen.getDisplayMatching({
        x: saved.x!,
        y: saved.y!,
        width: Math.max(1, saved.width!),
        height: Math.max(1, saved.height!),
      })
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const minWidth = Math.min(1280, area.width);
  const minHeight = Math.min(720, area.height);
  const width = Math.round(
    Math.min(area.width, Math.max(minWidth, valid ? saved.width! : 1920)),
  );
  const height = Math.round(
    Math.min(area.height, Math.max(minHeight, valid ? saved.height! : 1080)),
  );
  return {
    width,
    height,
    minWidth,
    minHeight,
    x: Math.round(
      valid
        ? Math.max(area.x, Math.min(saved.x!, area.x + area.width - width))
        : area.x + (area.width - width) / 2,
    ),
    y: Math.round(
      valid
        ? Math.max(area.y, Math.min(saved.y!, area.y + area.height - height))
        : area.y + (area.height - height) / 2,
    ),
    isMaximized: saved.isMaximized === true,
  };
}

function trackWindowState(window: BrowserWindow) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    if (window.isDestroyed() || window.isFullScreen() || window.isMinimized())
      return;
    const state: WindowState = {
      ...window.getNormalBounds(),
      isMaximized: window.isMaximized(),
    };
    try {
      const target = statePath();
      writeFileSync(`${target}.tmp`, JSON.stringify(state), { mode: 0o600 });
      renameSync(`${target}.tmp`, target);
    } catch (error) {
      console.warn("Unable to save window state.", error);
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 250);
  };
  window.on("resize", schedule);
  window.on("move", schedule);
  window.on("maximize", schedule);
  window.on("unmaximize", schedule);
  window.on("leave-full-screen", schedule);
  window.on("close", () => {
    clearTimeout(timer);
    save();
  });
  window.on("closed", () => clearTimeout(timer));
}

export { readWindowState, trackWindowState };
