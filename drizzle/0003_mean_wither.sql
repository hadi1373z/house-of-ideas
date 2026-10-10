CREATE TABLE `online_conversation_messages` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`home_id` text,
	`actor` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_message_identity` ON `online_conversation_messages` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `online_message_page` ON `online_conversation_messages` (`user_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `online_improvement_briefs` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`approved_at` text,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `online_neighborhoods` (
	`user_id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL,
	`revision_token` text NOT NULL,
	`updated_at` text NOT NULL
);
