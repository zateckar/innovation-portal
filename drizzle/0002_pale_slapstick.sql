CREATE TABLE `user_deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`catalog_item_id` text NOT NULL,
	`instance_url` text NOT NULL,
	`deployed_at` integer NOT NULL,
	`deployment_variables` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_deployments_user_id_catalog_item_id_unique` ON `user_deployments` (`user_id`,`catalog_item_id`);--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `deployment_type` text DEFAULT 'saas' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `deployment_manifest` text;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `deployment_api_url` text;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `instance_url_template` text;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `undeploy_manifest` text;