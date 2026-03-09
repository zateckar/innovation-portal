-- Add customizable prompts for idea evaluation, realization, and Jira extraction
ALTER TABLE `settings` ADD `evaluation_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `realization_prompt` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `jira_extraction_prompt` text;
