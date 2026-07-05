-- Content retention settings: auto-archive old generated news, trends and AI ideas.
-- Feed items keep their existing hard-delete cleanup; these columns drive soft-archive
-- (status='archived') for published news/trends and AI-generated ideas. User-proposed
-- and Jira-imported ideas are never touched by the ideas retention job.
ALTER TABLE `settings` ADD `news_retention_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_retention_days` integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_retention_interval_minutes` integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE `settings` ADD `news_retention_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `trends_retention_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `trends_retention_days` integer DEFAULT 90;--> statement-breakpoint
ALTER TABLE `settings` ADD `trends_retention_interval_minutes` integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE `settings` ADD `trends_retention_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_retention_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_retention_days` integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_retention_interval_minutes` integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE `settings` ADD `ideas_retention_last_run_at` integer;
