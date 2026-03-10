-- Migration: add LLM and OIDC settings columns to settings table
ALTER TABLE `settings` ADD `llm_api_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `llm_model` text DEFAULT 'models/gemini-3-flash-preview';--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_issuer` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_id` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_client_secret` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `oidc_enabled` integer DEFAULT false;
