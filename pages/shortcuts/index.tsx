import { useEffect, useRef, useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Shortcut } from "@/lib/shortcuts";

export function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void window.electronAPI.shortcuts
      .list()
      .then((items) => {
        if (mounted.current) setShortcuts(items);
      })
      .catch(() => {
        if (mounted.current) setError("Unable to load shortcuts.");
      });
    return () => {
      mounted.current = false;
      void window.electronAPI.shortcuts.capture(false);
    };
  }, []);
  const run = async (operation: () => Promise<Shortcut[]>) => {
    setBusy(true);
    setError("");
    try {
      const items = await operation();
      if (mounted.current) setShortcuts(items);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to save shortcuts.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const stopRecording = () => {
    setRecording(null);
    void window.electronAPI.shortcuts
      .capture(false)
      .catch(() => setError("Unable to restore shortcuts."));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="size-4" /> Keyboard shortcuts
        </CardTitle>
        <CardDescription>
          gorth://shortcuts · Click a shortcut, then press a new key
          combination. Escape cancels; Delete clears it.
        </CardDescription>
        <Button
          variant="outline"
          className="h-9 self-start"
          disabled={busy || !shortcuts.length}
          onClick={() => {
            stopRecording();
            void run(() => window.electronAPI.shortcuts.reset());
          }}
        >
          <RotateCcw className="size-4" /> Reset all
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <span className="min-w-40 flex-1 text-sm">{shortcut.label}</span>
            <Input
              className="h-9 w-56"
              readOnly
              disabled={busy}
              aria-label={shortcut.label}
              value={
                recording === shortcut.id
                  ? "Press shortcut…"
                  : shortcut.accelerator || "Not assigned"
              }
              onFocus={() => {
                void window.electronAPI.shortcuts
                  .capture(true)
                  .then(() => {
                    if (
                      mounted.current &&
                      document.activeElement?.getAttribute("aria-label") ===
                        shortcut.label
                    )
                      setRecording(shortcut.id);
                    else void window.electronAPI.shortcuts.capture(false);
                  })
                  .catch(() => setError("Unable to record shortcut."));
              }}
              onBlur={stopRecording}
              onKeyDown={(event) => {
                if (recording !== shortcut.id) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.currentTarget.blur();
                  return;
                }
                if (["Meta", "Control", "Alt", "Shift"].includes(event.key))
                  return;
                const clear =
                  ["Delete", "Backspace"].includes(event.key) &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.altKey;
                const accelerator = clear
                  ? ""
                  : [
                      event.metaKey
                        ? "CmdOrCtrl"
                        : event.ctrlKey
                          ? window.electronAPI.windowState.isMacOS
                            ? "Ctrl"
                            : "CmdOrCtrl"
                          : "",
                      event.altKey ? "Alt" : "",
                      event.shiftKey ? "Shift" : "",
                      event.key === " "
                        ? "Space"
                        : event.key === "+"
                          ? "Plus"
                          : event.key.length === 1
                            ? event.key.toUpperCase()
                            : event.key,
                    ]
                      .filter(Boolean)
                      .join("+");
                event.currentTarget.blur();
                void run(() =>
                  window.electronAPI.shortcuts.update(shortcut.id, accelerator),
                );
              }}
            />
            <Button
              aria-label={`Reset ${shortcut.label}`}
              variant="ghost"
              size="icon"
              className="size-9"
              disabled={busy}
              onClick={() =>
                void run(() => window.electronAPI.shortcuts.reset(shortcut.id))
              }
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
