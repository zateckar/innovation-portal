-- Add workspace and app repository columns to ideas table for autonomous build integration
ALTER TABLE `ideas` ADD COLUMN `workspace_uuid` text;
--> statement-breakpoint
ALTER TABLE `ideas` ADD COLUMN `app_repo_url` text;
