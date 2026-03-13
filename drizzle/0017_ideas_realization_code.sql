-- Migration: add realization_code column to ideas table
-- realization_code was added to schema.ts but never had a corresponding migration.
ALTER TABLE `ideas` ADD `realization_code` text;
