-- Migration: add department columns to users, innovations, and catalog_items
ALTER TABLE `users` ADD `department` text;--> statement-breakpoint
ALTER TABLE `innovations` ADD `department` text DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `department` text DEFAULT 'general';
