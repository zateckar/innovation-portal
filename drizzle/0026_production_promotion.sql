-- Add production promotion columns to ideas table.
-- Set when a user requests the built app be moved to production (creates a Jira issue).
ALTER TABLE `ideas` ADD COLUMN `production_jira_key` text;
--> statement-breakpoint
ALTER TABLE `ideas` ADD COLUMN `production_jira_url` text;
