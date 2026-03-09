-- Migration: allow users to propose Ideas
-- Adds proposedBy (FK to users) and proposedByEmail columns to ideas table.
-- SQLite does not support modifying CHECK constraints on existing columns,
-- so we add the two new columns and rely on application-level validation for
-- the extended 'user' source value (the existing 'ai'/'jira' rows are unaffected).

ALTER TABLE `ideas` ADD `proposed_by` text REFERENCES `users`(`id`);
ALTER TABLE `ideas` ADD `proposed_by_email` text;
