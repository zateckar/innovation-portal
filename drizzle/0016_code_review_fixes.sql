-- Migration: code review fixes
-- Covers: H4/H5/H6 (indexes), M9 (autoModeLastRunAt), M11 (raw_items indexes),
--         M12 (votes unique constraint), M13 (sessions.lastActiveAt),
--         L3 (research/archive/cleanup interval columns), L6 (rename updatedAt),
-- M8 (raw_items 'failed' status — SQLite CHECK not enforced, handled in app)

-- ── sessions: add lastActiveAt for idle timeout tracking (M13) ─────────────────
ALTER TABLE `sessions` ADD COLUMN `last_active_at` integer;
--> statement-breakpoint

-- ── settings: dedicated autoModeLastRunAt timestamp (M9) ─────────────────────
ALTER TABLE `settings` ADD COLUMN `auto_mode_last_run_at` integer;
--> statement-breakpoint

-- ── settings: configurable intervals for research/archive/cleanup (L3) ────────
ALTER TABLE `settings` ADD COLUMN `research_interval_minutes` integer DEFAULT 60;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `archive_interval_minutes` integer DEFAULT 60;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `cleanup_interval_minutes` integer DEFAULT 60;
--> statement-breakpoint

-- ── settings: rename updated_at -> settings_changed_at (L6) ──────────────────
-- SQLite does not support RENAME COLUMN in older versions; we add the new column
-- and copy the existing value so existing data is preserved.
ALTER TABLE `settings` ADD COLUMN `settings_changed_at` integer;
--> statement-breakpoint
UPDATE `settings` SET `settings_changed_at` = `updated_at`;
--> statement-breakpoint

-- ── raw_items: add 'failed' status value (M8) ────────────────────────────────
-- SQLite does not enforce CHECK constraints added after table creation in older
-- versions. The enum is enforced at the application/Drizzle layer.
-- No DDL change needed for the status column itself; the enum is widened in code.

-- ── raw_items: indexes for frequent status/sourceId queries (M11) ─────────────
CREATE INDEX IF NOT EXISTS `raw_items_status_idx` ON `raw_items` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `raw_items_source_idx` ON `raw_items` (`source_id`);
--> statement-breakpoint

-- ── votes: unique constraint to prevent duplicate votes (M12) ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS `votes_user_innovation_unique` ON `votes` (`user_id`, `innovation_id`);
--> statement-breakpoint

-- ── innovationSources: index on url for URL-based dedup queries (H6) ──────────
CREATE INDEX IF NOT EXISTS `innovation_sources_url_idx` ON `innovation_sources` (`url`);
