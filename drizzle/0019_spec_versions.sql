CREATE TABLE IF NOT EXISTS spec_versions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  change_description TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS spec_versions_idea_idx ON spec_versions(idea_id);
