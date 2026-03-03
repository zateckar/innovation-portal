CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`innovation_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`url` text NOT NULL,
	`how_to` text NOT NULL,
	`icon_url` text,
	`screenshot_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`added_by` text,
	`created_at` integer,
	`updated_at` integer,
	`archived_at` integer,
	FOREIGN KEY (`innovation_id`) REFERENCES `innovations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_items_slug_unique` ON `catalog_items` (`slug`);