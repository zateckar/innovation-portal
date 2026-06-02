-- Trends: primary department (single source of truth = DEPARTMENTS enum in $lib/types).
-- Nullable on the table; backfilled from `category` by hooks.server.ts on first boot.
-- Existing rows still satisfy NOT-NULL-free because the column is intentionally nullable.
ALTER TABLE `trends` ADD COLUMN `department` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trends_department_idx` ON `trends` (`department`);
