CREATE TABLE `game_accounts` (
	`id` text PRIMARY KEY,
	`provider` text NOT NULL,
	`username` text NOT NULL,
	`uuid` text NOT NULL,
	`credentials` blob,
	`expires_at` integer,
	CONSTRAINT "game_accounts_provider_check" CHECK("provider" IN ('offline', 'ely', 'gorth')),
	CONSTRAINT "game_accounts_offline_credentials_check" CHECK("provider" != 'offline' OR ("credentials" IS NULL AND "expires_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `instances` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`loader` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `launcher_session` (
	`id` integer PRIMARY KEY DEFAULT 1,
	`subject` text NOT NULL,
	`name` text NOT NULL,
	`credentials` blob NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "launcher_session_singleton_check" CHECK("id" = 1)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_accounts_provider_uuid_idx` ON `game_accounts` (`provider`,`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_accounts_offline_username_idx` ON `game_accounts` (lower("username")) WHERE "game_accounts"."provider" = 'offline';--> statement-breakpoint
CREATE INDEX `instances_created_at_idx` ON `instances` (`created_at`);