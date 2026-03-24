ALTER TABLE ideas ADD COLUMN spec_review_status TEXT NOT NULL DEFAULT 'not_ready'
  CHECK(spec_review_status IN ('not_ready', 'under_review', 'published'));
