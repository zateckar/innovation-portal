ALTER TABLE `settings` ADD `scan_enabled` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `settings` ADD `scan_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `filter_enabled` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `settings` ADD `filter_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `research_enabled` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `settings` ADD `research_last_run_at` integer;