-- Catch-up migration: idempotently adds columns/tables that were missing on
-- databases created outside the Drizzle migration system (e.g. via schema push).
-- Uses ADD COLUMN IF NOT EXISTS (requires SQLite >= 3.37.0 — bundled version is 3.51.2).

-- sessions: lastActiveAt (should have been added by 0016_code_review_fixes)
ALTER TABLE `sessions` ADD COLUMN IF NOT EXISTS `last_active_at` INTEGER;
--> statement-breakpoint

-- ideas: spec / ADO fields (should have been added by 0017_good_colleen_wing)
ALTER TABLE `ideas` ADD COLUMN IF NOT EXISTS `spec_status` TEXT NOT NULL DEFAULT 'not_started';
--> statement-breakpoint
ALTER TABLE `ideas` ADD COLUMN IF NOT EXISTS `spec_document` TEXT;
--> statement-breakpoint
ALTER TABLE `ideas` ADD COLUMN IF NOT EXISTS `ado_pr_url` TEXT;
--> statement-breakpoint
ALTER TABLE `ideas` ADD COLUMN IF NOT EXISTS `jira_escalation_key` TEXT;
--> statement-breakpoint

-- settings: ADO / dev-stage fields (should have been added by 0017_good_colleen_wing)
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `jira_project_key` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `idea_vote_threshold` INTEGER DEFAULT 5;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `tech_stack_rules` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_enabled` INTEGER DEFAULT false;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_org_url` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_project` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_repo_id` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_pat` TEXT;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN IF NOT EXISTS `ado_target_branch` TEXT DEFAULT 'main';
--> statement-breakpoint

-- users: department column (added to schema but never had a migration)
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `department` TEXT;
--> statement-breakpoint

-- innovations: department column (added to schema but never had a migration)
ALTER TABLE `innovations` ADD COLUMN IF NOT EXISTS `department` TEXT DEFAULT 'general';
--> statement-breakpoint

-- catalog_items: department column (added to schema but never had a migration)
ALTER TABLE `catalog_items` ADD COLUMN IF NOT EXISTS `department` TEXT DEFAULT 'general';
--> statement-breakpoint

-- idea_chats: create if missing (should have been created by 0017_good_colleen_wing)
CREATE TABLE IF NOT EXISTS `idea_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`role` text NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
