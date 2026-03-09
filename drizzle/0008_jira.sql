-- Jira integration: new columns on ideas table
ALTER TABLE `ideas` ADD `source` text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `jira_issue_key` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `jira_issue_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_jira_issue_key_unique` ON `ideas` (`jira_issue_key`);--> statement-breakpoint

-- Jira integration: new columns on settings table
ALTER TABLE `settings` ADD `jira_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_url` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_apim_subscription_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_mtls_cert` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_mtls_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_jql` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_interval_minutes` integer DEFAULT 1440;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_max_issues_per_run` integer DEFAULT 20;
