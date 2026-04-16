-- Trends table
CREATE TABLE IF NOT EXISTS `trends` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`category_group` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`content` text NOT NULL,
	`key_insights` text,
	`maturity_level` text,
	`impact_score` real,
	`time_horizon` text,
	`visual_data` text,
	`sources` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`generated_at` integer,
	`published_at` integer,
	`created_at` integer,
	`updated_at` integer
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `trends_category_idx` ON `trends` (`category`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trends_category_group_idx` ON `trends` (`category_group`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trends_status_idx` ON `trends` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `trends_slug_unique` ON `trends` (`slug`);--> statement-breakpoint

-- Settings columns for trends
ALTER TABLE `settings` ADD COLUMN `trends_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `trends_criteria` text;--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `trends_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `trends_interval_minutes` integer DEFAULT 10080;--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `trends_last_run_at` integer;
