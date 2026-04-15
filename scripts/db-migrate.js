/**
 * Database migration script for production Docker deployment.
 * Runs Drizzle ORM migrations from the drizzle/ folder.
 * Uses only production dependencies (drizzle-orm, bun:sqlite).
 *
 * Workflow: Schema change → drizzle-kit generate → commit SQL → deploy → this script
 * Never use `drizzle-kit push` on production databases.
 */

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/innovation-radar.db';

// Ensure data directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
	mkdirSync(dbDir, { recursive: true });
	console.log(`Created database directory: ${dbDir}`);
}

console.log(`Running migrations on database: ${dbPath}`);

const sqlite = new Database(dbPath);

// Enable WAL mode and foreign keys
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

const db = drizzle(sqlite);

try {
	migrate(db, { migrationsFolder: './drizzle' });
	console.log('Migrations completed successfully!');
} catch (error) {
	console.error('Migration failed:', error);
	process.exit(1);
} finally {
	sqlite.close();
}
