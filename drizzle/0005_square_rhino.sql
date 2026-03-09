ALTER TABLE `settings` ADD `archive_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `archive_no_votes_days` integer DEFAULT 14;--> statement-breakpoint
ALTER TABLE `settings` ADD `archive_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `cleanup_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `cleanup_older_than_days` integer DEFAULT 7;--> statement-breakpoint
ALTER TABLE `settings` ADD `cleanup_last_run_at` integer;