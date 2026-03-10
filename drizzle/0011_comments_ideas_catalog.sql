-- Migration: extend comments table to support ideas and catalog items
-- SQLite doesn't support DROP NOT NULL or ALTER COLUMN directly,
-- so we recreate the table preserving all existing data.

PRAGMA foreign_keys = OFF;--> statement-breakpoint

-- Step 1: rename existing table
ALTER TABLE comments RENAME TO comments_old;--> statement-breakpoint

-- Step 2: create new table with nullable innovationId and new foreign keys
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  innovation_id TEXT REFERENCES innovations(id) ON DELETE CASCADE,
  idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  catalog_item_id TEXT REFERENCES catalog_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT,
  content TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);--> statement-breakpoint

-- Step 3: copy all existing data (innovation_id may be null for new rows)
INSERT INTO comments (id, innovation_id, user_id, parent_id, content, created_at, updated_at)
SELECT id, innovation_id, user_id, parent_id, content, created_at, updated_at
FROM comments_old;--> statement-breakpoint

-- Step 4: drop old table
DROP TABLE comments_old;--> statement-breakpoint

PRAGMA foreign_keys = ON;
