-- Add log_level setting: controls server logging verbosity (DEBUG/INFO/WARN/ERROR)
ALTER TABLE `settings` ADD `log_level` text DEFAULT 'INFO';
