CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`innovation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `innovation_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`innovation_id` text,
	`raw_item_id` text,
	`url` text NOT NULL,
	`title` text,
	`source_type` text,
	`created_at` integer,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_item_id`) REFERENCES `raw_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `innovation_tags` (
	`innovation_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `innovations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text NOT NULL,
	`category` text NOT NULL,
	`research_data` text NOT NULL,
	`relevance_score` real,
	`innovation_score` real,
	`actionability_score` real,
	`hero_image_url` text,
	`is_open_source` integer DEFAULT false,
	`is_self_hosted` integer DEFAULT false,
	`has_ai_component` integer DEFAULT false,
	`maturity_level` text,
	`license` text,
	`github_url` text,
	`documentation_url` text,
	`status` text DEFAULT 'pending',
	`submitted_by` text,
	`discovered_at` integer,
	`researched_at` integer,
	`published_at` integer,
	`promoted_at` integer,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `innovations_slug_unique` ON `innovations` (`slug`);--> statement-breakpoint
CREATE TABLE `raw_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`external_id` text,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`content` text,
	`published_at` integer,
	`discovered_at` integer,
	`status` text DEFAULT 'pending',
	`ai_filter_reason` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`filter_prompt` text,
	`research_prompt` text,
	`auto_mode_enabled` integer DEFAULT false,
	`auto_publish_threshold` real DEFAULT 7,
	`auto_innovations_per_run` integer DEFAULT 3,
	`auto_run_interval_minutes` integer DEFAULT 60,
	`scan_interval_minutes` integer DEFAULT 120,
	`filter_interval_minutes` integer DEFAULT 30,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`config` text,
	`enabled` integer DEFAULT true,
	`scan_interval_minutes` integer DEFAULT 120,
	`last_scanned_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'user' NOT NULL,
	`auth_provider` text NOT NULL,
	`password_hash` text,
	`oidc_subject` text,
	`created_at` integer,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`innovation_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE cascade
);
