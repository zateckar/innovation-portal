CREATE TABLE `idea_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`idea_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idea_votes_user_id_idea_id_unique` ON `idea_votes` (`user_id`,`idea_id`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`problem` text NOT NULL,
	`solution` text NOT NULL,
	`department` text NOT NULL,
	`research_data` text,
	`evaluation_score` real,
	`evaluation_details` text,
	`realization_html` text,
	`realization_diagram` text,
	`realization_notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`batch_id` text,
	`rank` integer,
	`ai_prompt_used` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_slug_unique` ON `ideas` (`slug`);--> statement-breakpoint
CREATE TABLE `news` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`sources` text,
	`relevance_score` integer,
	`ai_prompt_used` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_slug_unique` ON `news` (`slug`);--> statement-breakpoint
ALTER TABLE `settings` ADD `news_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_interval_minutes` integer DEFAULT 1440;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_departments` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_interval_minutes` integer DEFAULT 1440;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_departments` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_per_batch` integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_auto_realize` integer DEFAULT true;