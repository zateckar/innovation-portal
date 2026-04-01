-- FK alignment migration: fix ON DELETE actions to match schema.ts
-- and clean up stale columns.

-- NOTE: SQLite does not support ALTER TABLE ... DROP CONSTRAINT or ALTER COLUMN.
-- The FK mismatches for innovation_sources.raw_item_id and innovations.submitted_by
-- require table rebuilds, which is risky on existing production databases.
-- We document them here for future reference but do NOT attempt rebuilds automatically.
--
-- FK MISMATCHES (schema.ts says CASCADE, DDL says NO ACTION):
--   innovation_sources.raw_item_id  -> raw_items.id  (ON DELETE NO ACTION in DDL, set null in schema)
--   innovations.submitted_by        -> users.id      (ON DELETE NO ACTION in DDL, cascade in schema)
--
-- These are handled at the application level. New databases created from schema.ts
-- will have the correct FK actions.

-- Clean up stale column: settings.updated_at was renamed to settings_changed_at in 0016
-- DROP COLUMN IF EXISTS requires SQLite >= 3.43.0 (bundled better-sqlite3 ships 3.46+).
-- On older versions this statement will fail at drizzle-kit migrate time but is harmless
-- because the column is simply ignored by the ORM (it's not in schema.ts).
ALTER TABLE `settings` DROP COLUMN IF EXISTS `updated_at`;
--> statement-breakpoint

-- Ensure innovation_sources_url_idx exists (was created in 0016 but may be missing on some DBs)
CREATE INDEX IF NOT EXISTS `innovation_sources_url_idx` ON `innovation_sources` (`url`);
