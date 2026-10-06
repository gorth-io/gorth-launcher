import { DatabaseSync } from "node:sqlite";
import { userProfilesMigration } from "@/database/migrations/user-profiles";
import { drizzle } from "drizzle-orm/node-sqlite";
import initialMigration from "./migrations/20260927204704_new_masque/migration.sql?raw";

// Electron's bundled Node supplies SQLite; no native addon rebuild is required.
export function openDatabase(filename: string) {
  const client = new DatabaseSync(filename);
  client.exec(
    "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
  );
  const version = Number(
    client.prepare("PRAGMA user_version").get()?.user_version ?? 0,
  );
  if (version > 4)
    throw new Error("Database được tạo bởi phiên bản launcher mới hơn.");
  if (version < 1) {
    client.exec("BEGIN IMMEDIATE");
    try {
      // Also adopt databases created using Drizzle Studio before runtime storage existed.
      client.exec(
        initialMigration
          .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
          .replace(
            /CREATE UNIQUE INDEX /g,
            "CREATE UNIQUE INDEX IF NOT EXISTS ",
          )
          .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS "),
      );
      client.exec("PRAGMA user_version = 1; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 2) {
    client.exec("BEGIN IMMEDIATE");
    try {
      const columns = client.prepare("PRAGMA table_info(instances)").all();
      if (!columns.some((column) => column.name === "loader_version"))
        client.exec("ALTER TABLE instances ADD COLUMN loader_version TEXT");
      client.exec("PRAGMA user_version = 2; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 3) {
    client.exec("BEGIN IMMEDIATE");
    try {
      const columns = client.prepare("PRAGMA table_info(instances)").all();
      if (!columns.some((column) => column.name === "icon_data"))
        client.exec("ALTER TABLE instances ADD COLUMN icon_data TEXT");
      if (!columns.some((column) => column.name === "group_name"))
        client.exec("ALTER TABLE instances ADD COLUMN group_name TEXT");
      client.exec("PRAGMA user_version = 3; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  if (version < 4) {
    client.exec("BEGIN IMMEDIATE");
    try {
      client.exec(userProfilesMigration);
      client.exec("PRAGMA user_version = 4; COMMIT");
    } catch (error) {
      client.exec("ROLLBACK");
      client.close();
      throw error;
    }
  }
  return { client, db: drizzle({ client }) };
}
