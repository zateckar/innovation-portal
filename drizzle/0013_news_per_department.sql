-- Add news_per_department setting: controls how many digests to generate per department per run
ALTER TABLE `settings` ADD `news_per_department` integer DEFAULT 1;
