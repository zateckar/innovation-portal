-- Custom SQL migration file, put your code below! --

-- Add development stage columns to ideas table
ALTER TABLE `ideas` ADD `spec_status` text DEFAULT 'not_started' NOT NULL;
--> statement-breakpoint
ALTER TABLE `ideas` ADD `spec_document` text;
--> statement-breakpoint
ALTER TABLE `ideas` ADD `ado_pr_url` text;
--> statement-breakpoint
ALTER TABLE `ideas` ADD `jira_escalation_key` text;

-- Add development stage and ADO settings columns to settings table
ALTER TABLE `settings` ADD `jira_project_key` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `idea_vote_threshold` integer DEFAULT 5;
--> statement-breakpoint
ALTER TABLE `settings` ADD `tech_stack_rules` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_enabled` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_org_url` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_project` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_repo_id` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_pat` text;
--> statement-breakpoint
ALTER TABLE `settings` ADD `ado_target_branch` text DEFAULT 'main';

-- Create idea_chats table
CREATE TABLE `idea_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`role` text NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
