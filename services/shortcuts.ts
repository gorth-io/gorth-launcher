import { app } from "electron";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDatabase } from "@/database/client";
import { settings } from "@/database/schema";

export function readShortcutOverrides(): Record<string, string> {
  const { client, db } = openDatabase(
    path.join(app.getPath("userData"), "gorth-launcher.db"),
  );
  try {
    const value = db
      .select()
      .from(settings)
      .where(eq(settings.key, "shortcuts"))
      .get()?.value;
    return value ? JSON.parse(value) : {};
  } finally {
    client.close();
  }
}
export function writeShortcutOverrides(value: Record<string, string>) {
  const { client, db } = openDatabase(
    path.join(app.getPath("userData"), "gorth-launcher.db"),
  );
  try {
    db.insert(settings)
      .values({ key: "shortcuts", value: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(value) },
      })
      .run();
  } finally {
    client.close();
  }
}
