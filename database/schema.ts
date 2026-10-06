import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const instances = sqliteTable(
  "instances",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    loader: text("loader").notNull(),
    loaderVersion: text("loader_version"),
    iconData: text("icon_data"),
    group: text("group_name"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("instances_created_at_idx").on(table.createdAt)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const gameAccounts = sqliteTable(
  "game_accounts",
  {
    id: text("id").primaryKey(),
    provider: text("provider", {
      enum: ["offline", "ely", "gorth"],
    }).notNull(),
    username: text("username").notNull(),
    uuid: text("uuid").notNull(),
    // OS-encrypted credential payload only; never store raw tokens/passwords.
    credentials: blob("credentials", { mode: "buffer" }),
    expiresAt: integer("expires_at"),
  },
  (table) => [
    uniqueIndex("game_accounts_provider_uuid_idx").on(
      table.provider,
      table.uuid,
    ),
    uniqueIndex("game_accounts_offline_username_idx")
      .on(sql`lower(${table.username})`)
      .where(sql`${table.provider} = 'offline'`),
    check(
      "game_accounts_provider_check",
      sql`${table.provider} IN ('offline', 'ely', 'gorth')`,
    ),
    check(
      "game_accounts_offline_credentials_check",
      sql`${table.provider} != 'offline' OR (${table.credentials} IS NULL AND ${table.expiresAt} IS NULL)`,
    ),
  ],
);

// A single Gorth launcher session, independent of selected game accounts.
export const launcherSession = sqliteTable(
  "launcher_session",
  {
    id: integer("id").primaryKey().default(1),
    subject: text("subject").notNull(),
    name: text("name").notNull(),
    credentials: blob("credentials", { mode: "buffer" }).notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [check("launcher_session_singleton_check", sql`${table.id} = 1`)],
);

/** Public SSO identity cache, separate from browser profiles/game accounts. */
export const userProfiles = sqliteTable("user_profiles", {
  ssoUserId: text("sso_user_id").primaryKey().notNull(),
  name: text("name").notNull(),
  username: text("username"),
  email: text("email"),
  image: text("image"),
  emailVerified: integer("email_verified", { mode: "boolean" }),
  createdAt: integer("created_at").notNull(),
  syncedAt: integer("synced_at").notNull(),
});
