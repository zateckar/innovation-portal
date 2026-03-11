PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`innovation_id` text,
	`idea_id` text,
	`catalog_item_id` text,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "innovation_id", "idea_id", "catalog_item_id", "user_id", "parent_id", "content", "created_at", "updated_at") SELECT "id", "innovation_id", "idea_id", "catalog_item_id", "user_id", "parent_id", "content", "created_at", "updated_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `ideas` ADD `source` text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `jira_issue_key` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `jira_issue_url` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `proposed_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `ideas` ADD `proposed_by_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ideas_jira_issue_key_unique` ON `ideas` (`jira_issue_key`);--> statement-breakpoint
ALTER TABLE `settings` ADD `news_per_department` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `settings` ADD `evaluation_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `realization_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `llm_api_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `llm_model` text DEFAULT 'models/gemini-3-flash-preview';--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_issuer` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_id` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_secret` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_url` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_apim_subscription_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_mtls_cert` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_mtls_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_jql` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_interval_minutes` integer DEFAULT 1440;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_last_run_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_max_issues_per_run` integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_extraction_prompt` text;