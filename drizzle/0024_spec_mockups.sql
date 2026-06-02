-- Spec mockups: AI-rendered HTML/CSS screen mockups generated from the spec.
-- JSON shape: { "generatedAt": "ISO", "screens": [{ "id", "screenName", "purpose", "html" }] }
ALTER TABLE `ideas` ADD COLUMN `spec_mockups` text;
